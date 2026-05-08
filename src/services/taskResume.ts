import { useCanvasStore } from '@/store/useCanvasStore';
import type { AIGeneratingElement, PendingGenerationTask } from '@/types/canvas';
import { pollImageTaskByProviderId } from './gateway';
import { replacePlaceholderWithImage, setPlaceholderError } from './imageGeneration';

/**
 * 跨会话 / 跨刷新的异步任务恢复器。
 *
 * 上次运行期间若有 RunningHub 之类 provider 提交了任务但本轮轮询窗口没等到
 * 终结态，placeholder 会带着 `pendingTask`（含 taskId + 请求快照）被持久化
 * 到 canvas store。本模块负责：
 *
 *   1) 启动时扫描所有 `aigenerating` placeholder，找到还带 pendingTask 的
 *   2) 对每个独立发起一次 `pollImageTask` 查询
 *      - SUCCESS → 替换为 image 节点（走与常规生成相同的归档路径）
 *      - FAILED  → 写 placeholder.error（用 pendingTask.request 复原）
 *      - 仍 pending → 啥也不做，pendingTask 保留，下次启动再来
 *
 * 关键原则：
 *   - 幂等：重复调用同一 placeholder 的 resume 不会多出 image 节点
 *   - 不阻塞 UI：整体 fire-and-forget，内部并发不做串行
 *   - 不删 pendingTask 除非拿到终结态——网络抖动等瞬时问题不会掉信息
 *
 * 暂未支持 video resume（当前没有异步 video provider），future work。
 */

// 避免同一 placeholder 在短时间内被多次 resume——比如 React StrictMode 下
// useEffect 会跑两遍，或者启动后用户手动又触发一次。不是强一致性的锁，
// 只是个软降频。
const inFlight = new Set<string>();

export function resumePendingImageTasks(): void {
  const state = useCanvasStore.getState();
  const pendings = state.elements.filter(
    (el): el is AIGeneratingElement =>
      el.type === 'aigenerating' &&
      !!(el as AIGeneratingElement).pendingTask &&
      // 已经 error 的 placeholder 不恢复——error 态是终结态，交给 retry。
      !(el as AIGeneratingElement).error,
  );

  if (pendings.length === 0) return;

  for (const el of pendings) {
    const pending = el.pendingTask!;
    void resumeSingle(el.id, pending);
  }
}

async function resumeSingle(placeholderId: string, pending: PendingGenerationTask): Promise<void> {
  if (inFlight.has(placeholderId)) return;
  inFlight.add(placeholderId);

  try {
    const result = await pollImageTaskByProviderId(pending.providerId, pending.taskId);

    // 每次 resume 结束前，如果 placeholder 已经被用户删掉 / 或被替换，
    // 就什么都不干。store 操作函数本身也有兜底，但这里 early-return 更清晰。
    const el = useCanvasStore.getState().elements.find(e => e.id === placeholderId);
    if (!el || el.type !== 'aigenerating') return;

    if (result.ok === true) {
      const url = result.urls[0];
      if (url) {
        replacePlaceholderWithImage(placeholderId, url, pending.request.prompt, pending.request.model, pending.request.execId, undefined);
        return;
      }
      setPlaceholderError(placeholderId, {
        kind: 'empty',
        message: '任务已完成但未返回图像',
        request: pending.request,
      });
      return;
    }

    if (result.ok === 'pending') {
      // 仍在跑：什么都不做，pendingTask 原样保留，下次启动再 resume。
      return;
    }

    // 失败区分"瞬态"和"终结态"：
    //   - missingKey / network → 瞬态，用户只是暂时没配 key 或网络没通；
    //     **保留 pendingTask**，让后续启动能接回。否则 retry 会向 RH 重
    //     提交新任务，原任务白等、钱可能还多扣。
    //   - server / empty / unknown → 视为终结态，刷红让用户 retry。
    if (result.kind === 'missingKey' || result.kind === 'network') return;

    setPlaceholderError(placeholderId, {
      kind: result.kind,
      message: result.message,
      detail: result.detail,
      request: pending.request,
    });
  } finally {
    inFlight.delete(placeholderId);
  }
}

/**
 * file-node discovery telemetry（Tiny Act of Discovery #1）
 * ================================================================
 * 只服务于一个问题：file 节点 2 周观察窗里，它到底被**用来做什么**。
 *
 * 4 个计数器：
 *   - fileNodeCreated                  有人上传 / 拖入任意文件
 *   - fileNodeConnectedAsImageSource   file(image) 被连到图生节点的输入口
 *   - img2imgFromFileNode              一次图生生成，上游 image 源是 file
 *   - img2imgFromImageNode             一次图生生成，上游 image 源是 image 节点
 *
 * 决策门（见 Epic Hypothesis）：
 *   file → generator 连接率      = fileNodeConnectedAsImageSource / fileNodeCreated    (≥ 40%)
 *   img2img 中 file 源占比        = fromFileNode / (fromFileNode + fromImageNode)       (≥ 50%)
 *
 * —— 为什么不用严格内存、而是 localStorage 存一份？2 周观察窗里浏览器会刷
 *   新 / 关机 / 切标签很多次，纯内存会每天清零 → 根本采不到样本。但也不走
 *   canvas 的主 persist（useCanvasStore）里，免得出现撤销 / 迁移带来的意外
 *   联动。一个独立 key，~200B，观察结束后一行 localStorage.removeItem() 彻底卸载。
 *
 * —— 为什么没有上报 endpoint：这是自我观察 / 日记式探索，不是上线指标。
 *   用控制台 `window.__fileNodeStats()` 现场看就够了。
 *
 * —— 卸载步骤（2 周后）：
 *     1. 删除此文件
 *     2. `rg bumpTelemetry` 移除 3 处调用（每处都带 `[telemetry]` 注释）
 *     3. 在控制台执行 localStorage.removeItem('canvas.file-node-telemetry.v1')
 */

const STORAGE_KEY = 'canvas.file-node-telemetry.v1';

export type TelemetryKey =
  | 'fileNodeCreated'
  | 'fileNodeConnectedAsImageSource'
  | 'img2imgFromFileNode'
  | 'img2imgFromImageNode';

interface Snapshot {
  /** 第一次 bump 的时间戳；用于计算观察窗已跑了多久。 */
  firstBumpAt: number;
  /** 最近一次 bump，便于判断是不是老数据。 */
  lastBumpAt: number;
  counters: Record<TelemetryKey, number>;
}

function emptySnapshot(): Snapshot {
  return {
    firstBumpAt: 0,
    lastBumpAt: 0,
    counters: {
      fileNodeCreated: 0,
      fileNodeConnectedAsImageSource: 0,
      img2imgFromFileNode: 0,
      img2imgFromImageNode: 0,
    },
  };
}

function load(): Snapshot {
  if (typeof localStorage === 'undefined') return emptySnapshot();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptySnapshot();
    const parsed = JSON.parse(raw) as Partial<Snapshot>;
    return {
      ...emptySnapshot(),
      ...parsed,
      counters: { ...emptySnapshot().counters, ...(parsed.counters || {}) },
    };
  } catch {
    return emptySnapshot();
  }
}

let state = load();

/** 节流写盘：连续 bump 合并到下一 tick，避免拖拽 / 批量连线时打爆 setItem。 */
let saveScheduled = false;
function saveLater() {
  if (saveScheduled) return;
  saveScheduled = true;
  const run = () => {
    saveScheduled = false;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // quota / privacy mode — 观察性埋点无所谓，让它静默失败
    }
  };
  if (typeof queueMicrotask === 'function') queueMicrotask(run);
  else Promise.resolve().then(run);
}

/** 节流打印：5 分钟内只输出一次 summary，避免刷屏。 */
let logTimer: ReturnType<typeof setTimeout> | null = null;
function schedulePeriodicLog() {
  if (logTimer !== null) return;
  logTimer = setTimeout(() => {
    logTimer = null;
    printSummary('[file-node-telemetry] periodic summary');
  }, 5 * 60 * 1000);
}

export function bumpTelemetry(key: TelemetryKey, delta = 1) {
  const now = Date.now();
  if (state.firstBumpAt === 0) state.firstBumpAt = now;
  state.lastBumpAt = now;
  state.counters[key] = (state.counters[key] || 0) + delta;
  saveLater();
  schedulePeriodicLog();
}

function pct(num: number, den: number): string {
  if (den <= 0) return '—';
  return `${((num / den) * 100).toFixed(0)}%`;
}

export function printSummary(label: string = '[file-node-telemetry] snapshot') {
  const { counters, firstBumpAt, lastBumpAt } = state;
  const observedHours =
    firstBumpAt > 0 ? ((lastBumpAt - firstBumpAt) / 3600_000).toFixed(1) : '0';
  const img2imgTotal =
    counters.img2imgFromFileNode + counters.img2imgFromImageNode;
  const connRate = pct(counters.fileNodeConnectedAsImageSource, counters.fileNodeCreated);
  const fileShare = pct(counters.img2imgFromFileNode, img2imgTotal);

  // groupCollapsed：默认折叠，不打扰其它调试输出
  // eslint-disable-next-line no-console
  console.groupCollapsed(`${label} · 观察 ${observedHours}h`);
  // eslint-disable-next-line no-console
  console.log('counters', counters);
  // eslint-disable-next-line no-console
  console.log(`file → generator 连接率: ${connRate}（目标 ≥ 40%）`);
  // eslint-disable-next-line no-console
  console.log(`img2img 中 file 源占比: ${fileShare}（目标 ≥ 50%）`);
  // eslint-disable-next-line no-console
  console.groupEnd();
}

export function resetTelemetry() {
  state = emptySnapshot();
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  // eslint-disable-next-line no-console
  console.log('[file-node-telemetry] reset');
}

export function getTelemetrySnapshot(): Snapshot {
  return {
    firstBumpAt: state.firstBumpAt,
    lastBumpAt: state.lastBumpAt,
    counters: { ...state.counters },
  };
}

// 开发期暴露到 window，便于你在控制台随时 `__fileNodeStats()` 捞快照。
if (typeof window !== 'undefined') {
  const w = window as unknown as Record<string, unknown>;
  w.__fileNodeStats = () => {
    printSummary('[file-node-telemetry] manual dump');
    return getTelemetrySnapshot();
  };
  w.__fileNodeStatsReset = resetTelemetry;
  // 延迟一点打印，避免和 app 启动日志挤在一起
  setTimeout(() => {
    printSummary('[file-node-telemetry] session start');
  }, 1500);
}

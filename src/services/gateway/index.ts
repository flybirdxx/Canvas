import { useSettingsStore } from '@/store/useSettingsStore';
import { RunningHubProvider } from './providers/runninghub';
import { T8StarProvider } from './providers/t8star';
import type {
  Capability,
  GatewayProvider,
  ImageGenRequest,
  ImageGenResult,
  ModelDescriptor,
  ProviderRuntimeConfig,
  TextGenRequest,
  TextGenResult,
  VideoGenRequest,
  VideoGenResult,
} from './types';

/**
 * Provider registry — single source of truth for the rest of the app.
 *
 * UI layers call {@link listModels} to populate dropdowns, and the service
 * layer calls {@link generateImageByModelId} to route a request to the right
 * provider. Settings modal calls {@link listProviders} to render its tabs.
 *
 * Providers are statically registered here; adding a new vendor is a single
 * import + push away, no UI changes needed.
 */
const PROVIDERS: GatewayProvider[] = [
  T8StarProvider,
  RunningHubProvider,
];

export function listProviders(): GatewayProvider[] {
  return PROVIDERS;
}

export function getProvider(providerId: string): GatewayProvider | undefined {
  return PROVIDERS.find(p => p.id === providerId);
}

/** All models across all providers that declare the given capability. */
export function listModels(capability: Capability): ModelDescriptor[] {
  const out: ModelDescriptor[] = [];
  for (const p of PROVIDERS) {
    for (const m of p.models) {
      if (m.capability === capability) out.push(m);
    }
  }
  return out;
}

/** Resolve a wire-level model id to its descriptor + owning provider. */
export function findModel(modelId: string): { model: ModelDescriptor; provider: GatewayProvider } | undefined {
  for (const p of PROVIDERS) {
    const m = p.models.find(x => x.id === modelId);
    if (m) return { model: m, provider: p };
  }
  return undefined;
}

/**
 * 查本次调用的**单价**（不是总价）。UI 按 count 乘出来做总价显示。
 *
 * 语义：
 *   - `pricing.flat` 存在  → 直接用 flat 价（适合一口价渠道）
 *   - 视频模型矩阵（`matrix` 顶层 key 为分辨率）→ 按 resolution 直接查
 *   - 图像模型矩阵（`matrix` 顶层 key 为 qualityLevel）→ 按 (qualityLevel, resolution) 查
 *   - 模型没有 pricing → undefined（UI 徽章显示 '—'）
 *
 * 输入容错：resolution / qualityLevel 大小写无关，统一转小写后再查表。
 */
export function computeUnitPrice(
  model: ModelDescriptor,
  args: { resolution?: string; qualityLevel?: string },
): { amount: number; currency: string } | undefined {
  const p = model.pricing;
  if (!p) return undefined;
  if (typeof p.flat === 'number') {
    return { amount: p.flat, currency: p.currency };
  }
  if (p.matrix) {
    const res = (args.resolution ?? '720p').toLowerCase();
    const keys = Object.keys(p.matrix);
    if (keys.length === 0) return undefined;
    const firstKey = keys[0] ?? '';
    // 判断矩阵是 flat（key 为分辨率）还是带 qualityLevel 的二维矩阵
    const firstVal = (p.matrix as unknown as Record<string, unknown>)[firstKey];
    if (typeof firstVal === 'number') {
      // flat 矩阵：顶层 key 就是分辨率（如视频模型）
      const val = (p.matrix as Record<string, number>)[res];
      if (typeof val === 'number') return { amount: val, currency: p.currency };
    } else {
      // 二维矩阵：顶层 key 是 qualityLevel（如图像模型）
      const level = (args.qualityLevel ?? 'medium').toLowerCase();
      const row = (p.matrix as Record<string, Record<string, number>>)[level];
      const val = row ? row[res] : undefined;
      if (typeof val === 'number') return { amount: val, currency: p.currency };
    }
  }
  return undefined;
}

/**
 * Pull the live runtime config (apiKey, baseUrl) for a provider from the
 * settings store. Always returns a config object — providers without any
 * stored entry (e.g. the video preview stub) get an empty shell, and each
 * provider's `generateImage`/`generateVideo` decides whether it actually
 * needs credentials (returning a structured `missingKey` failure if so).
 */
export function readProviderConfig(providerId: string): ProviderRuntimeConfig {
  const cfg = useSettingsStore.getState().providers[providerId];
  if (!cfg) return { apiKey: '', baseUrl: '' };
  return { apiKey: cfg.apiKey, baseUrl: cfg.baseUrl };
}

/**
 * Convenience wrapper used by {@link imageGeneration.runGeneration}.
 * Never throws — unknown model / missing config surface as structured failures.
 */
export async function generateImageByModelId(
  req: ImageGenRequest,
): Promise<ImageGenResult> {
  const found = findModel(req.model);
  if (!found) {
    return {
      ok: false,
      kind: 'unknown',
      message: `未知模型：${req.model}`,
    };
  }
  if (!found.provider.generateImage) {
    return {
      ok: false,
      kind: 'unknown',
      message: `${found.provider.name} 不支持图像生成`,
    };
  }
  const config = readProviderConfig(found.provider.id);
  return found.provider.generateImage(req, config);
}

/**
 * 按 provider id + taskId 对异步图像任务做一次性查询。用于启动时
 * 恢复未完成的 pending placeholder。结果含 'pending' 变体时表示任务仍在
 * 跑，caller 应保留 pendingTask 以待下次启动再查。
 */
export async function pollImageTaskByProviderId(
  providerId: string,
  taskId: string,
): Promise<ImageGenResult> {
  const provider = getProvider(providerId);
  if (!provider) {
    return { ok: false, kind: 'unknown', message: `未知 provider：${providerId}` };
  }
  if (!provider.pollImageTask) {
    return {
      ok: false,
      kind: 'unknown',
      message: `${provider.name} 不支持异步任务恢复（缺少 pollImageTask 实现）`,
    };
  }
  const config = readProviderConfig(providerId);
  return provider.pollImageTask(taskId, config);
}

/**
 * Video counterpart of {@link generateImageByModelId}. Same contract: never
 * throws, surfaces structured failures for missing model / capability / key.
 */
export async function generateVideoByModelId(
  req: VideoGenRequest,
): Promise<VideoGenResult> {
  const found = findModel(req.model);
  if (!found) {
    return {
      ok: false,
      kind: 'unknown',
      message: `未知模型：${req.model}`,
    };
  }
  if (!found.provider.generateVideo) {
    return {
      ok: false,
      kind: 'unknown',
      message: `${found.provider.name} 不支持视频生成`,
    };
  }
  const config = readProviderConfig(found.provider.id);
  return found.provider.generateVideo(req, config);
}

/**
 * Text counterpart of {@link generateImageByModelId}. Same contract: never
 * throws, surfaces structured failures for missing model / capability / key.
 */
/**
 * TODO(A4): 异步视频任务查询（pollVideoTaskByProviderId）。
 * 模式对齐 pollImageTaskByProviderId — 按 providerId + taskId 查询，
 * 返回 VideoGenResult，含 'pending' 变体表示任务仍在跑。
 * 接入异步视频 provider 时取消注释并实现。
 * export async function pollVideoTaskByProviderId(
 *   providerId: string,
 *   taskId: string,
 * ): Promise<VideoGenResult> { ... }
 */

export async function generateTextByModelId(
  req: TextGenRequest,
): Promise<TextGenResult> {
  const found = findModel(req.model);
  if (!found) {
    return {
      ok: false,
      kind: 'unknown',
      message: `未知模型：${req.model}`,
    };
  }
  if (!found.provider.generateText) {
    return {
      ok: false,
      kind: 'unknown',
      message: `${found.provider.name} 不支持文本生成`,
    };
  }
  const config = readProviderConfig(found.provider.id);
  return found.provider.generateText(req, config);
}

export type {
  Capability,
  GatewayProvider,
  ModelDescriptor,
  ImageGenRequest,
  ImageGenResult,
  TextGenRequest,
  TextGenResult,
  VideoGenRequest,
  VideoGenResult,
} from './types';

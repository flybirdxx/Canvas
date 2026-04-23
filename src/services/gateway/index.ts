import { useSettingsStore } from '../../store/useSettingsStore';
import { RunningHubProvider } from './providers/runninghub';
import { T8StarProvider } from './providers/t8star';
import type {
  Capability,
  GatewayProvider,
  ImageGenRequest,
  ImageGenResult,
  ModelDescriptor,
  ProviderRuntimeConfig,
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

export type {
  Capability,
  GatewayProvider,
  ModelDescriptor,
  ImageGenRequest,
  ImageGenResult,
  VideoGenRequest,
  VideoGenResult,
} from './types';

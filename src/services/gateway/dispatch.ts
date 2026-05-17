import { findModel, getProvider } from './providerRegistry';
import { readProviderConfig } from './runtimeConfig';
import type {
  ImageGenRequest,
  ImageGenResult,
  TextGenRequest,
  TextGenResult,
  VideoGenRequest,
  VideoGenResult,
} from './types';

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
      message: `${provider.name} 不支持异步图像任务恢复（缺少 pollImageTask 实现）`,
    };
  }
  const config = readProviderConfig(providerId);
  return provider.pollImageTask(taskId, config);
}

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

export async function pollVideoTaskByProviderId(
  providerId: string,
  taskId: string,
): Promise<VideoGenResult> {
  const provider = getProvider(providerId);
  if (!provider) {
    return { ok: false, kind: 'unknown', message: `未知 provider：${providerId}` };
  }
  if (!provider.pollVideoTask) {
    return {
      ok: false,
      kind: 'unknown',
      message: `${provider.name} 不支持异步视频任务恢复（缺少 pollVideoTask 实现）`,
    };
  }
  const config = readProviderConfig(providerId);
  return provider.pollVideoTask(taskId, config);
}

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

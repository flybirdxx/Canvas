import type { GatewayProvider } from '@/services/gateway/types';
import { RUNNING_HUB_MODELS } from './models';
import { generateRunningHubImage, pollRunningHubImageTask } from './image';
import { generateRunningHubVideo, pollRunningHubVideoTask } from './video';
import { generateRunningHubText } from './text';

export const RunningHubProvider: GatewayProvider = {
  id: 'runninghub',
  name: 'RunningHub',
  capabilities: ['image', 'video', 'text'],
  auth: 'bearer',
  authHint: '异步任务模型，提交后轮询查询；图生参考图会自动经 imgbb 托管',
  models: RUNNING_HUB_MODELS,
  generateImage: generateRunningHubImage,
  pollImageTask: pollRunningHubImageTask,
  generateVideo: generateRunningHubVideo,
  pollVideoTask: pollRunningHubVideoTask,
  generateText: generateRunningHubText,
};

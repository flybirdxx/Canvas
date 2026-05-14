import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ApiProvider {
  apiKey: string;
  baseUrl: string;
}

/**
 * 图床配置。目前仅接入 imgbb：
 *   - enabled: 是否在 Provider 返回图像后自动上传到 imgbb 拿稳定外链，
 *              关闭则按 Provider 原始返回（data URL 或临时 URL）落盘。
 *   - apiKey:  imgbb 的个人密钥，文档 https://api.imgbb.com/ 。
 */
export interface ImgHostConfig {
  enabled: boolean;
  apiKey: string;
}

interface SettingsState {
  providers: Record<string, ApiProvider>;
  imgHost: ImgHostConfig;
  updateProvider: (providerId: string, settings: Partial<ApiProvider>) => void;
  updateImgHost: (settings: Partial<ImgHostConfig>) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      providers: {
        t8star: {
          apiKey: '',
          baseUrl: 'https://ai.t8star.cn',
        },
        runninghub: {
          apiKey: '',
          baseUrl: 'https://www.runninghub.cn',
        },
      },
      imgHost: {
        enabled: false,
        apiKey: '',
      },
      updateProvider: (providerId, settings) =>
        set((state) => ({
          providers: {
            ...state.providers,
            [providerId]: {
              ...state.providers[providerId],
              ...settings,
            },
          },
        })),
      updateImgHost: (settings) =>
        set((state) => ({
          imgHost: { ...state.imgHost, ...settings },
        })),
    }),
    {
      name: 'canvas-api-settings', // unique name for localStorage key
      version: 5,
      migrate: (persistedState: any, version: number) => {
        // v1 -> v2: 引入 imgHost 配置。既有用户没有这个字段，补齐默认值。
        if (version < 2 && persistedState && typeof persistedState === 'object') {
          if (!persistedState.imgHost) {
            persistedState.imgHost = { enabled: false, apiKey: '' };
          }
        }
        // v2 -> v3: 新增 runninghub provider，给老用户补默认 baseUrl 和空 key。
        if (version < 3 && persistedState && typeof persistedState === 'object') {
          if (!persistedState.providers) persistedState.providers = {};
          if (!persistedState.providers.runninghub) {
            persistedState.providers.runninghub = {
              apiKey: '',
              baseUrl: 'https://www.runninghub.cn',
            };
          }
        }
        // v3 -> v4: 清理从未真实对接过的占位 provider（openai / anthropic）。
        // 老用户如果之前填过 key 也一并丢弃——未来真正接入时再提示重填，避免
        // 现在下拉里列着"配了 key 却仍不可用"的模型这种矛盾态。
        if (version < 4 && persistedState && typeof persistedState === 'object') {
          if (persistedState.providers) {
            delete persistedState.providers.openai;
            delete persistedState.providers.anthropic;
          }
        }
        // v4 -> v5: 不再内置或默认启用第三方图床 key。
        if (version < 5 && persistedState && typeof persistedState === 'object') {
          persistedState.imgHost = { enabled: false, apiKey: '' };
        }
        return persistedState;
      },
    }
  )
);

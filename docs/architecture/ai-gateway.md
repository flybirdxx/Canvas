# AI Provider 网关接口规范

## 设计目标

将 UI 层与具体 AI 厂商完全解耦。上层代码只与 `GatewayProvider` 接口对话，新增 Provider 只需：一个文件实现接口 + 一行数组注册 + (可选) SettingsModal 配置项。UI 无感知。

错误统一收口为结构化返回——Provider 层绝不 throw，所有异常转 `{ok: false, kind, message}`。

## 核心接口：GatewayProvider

```typescript
interface GatewayProvider {
  id: string;              // 唯一标识，如 't8star' / 'runninghub'
  name: string;            // 人类可读名称
  capabilities: Capability[];  // 声明的能力：'image' | 'video' | 'text'
  models: ModelDescriptor[];   // 该 Provider 提供的全部模型
  auth: AuthScheme;           // 'bearer' | 'x-api-key' | 'none'
  authHint?: string;          // SettingsModal 中的认证说明文字

  // 图像生成（可选，按 capabilities 声明）
  generateImage?(req: ImageGenRequest, config: ProviderRuntimeConfig): Promise<ImageGenResult>;

  // 视频生成（可选）
  generateVideo?(req: VideoGenRequest, config: ProviderRuntimeConfig): Promise<VideoGenResult>;

  // 异步任务状态查询（仅 RunningHub 类 provider 需要）
  pollImageTask?(taskId: string, config: ProviderRuntimeConfig): Promise<ImageGenResult>;
}
```

## 模型描述符：ModelDescriptor

```typescript
interface ModelDescriptor {
  id: string;                    // 线级模型名，如 "gpt-image-2"
  providerId: string;            // 所属 Provider
  capability: Capability;        // 能力类型
  label: string;                 // UI 显示名
  caption?: string;              // 副标题
  supportsSize?: boolean;        // 是否支持 WxH 自由尺寸（false 时隐藏分辨率下拉）
  supportsN?: boolean;           // 是否支持单次调用返回多图
  supportedAspects?: string[];   // 支持的宽高比列表（如 ['1:1','16:9']）
  supportedResolutions?: string[]; // 支持的分辨率档位（['1K','2K','4K']）
  supportedQualityLevels?: string[]; // 支持的质量档位（['low','medium','high']）
  pricing?: ModelPricing;        // 单价
}
```

### 单价 ModelPricing

两种模式，查询优先级：`flat` > `matrix[qualityLevel][resolution]` > `undefined`（UI 降级显示 `—`）

```typescript
interface ModelPricing {
  currency: string;     // '¥' | '$'
  flat?: number;        // 一口价（所有档位同价）
  matrix?: Record<string, Record<string, number>>;  // { qualityLevel: { resolution: price } }
}
```

## 请求/响应契约

### 图像生成

```typescript
interface ImageGenRequest {
  model: string;           // 线级模型 id
  prompt: string;
  size: string;            // "WxH"
  aspect?: string;         // '1:1' / '16:9' ...
  resolution?: string;     // '1K' / '2K' / '4K' / 'auto'
  qualityLevel?: string;   // 'low' / 'medium' / 'high'
  n: number;               // 张数
  referenceImages?: string[];  // 参考图（img2img）
  maskImage?: string;          // 局部重绘蒙版（PNG data URL）
  onTaskSubmitted?(info: { providerId: string; taskId: string }): void;  // 异步任务提交回调
}

type ImageGenResult =
  | { ok: true;  urls: string[] }                           // 成功：每个 URL 对应一张生成的图
  | { ok: false; kind: GatewayErrorKind; message: string; detail?: string }  // 失败
  | { ok: 'pending'; providerId: string; taskId: string };  // 异步：任务排队中
```

### GatewayErrorKind

| kind | 含义 | 示例场景 |
|------|------|----------|
| `missingKey` | API Key 未配置或无效 | SettingsModal 中未填写 |
| `network` | 网络请求失败 | DNS/超时/CORS |
| `server` | 服务端返回错误 | 5xx / 模型超载 |
| `empty` | 返回成功但内容为空 | 生成结果列表为 [] |
| `unknown` | 其他未分类错误 | 模型不存在 / 不支持该操作 |

### 视频生成

```typescript
interface VideoGenRequest {
  model: string;
  prompt: string;
  size: string;
  durationSec: number;    // 时长（秒）
  seedImage?: string;     // 种子帧（i2v）
}

type VideoGenResult =
  | { ok: true;  urls: string[] }
  | { ok: false; kind: GatewayErrorKind; message: string; detail?: string };
```

## 已接入 Provider

| Provider | ID | 能力 | 认证方式 | 生成模式 | 特色 |
|----------|-----|------|----------|----------|------|
| T8Star | `t8star` | image | Bearer | 同步 | 支持 n>1 多图、自由尺寸、多种宽高比 |
| RunningHub | `runninghub` | image | Bearer | 异步 | 支持质量×分辨率矩阵定价、pollImageTask 恢复 |

## 接入新 Provider 步骤

1. 新建 `src/services/gateway/providers/<name>.ts`
2. 实现 `GatewayProvider` 接口（至少实现 `generateImage` 或 `generateVideo`）
3. 在 `gateway/index.ts` 的 `PROVIDERS` 数组中注册
4. （可选）在 `SettingsModal` 的 ProviderTabs 中添加配置 UI 卡片
5. （可选）声明 `pricing` 后 UI 自动展示费用预估徽章

注意事项：
- 异步 Provider（如 RunningHub）需要实现 `pollImageTask` 并触发 `onTaskSubmitted` 回调
- 不支持的参数应静默忽略（不报错），例如 t8star 收到 `qualityLevel` 直接无视
- 不支持的操作（如无 inpainting 能力却收到 `maskImage`）应返回 `kind: 'unknown'` 的明确错误

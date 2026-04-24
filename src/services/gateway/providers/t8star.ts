import { useSettingsStore } from '../../../store/useSettingsStore';
import { uploadBatchToImgbb } from '../../imgHost/imgbb';
import type {
  GatewayProvider,
  ImageGenRequest,
  ImageGenResult,
  ProviderRuntimeConfig,
} from '../types';

/**
 * t8star AI gateway —— 本项目当前接入的第一家真实 Provider。
 *
 * 协议参考：apifox 上的 gpt-image-2 Generations 文档，OpenAI DALL·E 风格
 *   POST  {baseUrl}/v1/images/generations
 *   POST  {baseUrl}/v1/images/edits            (image[] 非空时走此端点)
 *   Header: Authorization: Bearer {apiKey}
 *   Body (JSON, generations):
 *     { model, prompt, size, n?, response_format? }
 *   Body (multipart, edits):
 *     model / prompt / size / n? / response_format? / image[] / mask?
 *
 * 尺寸约束（文档强制）:
 *   - 最大边长 ≤ 3840px
 *   - 两边均为 16 的倍数（"auto" 不做校验）
 *   - 长:短 ≤ 3:1
 *   - 总像素 [655360, 8294400]
 *
 * 输出策略:
 *   - 请求时显式带 `response_format=b64_json`，避免依赖代理返回的短时 URL；
 *   - 拿到 b64/url 之后走 imgbb 转稳定外链（见 services/imgHost/imgbb）；
 *   - imgbb 未配置或失败时回退到原始源，保证节点至少能显示。
 */
export const T8StarProvider: GatewayProvider = {
  id: 't8star',
  name: 't8star AI',
  capabilities: ['image'],
  auth: 'bearer',
  authHint: '与 OpenAI Images 兼容，Bearer Token 放 Authorization 头；默认经 imgbb 转存',
  // 目前只对接了 gpt-image-2（官方 OpenAPI 文档有效）。其他挂在 t8star 上的
  // 模型若将来按 gpt-image-2 同协议对接，只要在此追加一条 ModelDescriptor 即可
  // ——前端下拉、设置面板、错误路径都不用动。
  //
  // label 直接使用 wire-level 模型名，避免 t8star 侧的营销别名（"Lib Nano Pro"
  // 之类）让用户误以为 t8star 有独立模型体系。
  models: [
    {
      id: 'gpt-image-2',
      providerId: 't8star',
      capability: 'image',
      label: 'gpt-image-2',
      caption: 'OpenAI DALL·E 协议兼容',
      supportsSize: true,
      supportsN: true,
      // 与 NodeInputBar 的 IMAGE_SIZE_PRESETS 严格一致，避免 UI 出现实际
      // 不在 preset 表里的 aspect。
      supportedAspects: ['1:1', '16:9', '9:16', '4:3', '3:4'],
    },
  ],

  async generateImage(req: ImageGenRequest, config: ProviderRuntimeConfig): Promise<ImageGenResult> {
    if (!config.apiKey) {
      return { ok: false, kind: 'missingKey', message: '请先在设置中配置 t8star 的 API 密钥' };
    }

    // gpt-image-2 有硬性 size 约束，不合法就直接告诉用户，而不是把 400 甩回用户
    // 的错误面板里（用户看到 "size not multiple of 16" 之类的英文原文体验很糟）。
    const sizeCheck = validateSize(req.size, req.model);
    if (sizeCheck.ok === false) {
      return { ok: false, kind: 'unknown', message: sizeCheck.message };
    }

    const hasMask = typeof req.maskImage === 'string' && req.maskImage.length > 0;
    const hasRefs = (req.referenceImages?.length ?? 0) > 0;

    if (hasMask) {
      if (!hasRefs) {
        return { ok: false, kind: 'unknown', message: '局部重绘需要原图作为参考' };
      }
      return postProcess(await runEdits(config, req), 'edit');
    }
    if (hasRefs) {
      return postProcess(await runEdits(config, req), 'edit');
    }
    return postProcess(await runGenerations(config, req), 'gen');
  },
};

/**
 * 本地 size 校验，按文档严格对齐：
 *   - 允许字面量 "auto"
 *   - 否则必须能被解析成 "{w}x{h}" 两个整数
 *   - 16 整除 / 最大边 / 比例 / 总像素 四条约束全部满足
 *
 * 这里对 gpt-image-2 最严格；其他模型（sd-xl/flux-pro）一般更宽松，但 t8star
 * 网关最终还是按 gpt-image-2 约束转发，所以统一按严格版走，UX 更可预期。
 */
function validateSize(size: string, _model: string): { ok: true } | { ok: false; message: string } {
  if (!size || size === 'auto') return { ok: true };
  const m = size.match(/^(\d+)x(\d+)$/i);
  if (!m) return { ok: false, message: `尺寸格式非法：${size}，应为 "WxH" 或 "auto"` };
  const w = Number(m[1]);
  const h = Number(m[2]);
  if (!(w > 0) || !(h > 0)) return { ok: false, message: `尺寸非正：${size}` };
  if (w % 16 !== 0 || h % 16 !== 0) {
    return { ok: false, message: `尺寸 ${size} 不满足 16 的倍数约束` };
  }
  if (Math.max(w, h) > 3840) {
    return { ok: false, message: `最大边长 ${Math.max(w, h)} 超出 3840 上限` };
  }
  const ratio = Math.max(w, h) / Math.min(w, h);
  if (ratio > 3.0 + 1e-6) {
    return { ok: false, message: `长短比 ${ratio.toFixed(2)} 超出 3:1 上限` };
  }
  const pixels = w * h;
  if (pixels < 655360) {
    return { ok: false, message: `总像素 ${pixels} 低于 655360 下限` };
  }
  if (pixels > 8294400) {
    return { ok: false, message: `总像素 ${pixels} 超出 8294400 上限` };
  }
  return { ok: true };
}

/** /v1/images/generations —— 纯文生图，JSON body。 */
async function runGenerations(
  config: ProviderRuntimeConfig,
  req: ImageGenRequest,
): Promise<ImageGenResult> {
  const url = `${config.baseUrl}/v1/images/generations`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: req.model,
        prompt: req.prompt,
        size: req.size,
        n: req.n,
        // 显式要 b64_json：避免代理返回的临时 URL 过几分钟就失效导致节点裂图。
        // 即便 Provider 忽略该字段也不要紧，parseImageBody 会兼容两种返回。
        response_format: 'b64_json',
      }),
    });
  } catch (e: any) {
    return {
      ok: false,
      kind: 'network',
      message: '网络请求失败',
      detail: buildNetworkErrorDetail(url, e),
    };
  }
  return parseImageBody(response);
}

/**
 * /v1/images/edits —— 多模态 edits 端点。文档写明"兼容 edits 接口所有参数
 * 透传"，所以把 image[] / mask / response_format 全部走 multipart 发出去。
 */
async function runEdits(
  config: ProviderRuntimeConfig,
  req: ImageGenRequest,
): Promise<ImageGenResult> {
  const form = new FormData();
  form.append('model', req.model);
  form.append('prompt', req.prompt);
  form.append('size', req.size);
  form.append('n', String(req.n));
  form.append('response_format', 'b64_json');

  for (const url of req.referenceImages ?? []) {
    const ref = await urlToBlob(url);
    if (!ref) {
      return {
        ok: false,
        kind: 'network',
        message: '无法读取参考图数据',
        detail: `URL: ${url.slice(0, 120)}${url.length > 120 ? '…' : ''}`,
      };
    }
    form.append('image', ref.blob, ref.filename);
  }
  if (req.maskImage) {
    const mask = await urlToBlob(req.maskImage);
    if (!mask) {
      return { ok: false, kind: 'network', message: '无法读取蒙版数据' };
    }
    form.append('mask', mask.blob, 'mask.png');
  }

  const url = `${config.baseUrl}/v1/images/edits`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        // Content-Type 交给浏览器填 multipart 边界，不要手写。
      },
      body: form,
    });
  } catch (e: any) {
    return {
      ok: false,
      kind: 'network',
      message: '网络请求失败',
      detail: buildNetworkErrorDetail(url, e),
    };
  }
  return parseImageBody(response);
}

/**
 * 统一解析 OpenAI Images 风格响应。兼容两种返回：
 *   - { data: [{ url }] }            —— response_format=url
 *   - { data: [{ b64_json: "..." }]} —— response_format=b64_json
 * 其它字段原样透传，交给上层错误面板展示。
 */
async function parseImageBody(response: Response): Promise<ImageGenResult> {
  if (!response.ok) {
    const parsed = await parseErrorBody(response);
    return { ok: false, kind: 'server', message: parsed.message, detail: parsed.detail };
  }

  let data: any;
  try {
    data = await response.json();
  } catch (e: any) {
    return {
      ok: false,
      kind: 'empty',
      message: '响应解析失败',
      detail: e?.message ? String(e.message) : undefined,
    };
  }

  const items: any[] = Array.isArray(data?.data) ? data.data : [];
  const urls = items
    .map((item: any) =>
      item?.url || (item?.b64_json ? `data:image/png;base64,${item.b64_json}` : ''),
    )
    .filter((u: string) => !!u);

  if (urls.length === 0) {
    return { ok: false, kind: 'empty', message: '接口未返回图像', detail: safeStringify(data) };
  }
  return { ok: true, urls };
}

/**
 * 统一的后处理：成功结果里的每张图都过一遍 imgbb。
 * 关键点：**不放大错误面**——imgbb 挂了也把原始源透传出去，让节点先看到图。
 */
async function postProcess(
  result: ImageGenResult,
  kind: 'gen' | 'edit',
): Promise<ImageGenResult> {
  // 注意：现在 ImageGenResult 有第三种 'pending' 变体，t8star 作为同步 provider
  // 永远不会走到 pending 分支；但为了类型正确，只对 ok === true 做后处理，
  // 其它（failure / 理论上的 pending）原样透传。
  if (result.ok !== true) return result;
  const { imgHost } = useSettingsStore.getState();
  if (!imgHost?.enabled || !imgHost.apiKey) return result;

  const { urls } = await uploadBatchToImgbb(result.urls, imgHost.apiKey, {
    namePrefix: `t8star-${kind}-${Date.now()}`,
  });
  return { ok: true, urls };
}

async function urlToBlob(url: string): Promise<{ blob: Blob; filename: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const ext = (blob.type.split('/')[1] || 'png').replace(/[^a-z0-9]/gi, '') || 'png';
    return { blob, filename: `reference.${ext}` };
  } catch {
    return null;
  }
}

async function parseErrorBody(res: Response): Promise<{ message: string; detail?: string }> {
  try {
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      const msg =
        json?.error?.message ||
        json?.error?.code ||
        json?.message ||
        `${res.status} ${res.statusText || 'Request failed'}`;
      return { message: String(msg), detail: text };
    } catch {
      return {
        message: `${res.status} ${res.statusText || 'Request failed'}`,
        detail: text || undefined,
      };
    }
  } catch {
    return { message: `${res.status} ${res.statusText || 'Request failed'}` };
  }
}

function safeStringify(v: unknown): string | undefined {
  try {
    return JSON.stringify(v).slice(0, 500);
  } catch {
    return undefined;
  }
}

/**
 * 拼一条能让人自诊断的"fetch 抛异常"详情。
 *
 * 背景：浏览器在下列任一情况下都会把 fetch() 直接抛成 `TypeError: Failed to
 * fetch`，而不给任何 HTTP 状态：
 *   - CORS 预检被拒（服务端没发 Access-Control-Allow-Origin）
 *   - DNS 解析失败 / 主机不可达
 *   - HTTPS 页面访问 HTTP 资源（mixed content）
 *   - 浏览器扩展 / 代理 / VPN 拦截
 *   - Base URL 配错（协议缺失、路径错位）
 *
 * 这几种我们在代码层都区分不出来——catch 到的异常信息几乎恒定是
 * "Failed to fetch"。所以给用户一条完整的候选清单，帮他们在 Network
 * 面板对照排查，比只说"检查网络或 Base URL"实用得多。
 */
function buildNetworkErrorDetail(url: string, e: any): string {
  const rawMsg = e?.message ? String(e.message) : String(e ?? 'unknown');
  const lines = [
    `URL: ${url}`,
    `错误: ${rawMsg}`,
    '',
    '常见原因（按可能性排序）：',
    '  1. 浏览器 CORS 拦截——服务端未对本页面 origin 放行，Network 面板会看到',
    '     一条红色 preflight 或被 blocked 的请求。需服务端加 Access-Control-* 头。',
    '  2. VPN / 代理 / 企业网关把请求吞掉；换网络或关代理复测。',
    '  3. Base URL 配置错（拼错、多/少斜杠、协议缺失）；去设置面板确认。',
    '  4. 服务临时不可用；直接在浏览器访问 URL 看是否 200。',
    '  5. 浏览器扩展（广告拦截 / 隐私插件）阻断；在隐私窗口复测。',
  ];
  return lines.join('\n');
}

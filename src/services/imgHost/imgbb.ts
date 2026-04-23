/**
 * imgbb 图床上传器
 *
 * 作用：把 Provider 返回的 b64_json / 远端 URL 统一转换成 imgbb 的**稳定外链**，
 * 避免两个具体问题：
 *   1. data URL 写进 localStorage 会把节点状态爆炸式放大；
 *   2. 逆向代理返回的原始 URL 通常在几分钟内失效，节点上的图过一会就裂掉。
 *
 * 文档: https://api.imgbb.com/
 * 端点: POST https://api.imgbb.com/1/upload
 *   form-data:
 *     key       <imgbb API key，可通过 query 或 form 两处传；此处走 form，避免 URL 里暴露>
 *     image     <base64 string 或 http(s) URL；**不要带 `data:image/…;base64,` 前缀**>
 *     name      <可选，展示文件名>
 *
 * 成功响应:
 *   {
 *     data: { url, display_url, delete_url, ... },
 *     success: true,
 *     status: 200
 *   }
 */

export interface ImgHostSuccess {
  ok: true;
  /** imgbb 返回的直链，形如 https://i.ibb.co/.../file.png，可长期使用。 */
  url: string;
}

export interface ImgHostFailure {
  ok: false;
  reason: 'missingKey' | 'network' | 'decode' | 'server';
  message: string;
  /** 原始来源，调用方可以兜底使用以保证图片先能显示。 */
  fallbackUrl?: string;
}

export type ImgHostResult = ImgHostSuccess | ImgHostFailure;

const IMGBB_ENDPOINT = 'https://api.imgbb.com/1/upload';

/**
 * 上传一张图到 imgbb。
 *
 * 输入 `source` 可以是：
 *   - data URL，如 `data:image/png;base64,iVBORw...`（Provider response_format=b64_json）
 *   - 纯 base64 字符串（不带前缀）
 *   - http(s) URL（Provider response_format=url；imgbb 自己会拉）
 *
 * 任何网络/解码失败都会返回结构化错误，并在 `fallbackUrl` 里回填原始 source，
 * 调用方可以选择"上传失败时原样透传"以保证 UX 不断。
 */
/**
 * 确保 `source` 是一个**公网可访问的 http(s) URL**：
 *   - http(s) URL → 原样返回，**不再消耗一次 imgbb 上传**；
 *   - data URL / 裸 base64 → 走 imgbb，换成稳定外链。
 *
 * 专为 RunningHub 这类"参考图只接受 URL"的 provider 准备：
 * NodeInputBar 里用户拖进来的图可能是 `data:image/…;base64,…`，
 * 这种直接发给 RunningHub 会被拒，所以先在这里兜一层。
 */
export async function ensurePublicUrl(
  source: string,
  apiKey: string,
  opts?: { name?: string; expirationSec?: number },
): Promise<ImgHostResult> {
  if (!source) {
    return { ok: false, reason: 'decode', message: '空的图像源' };
  }
  // 已经是 http(s) 公网链接时直接返回，不额外走上传。
  if (/^https?:\/\//i.test(source)) {
    return { ok: true, url: source };
  }
  return uploadToImgbb(source, apiKey, opts);
}

export async function uploadToImgbb(
  source: string,
  apiKey: string,
  opts?: { name?: string; expirationSec?: number },
): Promise<ImgHostResult> {
  if (!apiKey) {
    return {
      ok: false,
      reason: 'missingKey',
      message: '图床 key 未配置，已保留原始链接',
      fallbackUrl: source,
    };
  }
  if (!source) {
    return { ok: false, reason: 'decode', message: '空的图像源' };
  }

  // imgbb 的 image 字段要求：base64 就传"裸 base64"；URL 就传整个 URL 字符串。
  // 所以这里只剥掉 data URL 前缀，其它一律原样交给 imgbb。
  let payloadImage = source;
  const dataUrlMatch = source.match(/^data:[^;]+;base64,(.+)$/);
  if (dataUrlMatch) payloadImage = dataUrlMatch[1];

  const form = new FormData();
  form.append('key', apiKey);
  form.append('image', payloadImage);
  if (opts?.name) form.append('name', opts.name);
  if (opts?.expirationSec && opts.expirationSec > 0) {
    form.append('expiration', String(opts.expirationSec));
  }

  let response: Response;
  try {
    response = await fetch(IMGBB_ENDPOINT, { method: 'POST', body: form });
  } catch (e: any) {
    return {
      ok: false,
      reason: 'network',
      message: '图床请求失败，已保留原始链接',
      fallbackUrl: source,
    };
  }

  if (!response.ok) {
    let detail = '';
    try { detail = await response.text(); } catch { /* ignore */ }
    return {
      ok: false,
      reason: 'server',
      message: `图床返回 ${response.status}，已保留原始链接${detail ? `（${detail.slice(0, 120)}）` : ''}`,
      fallbackUrl: source,
    };
  }

  let data: any;
  try {
    data = await response.json();
  } catch {
    return {
      ok: false,
      reason: 'decode',
      message: '图床响应解析失败，已保留原始链接',
      fallbackUrl: source,
    };
  }

  const url: string | undefined = data?.data?.url ?? data?.data?.display_url;
  if (!url) {
    return {
      ok: false,
      reason: 'decode',
      message: '图床未返回直链，已保留原始链接',
      fallbackUrl: source,
    };
  }
  return { ok: true, url };
}

/**
 * 批量上传辅助：把 Provider 返回的多张图**并发**上传到 imgbb。
 *
 * 失败处理策略：单张失败时，回落到原始 source（data URL / 原 URL），
 * 保证至少节点上能先显示出来，不会因为图床抖动就整个批次 fail。
 */
export async function uploadBatchToImgbb(
  sources: string[],
  apiKey: string,
  opts?: { namePrefix?: string; expirationSec?: number },
): Promise<{ urls: string[]; anyFailed: boolean; failures: ImgHostFailure[] }> {
  const results = await Promise.all(
    sources.map((src, i) =>
      uploadToImgbb(src, apiKey, {
        name: opts?.namePrefix ? `${opts.namePrefix}-${i + 1}` : undefined,
        expirationSec: opts?.expirationSec,
      }),
    ),
  );
  const urls: string[] = [];
  const failures: ImgHostFailure[] = [];
  for (let i = 0; i < results.length; i++) {
    const r: ImgHostResult = results[i];
    if (r.ok === true) {
      urls.push(r.url);
    } else {
      const fail: ImgHostFailure = r;
      failures.push(fail);
      // 优先兜底原始源，保证至少节点能看到图，不为图床拖累主流程。
      urls.push(fail.fallbackUrl ?? sources[i]);
    }
  }
  return { urls, anyFailed: failures.length > 0, failures };
}

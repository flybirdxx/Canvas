import type { ImageGenFailure } from '@/services/gateway/types';
import { buildRhNetworkErrorDetail, parseErrorBody } from './errors';

export async function uploadLocalFileToRunningHub(
  fileData: string,
  filename: string,
  apiKey: string,
  baseUrl: string,
): Promise<{ ok: true; downloadUrl: string } | ImageGenFailure> {
  let mimeType = 'application/octet-stream';
  let data = fileData;
  if (/^data:image\//i.test(fileData)) {
    const match = fileData.match(/^data:([^;]+);/);
    if (match) mimeType = match[1];
    data = fileData.replace(/^data:[^;]+;base64,/, '');
  } else if (/^data:video\//i.test(fileData)) {
    const match = fileData.match(/^data:([^;]+);/);
    if (match) mimeType = match[1];
    data = fileData.replace(/^data:[^;]+;base64,/, '');
  }
  if (/^https?:\/\//i.test(fileData)) {
    return { ok: true, downloadUrl: fileData };
  }

  let decoded: string;
  try {
    decoded = atob(data);
  } catch {
    return { ok: false, kind: 'empty', message: `无法解码 base64 文件：${filename}` };
  }

  const bytes = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);

  const boundary = `----rh-${Date.now().toString(16)}`;
  const parts: Uint8Array[] = [];
  const encoder = new TextEncoder();
  parts.push(
    encoder.encode(`--${boundary}\r\n`),
    encoder.encode(`Content-Disposition: form-data; name="file"; filename="${filename}"\r\n`),
    encoder.encode(`Content-Type: ${mimeType}\r\n\r\n`),
    bytes,
    encoder.encode(`\r\n--${boundary}--\r\n`),
  );

  const totalLen = parts.reduce((sum, part) => sum + part.length, 0);
  const combined = new Uint8Array(totalLen);
  let offset = 0;
  for (const part of parts) {
    combined.set(part, offset);
    offset += part.length;
  }

  let resp: Response;
  try {
    resp = await fetch(`${baseUrl}/openapi/v2/media/upload/binary`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: combined,
    });
  } catch (e: unknown) {
    return {
      ok: false,
      kind: 'network',
      message: 'RunningHub 文件上传请求失败',
      detail: buildRhNetworkErrorDetail(`${baseUrl}/openapi/v2/media/upload/binary`, e),
    };
  }

  if (!resp.ok) {
    const parsed = await parseErrorBody(resp);
    return { ok: false, kind: 'server', message: `RunningHub 文件上传失败：${parsed.message}`, detail: parsed.detail };
  }

  let json: unknown;
  try {
    json = await resp.json();
  } catch {
    return { ok: false, kind: 'empty', message: 'RunningHub 上传响应解析失败' };
  }

  const payload = json as {
    code?: number;
    msg?: string;
    errorMessage?: string;
    message?: string;
    data?: { download_url?: string };
  };
  if (payload?.code !== 0) {
    const msg = payload?.msg ?? payload?.errorMessage ?? payload?.message ?? '上传失败';
    return { ok: false, kind: 'server', message: `RunningHub 文件上传失败：${msg}` };
  }

  const downloadUrl = payload?.data?.download_url?.trim();
  if (!downloadUrl) return { ok: false, kind: 'empty', message: 'RunningHub 上传未返回 download_url' };
  return { ok: true, downloadUrl };
}

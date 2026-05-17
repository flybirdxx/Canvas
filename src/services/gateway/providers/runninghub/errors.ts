export async function parseErrorBody(res: Response): Promise<{ message: string; detail?: string }> {
  try {
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      const msg =
        json?.errorMessage ||
        json?.error?.message ||
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

export function safeStringify(v: unknown): string | undefined {
  try {
    return JSON.stringify(v).slice(0, 500);
  } catch {
    return undefined;
  }
}

export function buildRhNetworkErrorDetail(url: string, e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e ?? 'unknown');
  return [
    `URL: ${url}`,
    `错误: ${msg}`,
    '',
    '常见原因：CORS 拦截、网络代理、Base URL 配置错误、服务临时不可用或浏览器扩展拦截。',
  ].join('\n');
}

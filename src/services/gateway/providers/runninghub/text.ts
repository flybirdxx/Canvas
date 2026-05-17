import type {
  ProviderRuntimeConfig,
  TextGenRequest,
  TextGenResult,
} from '@/services/gateway/types';

export async function generateRunningHubText(
  req: TextGenRequest,
  config: ProviderRuntimeConfig,
): Promise<TextGenResult> {
  if (!config.apiKey) {
    return { ok: false, kind: 'missingKey', message: 'RunningHub API Key 未配置' };
  }

  if (req.videoFileRef && !req.videoUrl && !req.videoDataUrl) {
    return {
      ok: false,
      kind: 'empty',
      message: '视频文件尚未加载，请重新连接上游 video/file 节点后再分析。',
    };
  }

  const endpoint = 'https://llm.runninghub.ai/v1/chat/completions';
  const body = {
    model: req.model,
    messages: buildRunningHubTextMessages(req),
    max_tokens: req.maxTokens ?? 4096,
    temperature: req.temperature ?? 0.7,
    top_p: 1,
  };

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: req.signal,
    });
  } catch (error: unknown) {
    return {
      ok: false,
      kind: 'network',
      message: 'LLM 网络请求失败',
      detail: buildNetworkErrorDetail(endpoint, error),
    };
  }

  if (!response.ok) {
    const parsed = await parseErrorBody(response);
    return { ok: false, kind: 'server', message: parsed.message, detail: parsed.detail };
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    return { ok: false, kind: 'empty', message: 'LLM 响应解析失败' };
  }

  const payload = data as {
    choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }>;
    error?: { message?: string; code?: string };
  };

  if (payload.error) {
    return {
      ok: false,
      kind: 'server',
      message: payload.error.message ?? payload.error.code ?? 'LLM 服务返回错误',
      detail: safeStringify(payload.error),
    };
  }

  const rawContent: unknown = payload.choices?.[0]?.message?.content;
  let content = '';
  if (typeof rawContent === 'string') {
    content = String(rawContent);
  } else if (Array.isArray(rawContent)) {
    content = rawContent.map(item => item.text).filter(Boolean).join('\n');
  }

  if (!content) {
    return {
      ok: false,
      kind: 'empty',
      message: 'LLM 未返回文本内容',
      detail: safeStringify(data),
    };
  }

  return { ok: true, text: content };
}

export function buildRunningHubTextMessages(req: TextGenRequest): TextGenRequest['messages'] {
  const videoSource = req.videoDataUrl || req.videoUrl;
  if (!videoSource) return req.messages;

  const messages = req.messages.map(message => ({ ...message }));
  const lastUserIndex = findLastUserMessageIndex(messages);
  if (lastUserIndex === -1) {
    return [
      ...messages,
      {
        role: 'user',
        content: [
          { type: 'text', text: '' },
          { type: 'video_url', video_url: { url: videoSource } },
        ],
      },
    ];
  }

  const userMessage = messages[lastUserIndex];
  const text = typeof userMessage.content === 'string'
    ? userMessage.content
    : Array.isArray(userMessage.content)
      ? userMessage.content
        .filter(part => part.type === 'text')
        .map(part => part.text)
        .join('\n')
      : '';

  messages[lastUserIndex] = {
    ...userMessage,
    content: [
      { type: 'text', text },
      { type: 'video_url', video_url: { url: videoSource } },
    ],
  };
  return messages;
}

function findLastUserMessageIndex(messages: TextGenRequest['messages']): number {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.role === 'user') return i;
  }
  return -1;
}

async function parseErrorBody(response: Response): Promise<{ message: string; detail?: string }> {
  try {
    const text = await response.text();
    try {
      const json = JSON.parse(text);
      const message =
        json?.errorMessage ||
        json?.error?.message ||
        json?.error?.code ||
        json?.message ||
        `${response.status} ${response.statusText || 'Request failed'}`;
      return { message: String(message), detail: text };
    } catch {
      return {
        message: `${response.status} ${response.statusText || 'Request failed'}`,
        detail: text || undefined,
      };
    }
  } catch {
    return { message: `${response.status} ${response.statusText || 'Request failed'}` };
  }
}

function safeStringify(value: unknown): string | undefined {
  try {
    return JSON.stringify(value).slice(0, 500);
  } catch {
    return undefined;
  }
}

function buildNetworkErrorDetail(url: string, error: unknown): string {
  const rawMessage = error instanceof Error ? error.message : String(error ?? 'unknown');
  return [
    `URL: ${url}`,
    `错误: ${rawMessage}`,
    '',
    '常见原因：CORS 拦截、网络代理、Base URL 配置错误、服务临时不可用或浏览器扩展拦截。',
  ].join('\n');
}

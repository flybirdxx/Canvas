import { afterEach, describe, expect, it, vi } from 'vitest';
import { RunningHubProvider } from './runninghub';

const config = {
  apiKey: 'test-key',
  baseUrl: 'https://www.runninghub.ai',
};

describe('RunningHubProvider.generateText', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('sends inline video data URLs as OpenAI-compatible video_url content parts', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: '{"segments":[],"structuredScript":[],"highlights":[]}' } }],
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await RunningHubProvider.generateText?.({
      model: 'google/gemini-3.1-flash-lite-preview',
      messages: [
        { role: 'system', content: 'system prompt' },
        { role: 'user', content: 'analyze this video' },
      ],
      videoDataUrl: 'data:video/mp4;base64,AAAA',
    }, config);

    expect(result?.ok).toBe(true);
    const body = getLastRequestBody(fetchMock);
    expect(body.messages[1].content).toEqual([
      { type: 'text', text: 'analyze this video' },
      { type: 'video_url', video_url: { url: 'data:video/mp4;base64,AAAA' } },
    ]);
    expect(body.top_p).toBe(1);
    expect(body).not.toHaveProperty('reasoning_effort');
  });

  it('does not send invalid none reasoning effort to OpenAI-compatible text APIs', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: 'ok' } }],
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await RunningHubProvider.generateText?.({
      model: 'deepseek/deepseek-v4-flash',
      messages: [{ role: 'user', content: 'write' }],
    }, config);

    expect(result).toEqual({ ok: true, text: 'ok' });
    const body = getLastRequestBody(fetchMock);
    expect(body).not.toHaveProperty('reasoning_effort');
  });

  it('sends remote video URLs as video_url content parts without rejecting locally', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: 'ok' } }],
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await RunningHubProvider.generateText?.({
      model: 'google/gemini-3.1-flash-lite-preview',
      messages: [{ role: 'user', content: 'analyze' }],
      videoUrl: 'https://example.com/video.mp4',
    }, config);

    expect(result).toEqual({ ok: true, text: 'ok' });
    const body = getLastRequestBody(fetchMock);
    expect(body.messages[0].content[1]).toEqual({
      type: 'video_url',
      video_url: { url: 'https://example.com/video.mp4' },
    });
  });
});

describe('RunningHubProvider.generateVideo', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('returns structured failure when video task submission fails', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('network down');
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await RunningHubProvider.generateVideo?.({
      model: 'sparkvideo-2.0-text',
      prompt: '生成一个短视频',
      size: '16:9',
      durationSec: 5,
    }, config);

    expect(result).toMatchObject({
      ok: false,
      kind: 'network',
      message: 'RunningHub 任务提交失败',
    });
  });

  it('returns successful video URLs from polling without re-parsing provider result wrappers', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ taskId: 'task-1' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        status: 'SUCCESS',
        results: [{ url: 'https://cdn.example.com/video.mp4' }],
      }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const promise = RunningHubProvider.generateVideo?.({
      model: 'sparkvideo-2.0-text',
      prompt: '生成一个短视频',
      size: '16:9',
      durationSec: 5,
    }, config);

    await vi.advanceTimersByTimeAsync(2000);
    await expect(promise).resolves.toEqual({
      ok: true,
      urls: ['https://cdn.example.com/video.mp4'],
    });
  });
});

function getLastRequestBody(fetchMock: ReturnType<typeof vi.fn>) {
  const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
  expect(init?.body).toBeTruthy();
  return JSON.parse(String(init?.body));
}

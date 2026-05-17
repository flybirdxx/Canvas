import { afterEach, describe, expect, it, vi } from 'vitest';
import { RunningHubProvider } from './runninghub';

const config = {
  apiKey: 'test-key',
  baseUrl: 'https://www.runninghub.ai',
};

describe('RunningHubProvider.generateText', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
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

function getLastRequestBody(fetchMock: ReturnType<typeof vi.fn>) {
  const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
  expect(init?.body).toBeTruthy();
  return JSON.parse(String(init?.body));
}

import { describe, expect, it } from 'vitest';
import { analyzeVideoToOmniScript, buildOmniScriptTextRequest, parseOmniScriptResult } from './omniscript';

describe('parseOmniScriptResult', () => {
  it('extracts the three OmniScript report columns from model JSON', () => {
    const parsed = parseOmniScriptResult(`
      {
        "segments": [{"time": "00:00-00:03", "summary": "Hook opens on a product close-up"}],
        "structuredScript": [{"time": "00:00", "visual": "Fast zoom", "audio": "Beat drop", "copy": "One-line hook"}],
        "highlights": [{"time": "00:02", "reason": "Pattern interrupt"}]
      }
    `);

    expect(parsed).toEqual({
      segments: [{ time: '00:00-00:03', summary: 'Hook opens on a product close-up' }],
      structuredScript: [{ time: '00:00', visual: 'Fast zoom', audio: 'Beat drop', copy: 'One-line hook' }],
      highlights: [{ time: '00:02', reason: 'Pattern interrupt' }],
    });
  });

  it('returns a readable parse error for non-json model output', () => {
    const parsed = parseOmniScriptResult('not json');

    expect(parsed.ok).toBe(false);
    if (parsed.ok === false) {
      expect(parsed.message).toContain('OmniScript');
      expect(parsed.message).toContain('JSON');
    }
  });
});

describe('analyzeVideoToOmniScript', () => {
  it('includes user notes in the OmniScript prompt', () => {
    const request = buildOmniScriptTextRequest({
      model: 'mock-video-model',
      videoUrl: 'https://example.com/video.mp4',
      notes: '重点观察前三秒钩子',
    });

    expect(request.messages[1]?.content).toContain('用户补充要求：重点观察前三秒钩子');
    expect(request.messages[1]?.content).not.toContain('?{');
  });

  it('returns an explicit unsupported error instead of pretending to analyze video', async () => {
    const result = await analyzeVideoToOmniScript({
      model: 'mock-text-only',
      videoUrl: 'https://example.com/video.mp4',
      notes: 'Analyze the cover pattern',
      generateText: async () => ({
        ok: false,
        kind: 'unknown',
        message: 'Provider does not support video understanding',
      }),
    });

    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.message).toContain('视频理解');
    }
  });
});

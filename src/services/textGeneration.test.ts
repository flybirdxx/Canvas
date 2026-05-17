import { beforeEach, describe, expect, it, vi } from 'vitest';

import { runTextGeneration } from './textGeneration';
import { generateTextByModelId } from './gateway';
import { useCanvasStore } from '@/store/useCanvasStore';
import { useGenerationHistoryStore } from '@/store/useGenerationHistoryStore';
import type { TextElement } from '@/types/canvas';

vi.mock('./gateway', () => ({
  generateTextByModelId: vi.fn(),
}));

function makeTextNode(): TextElement {
  return {
    id: 'text-1',
    type: 'text',
    x: 0,
    y: 0,
    width: 420,
    height: 280,
    text: '旧文本',
    prompt: '写一场雪夜戏',
    fontSize: 14,
    fontFamily: 'var(--font-serif)',
    fill: '#26211c',
  };
}

describe('runTextGeneration', () => {
  beforeEach(() => {
    vi.mocked(generateTextByModelId).mockReset();
    useCanvasStore.setState({
      elements: [makeTextNode()],
      selectedIds: [],
      connections: [],
      groups: [],
      past: [],
      future: [],
      currentLabel: '初始状态',
      currentTimestamp: 0,
      _coalesceKey: undefined,
      _coalesceAt: undefined,
      inpaintMask: null,
    } as Partial<ReturnType<typeof useCanvasStore.getState>>);
    useGenerationHistoryStore.setState({ entries: [] });
  });

  it('sends an optional system prompt before the user prompt', async () => {
    vi.mocked(generateTextByModelId).mockResolvedValue({ ok: true, text: '新文本' });
    const setIsGenerating = vi.fn();

    await runTextGeneration({
      elementId: 'text-1',
      prompt: '续写这场戏',
      model: 'text-model',
      systemPrompt: '完整编剧系统提示',
      setIsGenerating,
    });

    expect(generateTextByModelId).toHaveBeenCalledWith({
      model: 'text-model',
      messages: [
        { role: 'system', content: '完整编剧系统提示' },
        { role: 'user', content: '续写这场戏' },
      ],
    });
    expect(setIsGenerating).toHaveBeenLastCalledWith(false);
  });
});

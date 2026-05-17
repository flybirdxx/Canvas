import { describe, expect, it } from 'vitest';

import { BUILTIN_PRESETS, PROMPT_CATEGORIES } from './promptLibrary';
import {
  SCREENWRITING_MASTER_TEMPLATE_PRESET_SNIPPET,
  SCREENWRITING_REWRITE_PRESET_SNIPPET,
} from '@/services/screenwriting';

describe('promptLibrary', () => {
  it('exposes a text-only screenwriting rewrite preset', () => {
    const preset = BUILTIN_PRESETS.find(item => item.id === 'text-screenwriting-rewrite');

    expect(PROMPT_CATEGORIES.some(category => category.id === 'writing')).toBe(true);
    expect(preset).toMatchObject({
      category: 'writing',
      title: '剧本优化续写',
      modes: ['text'],
      snippet: SCREENWRITING_REWRITE_PRESET_SNIPPET,
    });
  });

  it('exposes the full screenwriting template as a separate text-only option', () => {
    const preset = BUILTIN_PRESETS.find(item => item.id === 'text-screenwriting-master-template');

    expect(preset).toMatchObject({
      category: 'writing',
      title: '完整编剧模板',
      modes: ['text'],
      snippet: SCREENWRITING_MASTER_TEMPLATE_PRESET_SNIPPET,
    });
  });
});

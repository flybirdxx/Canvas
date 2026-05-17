import { describe, expect, it } from 'vitest';

import {
  SCREENWRITING_MASTER_SYSTEM_PROMPT,
  SCREENWRITING_MASTER_TEMPLATE_PRESET_ID,
  SCREENWRITING_MASTER_TEMPLATE_PRESET_SNIPPET,
  SCREENWRITING_REWRITE_PRESET_SNIPPET,
  buildScreenwritingRewritePrompt,
  isScreenwritingMasterTemplatePreset,
} from './screenwriting';

describe('screenwriting prompts', () => {
  it('builds a concrete script-doctor rewrite prompt from source text', () => {
    const prompt = buildScreenwritingRewritePrompt('女主在雪夜发现父亲失踪真相。');

    expect(prompt).toContain('剧本优化续写');
    expect(prompt).toContain('女主在雪夜发现父亲失踪真相。');
    expect(prompt).toContain('场景标题');
    expect(prompt).toContain('视觉动作');
    expect(prompt).toContain('对白');
    expect(prompt).toContain('节奏拍点');
    expect(prompt).toContain('不要写心理描写');
    expect(prompt).toContain('不要用角色台词解释设定或主题');
  });

  it('keeps the preset compact enough for repeated node use', () => {
    expect(SCREENWRITING_REWRITE_PRESET_SNIPPET).toContain('剧本优化续写');
    expect(SCREENWRITING_REWRITE_PRESET_SNIPPET).toContain('动作即潜台词');
    expect(SCREENWRITING_REWRITE_PRESET_SNIPPET.length).toBeLessThan(1800);
  });

  it('exposes the full screenwriting template as a separate optional preset', () => {
    expect(SCREENWRITING_MASTER_TEMPLATE_PRESET_ID).toBe('text-screenwriting-master-template');
    expect(SCREENWRITING_MASTER_TEMPLATE_PRESET_SNIPPET).toContain('完整编剧模板');
    expect(SCREENWRITING_MASTER_SYSTEM_PROMPT).toContain('<screenwriting_master_system>');
    expect(SCREENWRITING_MASTER_SYSTEM_PROMPT).toContain('山音超级编剧大师');
    expect(SCREENWRITING_MASTER_SYSTEM_PROMPT).toContain('核心铁律');
    expect(SCREENWRITING_MASTER_SYSTEM_PROMPT.length).toBeGreaterThan(50_000);
    expect(isScreenwritingMasterTemplatePreset(SCREENWRITING_MASTER_TEMPLATE_PRESET_ID)).toBe(true);
    expect(isScreenwritingMasterTemplatePreset('text-screenwriting-rewrite')).toBe(false);
  });
});

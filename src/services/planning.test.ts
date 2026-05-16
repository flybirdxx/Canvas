import { describe, expect, it } from 'vitest';
import {
  buildShortDramaPlanningPrompt,
  normalizePlanningResponse,
  parsePlanningJson,
} from './planning';

describe('planning service', () => {
  it('normalizes story bible, characters, plots, and requirements', () => {
    const normalized = normalizePlanningResponse({
      storyBible: {
        title: '雪夜旧债',
        body: '一个旧债引爆家族短剧。',
      },
      characters: [
        {
          title: '林晚',
          body: '女主，追查父亲失踪。',
          plotResponsibility: '在旧仓库节点揭示怀表线索。',
        },
      ],
      plots: [
        {
          title: '旧仓库发现怀表',
          body: '林晚发现带血怀表。',
          requirements: [
            {
              title: '血色怀表特写',
              materialType: 'prop',
              description: '只露出怀表上的家族标识。',
              necessity: '没有它，后续线索反转无法执行。',
            },
          ],
        },
      ],
    });

    expect(normalized.storyBible.title).toBe('雪夜旧债');
    expect(normalized.characters[0].body).toContain('剧情职责');
    expect(normalized.plots[0].requirements[0]).toMatchObject({
      title: '血色怀表特写',
      materialType: 'prop',
      status: 'pending',
    });
  });

  it('builds a restrained short-drama planning prompt', () => {
    const prompt = buildShortDramaPlanningPrompt('一句想法：女主在雪夜发现父亲失踪真相');

    expect(prompt).toContain('短剧项目模板');
    expect(prompt).toContain('不要列出低价值素材');
    expect(prompt).toContain('只输出 JSON');
  });

  it('parses fenced JSON blocks', () => {
    const parsed = parsePlanningJson([
      '模型说明：',
      '```ts',
      'const x = 1;',
      '```',
      '```json',
      '{"storyBible":{"title":"雨夜重逢","body":"失散亲人重逢。"},"characters":[],"plots":[]}',
      '```',
    ].join('\n'));

    expect(parsed.storyBible).toMatchObject({
      title: '雨夜重逢',
      body: '失散亲人重逢。',
    });
  });

  it('uses defaults when story bible, characters, or plots are missing', () => {
    const normalized = normalizePlanningResponse({});

    expect(normalized.storyBible.title).toBe('未命名短剧企划');
    expect(normalized.storyBible.body).toContain('暂无故事圣经');
    expect(normalized.characters).toEqual([]);
    expect(normalized.plots).toEqual([]);
  });

  it('falls back invalid material types to prop', () => {
    const normalized = normalizePlanningResponse({
      plots: [
        {
          requirements: [
            {
              title: '家族徽章',
              materialType: 'unknown-type',
            },
          ],
        },
      ],
    });

    expect(normalized.plots[0].requirements[0]).toMatchObject({
      title: '家族徽章',
      materialType: 'prop',
      status: 'pending',
    });
  });

  it('does not crash on invalid array members', () => {
    const normalized = normalizePlanningResponse({
      characters: [null],
      plots: [
        'x',
        {
          requirements: [1],
        },
      ],
    });

    expect(normalized.characters[0]).toMatchObject({
      title: '角色 1',
      body: '暂无角色说明。',
    });
    expect(normalized.plots[0]).toMatchObject({
      title: '剧情节点 1',
      body: '暂无剧情说明。',
      requirements: [],
    });
    expect(normalized.plots[1].requirements[0]).toMatchObject({
      title: '必要素材 1',
      materialType: 'prop',
      status: 'pending',
    });
  });
});

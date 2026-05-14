import { describe, expect, it } from 'vitest';
import { migrateCanvasPersistedState } from './migrations';

describe('migrateCanvasPersistedState', () => {
  it('converts legacy script nodes into omniscript nodes without creating scenes', () => {
    const migrated = migrateCanvasPersistedState({
      elements: [
        {
          id: 'script-1',
          type: 'script',
          x: 10,
          y: 20,
          width: 480,
          height: 280,
          markdown: '### 场 1：开场\n角色：台词',
          scenes: [{ sceneNum: 1, title: '开场', content: '角色：台词' }],
        },
      ],
      connections: [],
    }, 10);

    expect(migrated.elements).toHaveLength(1);
    expect(migrated.elements[0]).toMatchObject({
      id: 'script-1',
      type: 'omniscript',
      x: 10,
      y: 20,
      title: 'OmniScript',
    });
    expect(migrated.elements[0].result.structuredScript[0].copy).toContain('角色：台词');
  });

  it('downgrades legacy scene nodes to text nodes and drops scene connections', () => {
    const migrated = migrateCanvasPersistedState({
      elements: [
        { id: 'scene-1', type: 'scene', x: 10, y: 20, width: 320, height: 200, sceneNum: 1, title: '开场', content: '画面内容' },
        { id: 'image-1', type: 'image', x: 500, y: 20, width: 300, height: 300, src: '' },
      ],
      connections: [
        { id: 'c1', fromId: 'scene-1', fromPortId: 'out', toId: 'image-1', toPortId: 'in' },
      ],
    }, 10);

    expect(migrated.elements[0]).toMatchObject({
      id: 'scene-1',
      type: 'text',
      text: '开场\n\n画面内容',
    });
    expect(migrated.connections).toEqual([]);
  });
});

import { describe, it, expect } from 'vitest';
import { computeStoryboardDiff } from './storyboardSync';
import type { SceneElement, ParsedScene } from '../types/canvas';

describe('computeStoryboardDiff', () => {
  it('should identify scenes to add when no existing scenes exist', () => {
    const parsedScenes: ParsedScene[] = [
      { sceneNum: 1, title: 'Scene 1', content: 'Content 1' },
      { sceneNum: 2, title: 'Scene 2', content: 'Content 2' },
    ];
    
    const diff = computeStoryboardDiff('script-1', parsedScenes, [], 100, 100);
    
    expect(diff.scenesToAdd).toHaveLength(2);
    expect(diff.idsToDelete).toHaveLength(0);
    
    expect(diff.scenesToAdd[0].sceneNum).toBe(1);
    expect(diff.scenesToAdd[0].scriptId).toBe('script-1');
    expect(diff.scenesToAdd[1].sceneNum).toBe(2);
  });

  it('should identify orphaned scenes to delete', () => {
    const existingScenes: SceneElement[] = [
      { id: 's1', type: 'scene', x: 0, y: 0, width: 100, height: 100, sceneNum: 1, title: 'Old 1', scriptId: 'script-1' },
      { id: 's3', type: 'scene', x: 0, y: 0, width: 100, height: 100, sceneNum: 3, title: 'Old 3', scriptId: 'script-1' },
    ];
    
    const parsedScenes: ParsedScene[] = [
      { sceneNum: 1, title: 'Scene 1', content: 'Content 1' },
      { sceneNum: 2, title: 'Scene 2', content: 'Content 2' },
    ];
    
    const diff = computeStoryboardDiff('script-1', parsedScenes, existingScenes, 100, 100);
    
    expect(diff.scenesToAdd).toHaveLength(1);
    expect(diff.scenesToAdd[0].sceneNum).toBe(2);
    
    expect(diff.idsToDelete).toHaveLength(1);
    expect(diff.idsToDelete[0]).toBe('s3');
  });

  it('should do nothing if existing scenes perfectly match parsed scenes', () => {
    const existingScenes: SceneElement[] = [
      { id: 's1', type: 'scene', x: 0, y: 0, width: 100, height: 100, sceneNum: 1, title: 'Scene 1', scriptId: 'script-1' },
      { id: 's2', type: 'scene', x: 0, y: 0, width: 100, height: 100, sceneNum: 2, title: 'Scene 2', scriptId: 'script-1' },
    ];
    
    const parsedScenes: ParsedScene[] = [
      { sceneNum: 1, title: 'Scene 1 Modified', content: 'Content 1' },
      { sceneNum: 2, title: 'Scene 2', content: 'Content 2' },
    ];
    
    const diff = computeStoryboardDiff('script-1', parsedScenes, existingScenes, 100, 100);
    
    // Note: computeStoryboardDiff only diffs based on sceneNum. It does not update existing nodes' content.
    expect(diff.scenesToAdd).toHaveLength(0);
    expect(diff.idsToDelete).toHaveLength(0);
  });
});

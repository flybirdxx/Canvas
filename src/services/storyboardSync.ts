import { v4 as uuidv4 } from 'uuid';
import type { CanvasElement, ScriptElement, SceneElement, ParsedScene } from '@/types/canvas';

export interface SyncDiff {
  scenesToAdd: SceneElement[];
  idsToDelete: string[];
}

/**
 * Pure function: Computes the difference between script scenes and existing canvas scenes.
 * Returns what needs to be added and what needs to be deleted.
 */
export function computeStoryboardDiff(
  scriptId: string,
  parsedScenes: ParsedScene[],
  existingScenes: SceneElement[],
  scriptX: number,
  scriptY: number
): SyncDiff {
  const scriptSceneNums = new Set(parsedScenes.map(s => s.sceneNum));
  const existingSceneNums = new Set(existingScenes.map(s => s.sceneNum));

  const scenesToAdd: SceneElement[] = [];
  const VERTICAL_OFFSET = 40;
  let offsetIndex = existingScenes.length;

  for (const parsed of parsedScenes) {
    if (!existingSceneNums.has(parsed.sceneNum)) {
      const id = uuidv4();
      const baseWidth = 320;
      const baseHeight = 200;

      scenesToAdd.push({
        id,
        type: 'scene',
        x: scriptX + 60 + (offsetIndex % 2) * 30,
        y: scriptY + 320 + offsetIndex * VERTICAL_OFFSET,
        width: baseWidth,
        height: baseHeight,
        sceneNum: parsed.sceneNum,
        title: parsed.title,
        content: parsed.content,
        scriptId,
      });
      offsetIndex++;
    }
  }

  // Remove orphaned scene nodes
  const idsToDelete = existingScenes
    .filter(s => !scriptSceneNums.has(s.sceneNum))
    .map(s => s.id);

  return { scenesToAdd, idsToDelete };
}

/**
 * Pure function: Analyzes all script elements in the canvas and computes a global diff.
 */
export function syncAllScripts(elements: CanvasElement[]): SyncDiff {
  const scripts = elements.filter((el): el is ScriptElement => el.type === 'script');
  
  const allScenesToAdd: SceneElement[] = [];
  const allIdsToDelete: string[] = [];

  for (const script of scripts) {
    const existingScenes = elements.filter(
      (el): el is SceneElement => el.type === 'scene' && el.scriptId === script.id
    );

    const diff = computeStoryboardDiff(
      script.id,
      script.scenes,
      existingScenes,
      script.x,
      script.y
    );

    allScenesToAdd.push(...diff.scenesToAdd);
    allIdsToDelete.push(...diff.idsToDelete);
  }

  return { scenesToAdd: allScenesToAdd, idsToDelete: allIdsToDelete };
}

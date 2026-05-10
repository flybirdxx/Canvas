import { v4 as uuidv4 } from 'uuid';
import type { CanvasElement, ScriptElement, SceneElement, ParsedScene, ScriptLine } from '@/types/canvas';
import { parseSceneLines } from '@/utils/parseScript';

/** Attributes that may need updating on an already-existing scene. */
export interface SceneUpdate {
  id: string;
  title: string;
  content: string;
  lines?: ScriptLine[];
}

export interface SyncDiff {
  scenesToAdd: SceneElement[];
  /** CR-3: existing scene nodes whose title/content/lines changed upstream. */
  scenesToUpdate: SceneUpdate[];
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

  // Build lookup: sceneNum → existing SceneElement
  const existingByNum = new Map<number, SceneElement>();
  for (const s of existingScenes) existingByNum.set(s.sceneNum, s);

  const scenesToAdd: SceneElement[] = [];
  const scenesToUpdate: SceneUpdate[] = [];
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
        lines: parseSceneLines(parsed.content),
        scriptId,
      });
      offsetIndex++;
    } else {
      // CR-3: check if existing scene needs content update
      const existing = existingByNum.get(parsed.sceneNum);
      if (existing) {
        const titleChanged = existing.title !== parsed.title;
        const contentChanged = existing.content !== parsed.content;
        const linesChanged = JSON.stringify(existing.lines) !== JSON.stringify(parsed.lines);
        if (titleChanged || contentChanged || linesChanged) {
          scenesToUpdate.push({
            id: existing.id,
            title: parsed.title,
            content: parsed.content,
            lines: parsed.lines,
          });
        }
      }
    }
  }

  // Remove orphaned scene nodes
  const idsToDelete = existingScenes
    .filter(s => !scriptSceneNums.has(s.sceneNum))
    .map(s => s.id);

  return { scenesToAdd, scenesToUpdate, idsToDelete };
}

/**
 * Pure function: Analyzes all script elements in the canvas and computes a global diff.
 */
export function syncAllScripts(elements: CanvasElement[]): SyncDiff {
  const scripts = elements.filter((el): el is ScriptElement => el.type === 'script');
  
  const allScenesToAdd: SceneElement[] = [];
  const allScenesToUpdate: SceneUpdate[] = [];
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
    allScenesToUpdate.push(...diff.scenesToUpdate);
    allIdsToDelete.push(...diff.idsToDelete);
  }

  return { scenesToAdd: allScenesToAdd, scenesToUpdate: allScenesToUpdate, idsToDelete: allIdsToDelete };
}

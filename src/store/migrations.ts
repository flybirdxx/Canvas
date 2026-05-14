import { v4 as uuidv4 } from 'uuid';
import type { OmniScriptResult } from '@/services/omniscript';

export function migrateCanvasPersistedState(persistedState: any, version: number): any {
  if (!persistedState) return persistedState;

  // v1 -> v2: bump image/video node minimum dimensions
  if (version < 2 && Array.isArray(persistedState.elements)) {
    const MIN_W = 340;
    const MIN_H = 260;
    persistedState.elements = persistedState.elements.map((el: any) => {
      if (!el || (el.type !== 'image' && el.type !== 'video')) return el;
      if (typeof el.width !== 'number' || typeof el.height !== 'number') return el;
      if (el.width < MIN_W || el.height < MIN_H) {
        return { ...el, width: Math.max(el.width, 400), height: Math.max(el.height, 300) };
      }
      return el;
    });
  }

  // v2 -> v3: add image input port to existing image nodes
  if (version < 3 && Array.isArray(persistedState.elements)) {
    persistedState.elements = persistedState.elements.map((el: any) => {
      if (!el || el.type !== 'image') return el;
      const inputs = Array.isArray(el.inputs) ? el.inputs : [];
      const hasImageInput = inputs.some((p: any) => p && p.type === 'image');
      if (hasImageInput) return el;
      return { ...el, inputs: [...inputs, { id: uuidv4(), type: 'image', label: 'Ref' }] };
    });
  }

  // v3 -> v4: widen narrow nodes
  if (version < 4 && Array.isArray(persistedState.elements)) {
    const MIN_BY_TYPE: Record<string, number> = { image: 480, video: 520 };
    persistedState.elements = persistedState.elements.map((el: any) => {
      if (!el || typeof el.width !== 'number' || typeof el.height !== 'number') return el;
      const minW = MIN_BY_TYPE[el.type];
      if (!minW || el.width >= minW) return el;
      const scale = minW / el.width;
      return { ...el, width: minW, height: Math.round(el.height * scale) };
    });
  }

  // v6 -> v7: blob persistence migration for large file nodes.
  if (version < 7 && Array.isArray(persistedState.elements) && typeof window !== 'undefined') {
    const toMigrate: Array<{ id: string; dataUrl: string }> = [];
    persistedState.elements.forEach((el: any) => {
      if (
        el?.type === 'file' &&
        el?.persistence === 'data' &&
        el?.src &&
        el?.sizeBytes > 1 * 1024 * 1024
      ) {
        toMigrate.push({ id: el.id, dataUrl: el.src });
      }
    });
    if (toMigrate.length > 0) {
      window.__canvasBlobMigration = toMigrate;
    }
  }

  if (version < 8 && typeof persistedState.viewMode !== 'string') {
    persistedState.viewMode = 'canvas';
  }

  if (version < 9 && !Array.isArray(persistedState.groups)) {
    persistedState.groups = [];
  }

  // v10 -> v11: remove legacy storyboard nodes.
  if (version < 11 && Array.isArray(persistedState.elements)) {
    const legacyIds = new Set<string>();
    persistedState.elements = persistedState.elements.map((el: any) => {
      if (!el || typeof el !== 'object') return el;
      if (el.type === 'script') {
        legacyIds.add(el.id);
        return legacyScriptToOmniScript(el);
      }
      if (el.type === 'scene') {
        legacyIds.add(el.id);
        return legacySceneToText(el);
      }
      return el;
    });

    if (Array.isArray(persistedState.connections) && legacyIds.size > 0) {
      persistedState.connections = persistedState.connections.filter((conn: any) =>
        conn && !legacyIds.has(conn.fromId) && !legacyIds.has(conn.toId),
      );
    }
    persistedState.viewMode = 'canvas';
  }

  return persistedState;
}

function legacyScriptToOmniScript(el: any): any {
  const result = legacyScriptResult(el);
  return {
    ...el,
    type: 'omniscript',
    title: el.title || 'OmniScript',
    width: Math.max(Number(el.width) || 0, 520),
    height: Math.max(Number(el.height) || 0, 360),
    videoUrl: '',
    notes: el.markdown || '',
    model: el.generation?.model || '',
    analysisStatus: result.structuredScript.length > 0 ? 'success' : 'idle',
    result,
    error: undefined,
    markdown: undefined,
    scenes: undefined,
    isNew: undefined,
    inputs: [{ id: uuidv4(), type: 'video', label: 'Video' }],
    outputs: [{ id: uuidv4(), type: 'text', label: 'Report' }],
  };
}

function legacySceneToText(el: any): any {
  const text = [el.title, el.content].filter(Boolean).join('\n\n');
  return {
    ...el,
    type: 'text',
    text,
    width: Math.max(Number(el.width) || 0, 320),
    height: Math.max(Number(el.height) || 0, 180),
    fontSize: 18,
    fontFamily: 'Inter, system-ui, sans-serif',
    fill: '#26211c',
    inputs: [],
    outputs: [{ id: uuidv4(), type: 'text', label: 'Text' }],
    sceneNum: undefined,
    sourceSceneNum: undefined,
    title: undefined,
    content: undefined,
    lines: undefined,
    summary: undefined,
    analysisNote: undefined,
    linkedImageId: undefined,
    scriptId: undefined,
  };
}

function legacyScriptResult(el: any): OmniScriptResult {
  const scenes = Array.isArray(el.scenes) ? el.scenes : [];
  return {
    segments: scenes.map((scene: any) => ({
      time: scene.sceneNum ? `场 ${scene.sceneNum}` : undefined,
      summary: [scene.title, scene.content].filter(Boolean).join('：'),
    })).filter((item: any) => item.summary),
    structuredScript: scenes.map((scene: any) => ({
      time: scene.sceneNum ? `场 ${scene.sceneNum}` : undefined,
      visual: scene.title || undefined,
      copy: scene.content || scene.title || '',
    })).filter((item: any) => item.copy),
    highlights: [],
  };
}

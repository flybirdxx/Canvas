/**
 * ZIP import utility for the canvas.
 *
 * Data flow:
 *   File input → JSZip.loadAsync(zip)
 *   canvas.json → parseCanvasJson()
 *   src-map.json → remap element src values to restored blobs
 *   elements → restoreElements() → canvasStore.addElement()
 *   connections → restoreConnections() → canvasStore.addConnection()
 *   groups → restoreGroups() → canvasStore.state.groups splice
 */
import JSZip from 'jszip';
import { useCanvasStore } from '@/store/useCanvasStore';
import type { CanvasElement, Connection } from '@/types/canvas';
import type { GroupRecord } from '@/store/useCanvasStore';

const uuidv4 = () => crypto.randomUUID();

interface CanvasJsonV1 {
  version: number;
  exportedAt: string;
  elements: CanvasElement[];
  connections: Connection[];
  groups: GroupRecord[];
}

interface SrcMapEntry {
  elementId: string;
  zipPath: string | null;
  reason?: string;
}

interface SrcMap {
  version: number;
  mappings: SrcMapEntry[];
}

/** Result of parsing a ZIP file */
export interface ParsedCanvas {
  elements: CanvasElement[];
  connections: Connection[];
  groups: GroupRecord[];
  exportedAt: string;
  nodeCount: number;
  connectionCount: number;
  skippedConnections: number;
  /** JSZip instance for restoring assets */
  zip: JSZip;
  srcMap: SrcMapEntry[];
}

function migrateVersion(parsed: CanvasJsonV1): CanvasJsonV1 {
  // Future versions can be migrated here:
  // if (parsed.version === 1) { /* migrate v1 → current */ }
  // else if (parsed.version === 2) { /* migrate v2 → current */ }
  if (parsed.version !== 1) {
    throw new Error(
      `不支持的画布版本: v${parsed.version}。请升级 AI Canvas 到最新版本后重试。`
    );
  }
  return parsed;
}

/**
 * Parse a ZIP file and extract canvas.json + src-map.json.
 * Throws on invalid ZIP, missing canvas.json, or unsupported version.
 */
export async function parseZipFile(file: File): Promise<ParsedCanvas> {
  const zip = await JSZip.loadAsync(file);

  const canvasJsonFile = zip.file('canvas.json');
  if (!canvasJsonFile) {
    throw new Error('ZIP 文件中未找到 canvas.json');
  }

  const raw = await canvasJsonFile.async('string');
  let parsed: CanvasJsonV1;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('canvas.json 格式无效');
  }

  const migrated = migrateVersion(parsed);

  // Read src-map.json if present
  const srcMapFile = zip.file('src-map.json');
  let srcMap: SrcMapEntry[] = [];
  if (srcMapFile) {
    try {
      const srcMapRaw = await srcMapFile.async('string');
      const srcMapParsed: SrcMap = JSON.parse(srcMapRaw);
      srcMap = srcMapParsed.mappings ?? [];
    } catch {
      // Non-fatal: old ZIP without src-map
    }
  }

  return {
    elements: migrated.elements ?? [],
    connections: migrated.connections ?? [],
    groups: migrated.groups ?? [],
    exportedAt: migrated.exportedAt ?? '',
    nodeCount: migrated.elements?.length ?? 0,
    connectionCount: migrated.connections?.length ?? 0,
    skippedConnections: 0,
    zip,
    srcMap,
  };
}

/** Build a new CanvasElement from an old one with fresh IDs */
function buildNewElement(
  oldEl: CanvasElement,
  newId: string,
  srcRemap?: Map<string, string>,
): CanvasElement {
  const base: any = {
    ...oldEl,
    id: newId,
    inputs: (oldEl.inputs ?? []).map((p: any) => ({ ...p, id: uuidv4() })),
    outputs: (oldEl.outputs ?? []).map((p: any) => ({ ...p, id: uuidv4() })),
  };

  // Rewrite src if a remap is provided
  if (srcRemap && 'src' in base && base.src) {
    const remapped = srcRemap.get(base.src);
    if (remapped) base.src = remapped;
  }

  return base as CanvasElement;
}

/**
 * AC7: Restore a parsed canvas into the current canvas store.
 *
 * Three-phase pattern (elements → connections → groups) to ensure ports are
 * seeded before connection linking, and all new IDs are established before
 * group childId references are resolved.
 *
 * All element IDs and port IDs are regenerated to avoid conflicts with
 * existing canvas nodes. aigenerating elements are replaced with text
 * placeholders (transient nodes cannot be meaningfully restored).
 */
export async function restoreCanvas(parsed: ParsedCanvas): Promise<void> {
  const store = useCanvasStore.getState();

  // ── Phase 0: Load assets from ZIP into Blob URLs ─────────────────────────
  const blobUrlMap = new Map<string, string>(); // zipPath → blob:URL
  const zip = parsed.zip;

  const loadAsset = async (zipPath: string): Promise<string> => {
    const cached = blobUrlMap.get(zipPath);
    if (cached) return cached;
    const file = zip.file(zipPath);
    if (!file) return '';
    const blob = await file.async('blob');
    const url = URL.createObjectURL(blob);
    blobUrlMap.set(zipPath, url);
    return url;
  };

  // Build src remap: old element ID → new blob URL
  const srcRemap = new Map<string, string>();
  const skippedAssets: string[] = [];
  for (const entry of parsed.srcMap) {
    if (entry.zipPath && entry.elementId) {
      try {
        const url = await loadAsset(entry.zipPath);
        if (url) {
          srcRemap.set(entry.elementId, url);
        } else {
          skippedAssets.push(entry.elementId);
        }
      } catch {
        skippedAssets.push(entry.elementId);
      }
    }
  }

  // ── Phase 1: Create elements with fresh IDs ─────────────────────────────
  const idMap = new Map<string, string>(); // old ID → new ID
  const newIds: string[] = [];
  const skippedConns: Connection[] = [];

  for (const oldEl of parsed.elements) {
    // Skip transient aigenerating placeholders — replace with a text node
    if (oldEl.type === 'aigenerating') {
      const newId = uuidv4();
      idMap.set(oldEl.id, newId);
      const placeholder: CanvasElement = {
        id: newId,
        type: 'text',
        x: oldEl.x,
        y: oldEl.y,
        width: 280,
        height: 60,
        text: '[AI 生成结果 — 请重新生成]',
        fontSize: 13,
        fontFamily: 'sans-serif',
        fill: '#9ca3af',
      };
      store.addElement(placeholder);
      newIds.push(newId);
      continue;
    }

    const newId = uuidv4();
    idMap.set(oldEl.id, newId);

    const newEl = buildNewElement(oldEl, newId, srcRemap);
    store.addElement(newEl);
    newIds.push(newId);
  }

  // ── Phase 2: Link connections with resolved port IDs ────────────────────
  for (const oldConn of parsed.connections) {
    const fromId = idMap.get(oldConn.fromId);
    const toId = idMap.get(oldConn.toId);
    if (!fromId || !toId) {
      skippedConns.push(oldConn);
      continue;
    }

    // Re-read from store after element insertion
    const updated = useCanvasStore.getState();
    const fromEl = updated.elements.find(e => e.id === fromId);
    const toEl = updated.elements.find(e => e.id === toId);
    if (!fromEl || !toEl) {
      skippedConns.push(oldConn);
      continue;
    }

    const fromPort = fromEl.outputs?.find(p => p.id === oldConn.fromPortId)
      ?? fromEl.outputs?.[0];
    const toPort = toEl.inputs?.find(p => p.id === oldConn.toPortId)
      ?? toEl.inputs?.[0];
    if (!fromPort || !toPort) {
      skippedConns.push(oldConn);
      continue;
    }

    const newConn: Connection = {
      id: uuidv4(),
      fromId,
      fromPortId: fromPort.id,
      toId,
      toPortId: toPort.id,
    };
    store.addConnection(newConn);
  }

  // ── Phase 3: Restore groups ──────────────────────────────────────────────
  const groupsToRestore: GroupRecord[] = parsed.groups.map(oldGroup => ({
    ...oldGroup,
    id: uuidv4(),
    childIds: oldGroup.childIds
      .map(oldChildId => idMap.get(oldChildId))
      .filter((id): id is string => id !== undefined),
  })).filter(g => g.childIds.length >= 2); // auto-dissolve empty groups

  // Append restored groups to existing groups
  if (groupsToRestore.length > 0) {
    const currentGroups = useCanvasStore.getState().groups;
    useCanvasStore.setState({ groups: [...currentGroups, ...groupsToRestore] });
  }

  // ── Select all newly added elements ─────────────────────────────────────
  store.setSelection(newIds);
}

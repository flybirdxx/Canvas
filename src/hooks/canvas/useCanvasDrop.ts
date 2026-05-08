/**
 * useCanvasDrop — handles drag-and-drop of files and asset library items
 * onto the canvas.
 *
 * Extracted from InfiniteCanvas L221-L326 (handleDrop).
 */
import type React from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useCanvasStore } from '@/store/useCanvasStore';
import { useAssetLibraryStore } from '@/store/useAssetLibraryStore';
import { buildFileElement } from '@/services/fileIngest';

export function useCanvasDrop(
  containerRef: React.RefObject<HTMLDivElement | null>,
) {
  const { stageConfig, addElement, setSelection, setActiveTool } = useCanvasStore();

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const stage = containerRef.current?.querySelector('canvas');
    if (!stage) return;

    // ── 1. Asset library drop ────────────────────────────────────────
    const assetId = e.dataTransfer.getData('application/x-canvas-asset');
    if (assetId) {
      const asset = useAssetLibraryStore.getState().findAsset(assetId);
      if (!asset) return;

      const defaults =
        asset.kind === 'image' ? { w: 560, h: 560 } :
        asset.kind === 'video' ? { w: 640, h: 360 } :
                                  { w: 360, h: 96 };
      const width = asset.width ?? defaults.w;
      const height = asset.height ?? defaults.h;

      const rect = containerRef.current!.getBoundingClientRect();
      const posX = e.clientX - rect.left;
      const posY = e.clientY - rect.top;
      const scale = stageConfig.scale;
      const x = (posX - stageConfig.x) / scale - width / 2;
      const y = (posY - stageConfig.y) / scale - height / 2;

      const id = uuidv4();
      addElement({
        id,
        type: asset.kind,
        x, y, width, height,
        src: asset.src,
        prompt: asset.prompt,
      });
      setSelection([id]);
      setActiveTool('select');
      return;
    }

    // ── 2. File drop ─────────────────────────────────────────────────
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    const isAudio = file.type.startsWith('audio/');

    if (isVideo || isAudio) {
      const src = URL.createObjectURL(file);
      const width = isVideo ? 400 : 300;
      const height = isVideo ? 260 : 80;

      const rect = containerRef.current!.getBoundingClientRect();
      const posX = e.clientX - rect.left;
      const posY = e.clientY - rect.top;

      const scale = stageConfig.scale;
      const x = (posX - stageConfig.x) / scale - width / 2;
      const y = (posY - stageConfig.y) / scale - height / 2;

      const id = uuidv4();
      addElement({ id, type: isVideo ? 'video' : 'audio', x, y, width, height, src });
      setSelection([id]);
      setActiveTool('select');
      return;
    }

    if (isImage) {
      const rect = containerRef.current!.getBoundingClientRect();
      const posX = e.clientX - rect.left;
      const posY = e.clientY - rect.top;
      const scale = stageConfig.scale;
      const originX = (posX - stageConfig.x) / scale;
      const originY = (posY - stageConfig.y) / scale;
      buildFileElement(file, { x: originX, y: originY }).then((fileEl) => {
        addElement(fileEl);
        setSelection([fileEl.id]);
        setActiveTool('select');

        useAssetLibraryStore.getState().addAsset({
          kind: 'image',
          src: fileEl.src,
          name: fileEl.name || '上传图像',
          width: fileEl.width,
          height: fileEl.height,
          source: 'uploaded',
        });
      }).catch(err => {
        console.warn('[canvas] drop image → file(image) failed', file.name, err);
      });
      return;
    }

    // ── 3. Generic file drop ─────────────────────────────────────────
    {
      const rect = containerRef.current!.getBoundingClientRect();
      const posX = e.clientX - rect.left;
      const posY = e.clientY - rect.top;
      const scale = stageConfig.scale;
      const originX = (posX - stageConfig.x) / scale;
      const originY = (posY - stageConfig.y) / scale;
      buildFileElement(file, { x: originX, y: originY }).then((fileEl) => {
        addElement(fileEl);
        setSelection([fileEl.id]);
        setActiveTool('select');
      }).catch((err) => {
        console.warn('[drop] failed to ingest file', file.name, err);
      });
    }
  };

  return { handleDrop };
}

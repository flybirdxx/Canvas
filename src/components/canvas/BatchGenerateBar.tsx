/**
 * BatchGenerateBar — floating toolbar shown when ≥2 generative nodes are
 * multi-selected. Triggers parallel generation across all selected targets.
 *
 * Extracted from InfiniteCanvas L604-L654.
 */
import React, { useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useCanvasStore } from '@/store/useCanvasStore';
import { runGeneration } from '@/services/imageGeneration';
import type { CanvasElement } from '@/types/canvas';

interface BatchGenerateBarProps {
  elements: CanvasElement[];
  selectedIds: string[];
}

export function BatchGenerateBar({ elements, selectedIds }: BatchGenerateBarProps) {
  const batchTargets = useMemo(() => {
    if (selectedIds.length < 2) return [];
    return elements.filter(
      (el) =>
        selectedIds.includes(el.id) &&
        (el.type === 'image' || el.type === 'video') &&
        el.prompt?.trim() &&
        el.generation?.model,
    );
  }, [elements, selectedIds]);

  if (batchTargets.length < 2) return null;

  const handleBatchGenerate = async () => {
    for (const target of batchTargets) {
      const phId = uuidv4();
      const store = useCanvasStore.getState();
      store.replaceElement(target.id, {
        id: phId,
        type: 'aigenerating',
        x: target.x,
        y: target.y,
        width: target.width,
        height: target.height,
        inheritedVersions: (target as any).versions,
        inheritedPrompt: target.prompt,
      } as any, '批量生成');
      await runGeneration([phId], {
        model: target.generation!.model!,
        prompt: target.prompt!,
        size: `${target.width}x${target.height}`,
        aspect: target.generation?.aspect,
        resolution: target.generation?.quality,
        qualityLevel: target.generation?.qualityLevel,
        n: 1,
        w: target.width,
        h: target.height,
        references: target.generation?.references,
      });
    }
  };

  return (
    <div
      className="chip-paper absolute z-35 flex items-center gap-1.5 anim-fade-in"
      style={{
        top: 80,
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '4px 6px',
        borderRadius: 'var(--r-pill)',
        boxShadow: 'var(--shadow-ink-2)',
      }}
    >
      <span className="serif-it" style={{ fontSize: 11.5, paddingLeft: 4, color: 'var(--ink-0)' }}>
        已选 {batchTargets.length} 个生成节点
      </span>
      <button
        className="btn btn-primary"
        style={{ padding: '5px 14px', fontSize: 11, borderRadius: 'var(--r-pill)' }}
        onClick={handleBatchGenerate}
      >
        全部生成
      </button>
    </div>
  );
}

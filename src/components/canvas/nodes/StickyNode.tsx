import React from 'react';
import { Group, Rect } from 'react-konva';
import { Html } from 'react-konva-utils';
import { useCanvasStore } from '../../../store/useCanvasStore';
import { useExecutionBorder } from './shared';

export function StickyNode({ el }: { el: any }) {
  const { id, width, height } = el;
  const executionBorder = useExecutionBorder(id);
  const updateElement = useCanvasStore((s) => s.updateElement);
  const sticky = el;

  return (
    <Group>
      <Rect width={width} height={height} fill="transparent" />
      <Rect
        x={-1} y={-1}
        width={width + 2} height={height + 2}
        stroke={executionBorder}
        strokeWidth={2}
        fill="transparent"
        listening={false}
      />
      <Html divProps={{ style: { pointerEvents: 'none' } }}>
        <div className="flex" style={{ width, height, background: sticky.fill || 'var(--sticky-yellow)', borderRadius: 'var(--r-sm)', overflow: 'hidden', position: 'relative', padding: 14 }}>
          <textarea
            className="w-full h-full bg-transparent border-none outline-none resize-none pointer-events-auto paper-scroll"
            style={{
              color: 'var(--ink-0)',
              fontSize: 14,
              lineHeight: 1.55,
              fontFamily: 'var(--font-sans)',
              fontWeight: 500,
            }}
            value={sticky.text || ''}
            placeholder="点击编辑便签内容…"
            onChange={(e) => updateElement(id, { text: e.target.value })}
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          />
        </div>
      </Html>
    </Group>
  );
}

import React from 'react';
import { Group, Rect } from 'react-konva';
import { Html } from 'react-konva-utils';
import { useCanvasStore } from '../../../store/useCanvasStore';
import { POLAROID_STYLE, useExecutionBorder } from './shared';

export function TextNode({ el }: { el: any }) {
  const { id, width, height } = el;
  const executionBorder = useExecutionBorder(id);
  const updateElement = useCanvasStore((s) => s.updateElement);
  const textEl = el;

  return (
    <Group>
      <Rect width={width} height={height} fill="transparent" />
      <Rect
        x={-1} y={-1}
        width={width + 2} height={height + 2}
        cornerRadius={12}
        stroke={executionBorder}
        strokeWidth={2}
        fill="transparent"
        listening={false}
      />
      <Html divProps={{ style: { pointerEvents: 'none' } }}>
        <div className="flex flex-col" style={{ ...POLAROID_STYLE, width, height, fontFamily: textEl.fontFamily || 'var(--font-serif)' }}>
          <div className="flex-1" style={{ padding: 14 }}>
            <textarea
              className="w-full h-full bg-transparent border-none outline-none resize-none pointer-events-auto paper-scroll"
              style={{
                color: (textEl.fill && textEl.fill.startsWith('#'))
                  ? textEl.fill
                  : 'var(--ink-0)',
                fontSize: `${textEl.fontSize || 14}px`,
                lineHeight: textEl.lineHeight || 1.5,
                textAlign: (textEl.align || 'left') as any,
                fontFamily: textEl.fontFamily || 'var(--font-serif)',
              }}
              value={textEl.text}
              placeholder='"A poetic excerpt about the passage of time…"'
              onChange={(e) => updateElement(id, { text: e.target.value })}
              onPointerDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      </Html>
    </Group>
  );
}

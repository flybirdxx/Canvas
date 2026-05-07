import React from 'react';
import { Group, Rect } from 'react-konva';
import { Html } from 'react-konva-utils';
import { POLAROID_STYLE, useExecutionBorder } from './shared';

export function ShapeNode({ el }: { el: any }) {
  const { id, width, height, type } = el;
  const executionBorder = useExecutionBorder(id);

  if (type === 'circle') {
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
          <div
            style={{
              ...POLAROID_STYLE,
              width,
              height,
              background: el.fill || 'var(--bg-2)',
              borderRadius: '50%',
            }}
          />
        </Html>
      </Group>
    );
  }

  // default to rectangle
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
        <div
          style={{
            ...POLAROID_STYLE,
            width,
            height,
            background: el.fill || 'var(--bg-2)',
            borderRadius: el.cornerRadius
              ? `${Math.max(8, el.cornerRadius)}px`
              : POLAROID_STYLE.borderRadius,
          }}
        />
      </Html>
    </Group>
  );
}

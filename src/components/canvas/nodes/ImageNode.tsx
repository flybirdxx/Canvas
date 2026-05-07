import React from 'react';
import { Group, Rect, Image as KonvaImage } from 'react-konva';
import { Html } from 'react-konva-utils';
import useImage from 'use-image';
import { POLAROID_STYLE, PAPER_EDGE, useExecutionBorder } from './shared';

function URLImage({ el, width, height }: { el: any; width: number; height: number }) {
  const [img] = useImage(el.src || '');
  if (!el.src) {
    return (
      <Group>
        <Rect width={width} height={height} fill="transparent" />
        <Html divProps={{ style: { pointerEvents: 'none' } }}>
          <div
            className="flex flex-col items-center justify-center serif-it"
            style={{ ...POLAROID_STYLE, width, height, color: 'var(--ink-3)' }}
          >
            <span style={{ fontSize: 26, lineHeight: 1 }}>◲</span>
            <span style={{ fontSize: 12, marginTop: 6 }}>空白图片节点</span>
            <span className="meta" style={{ marginTop: 4, fontSize: 9.5 }}>等待生成或上传</span>
          </div>
        </Html>
      </Group>
    );
  }

  return (
    <Group>
      <Rect
        x={-1}
        y={-1}
        width={width + 2}
        height={height + 2}
        cornerRadius={13}
        stroke={PAPER_EDGE}
        strokeWidth={1}
        fill={"#FFFFFF"}
        listening={false}
      />
      <KonvaImage
        image={img}
        width={width}
        height={height}
        cornerRadius={12}
        shadowColor="rgba(40,30,20,0.12)"
        shadowBlur={20}
        shadowOffsetY={6}
        shadowOpacity={1}
      />
    </Group>
  );
}

export function ImageNode({ el }: { el: any }) {
  const { id, width, height } = el;
  const executionBorder = useExecutionBorder(id);

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
      <URLImage el={el} width={width} height={height} />
    </Group>
  );
}

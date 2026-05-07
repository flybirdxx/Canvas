import React from 'react';
import { Group, Rect } from 'react-konva';
import { Html } from 'react-konva-utils';
import { POLAROID_STYLE, useExecutionBorder } from './shared';

function EmptyMedia({ label, icon }: { label: string; icon: string }) {
  return (
    <div
      className="flex flex-col items-center gap-2"
      style={{ color: 'var(--ink-3)' }}
    >
      <span style={{ fontSize: 22, lineHeight: 1, color: 'var(--ink-2)' }}>{icon}</span>
      <span className="serif-it" style={{ fontSize: 11 }}>{label}</span>
    </div>
  );
}

export function MediaNode({ el }: { el: any }) {
  const { id, width, height, type } = el;
  const executionBorder = useExecutionBorder(id);
  const media = el;

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
        <div className="flex flex-col" style={{ ...POLAROID_STYLE, width, height }}>
          <div
            className="flex-1 flex items-center justify-center overflow-hidden"
            style={{ background: 'var(--bg-2)' }}
          >
            {type === 'video' ? (
              media.src
                ? <video controls src={media.src} className="w-full h-full object-contain" style={{ pointerEvents: 'auto' }} />
                : <EmptyMedia label="空白视频节点" icon="▶" />
            ) : (
              media.src
                ? <audio controls src={media.src} className="w-[90%]" style={{ pointerEvents: 'auto' }} />
                : <EmptyMedia label="空白音频节点" icon="♪" />
            )}
          </div>
        </div>
      </Html>
    </Group>
  );
}

/**
 * ConnectionLines — Konva rendering of bezier connections between nodes.
 *
 * Extracted from InfiniteCanvas to isolate pure-visual rendering logic.
 * Contains both established connection lines (double-stroke glow effect)
 * and the transient "drawing" line shown while dragging a port.
 *
 * 拖拽实时跟随：ConnectionLines 从 dragOffsets 读取拖拽中的节点偏移量，
 * 叠加到 store 位置以实时更新贝塞尔曲线端点。React.memo 已移除 —
 * 连线需要随 guideLines 变化（即每次 onDragMove 触发 setGuideLines）
 * 而重新渲染。
 */
import React from 'react';
import { Line, Group } from 'react-konva';
import type { CanvasElement, Connection } from '@/types/canvas';
import type { DrawingConnection } from '@/store/types';
import { getDragOffset, useDragOffsetsVersion } from './dragOffsets';

// ── Helpers ──────────────────────────────────────────────────────────

export function getBezierPoints(startX: number, startY: number, endX: number, endY: number) {
  const dx = Math.abs(endX - startX);
  const curveFactor = Math.max(dx * 0.5, 50);
  const cp1X = startX + curveFactor;
  const cp1Y = startY;
  const cp2X = endX - curveFactor;
  const cp2Y = endY;
  return [startX, startY, cp1X, cp1Y, cp2X, cp2Y, endX, endY];
}

export function getPortColor(type: string) {
  switch (type) {
    case 'text':  return '#3F8FA6';
    case 'image': return '#C67654';
    case 'video': return '#8866B5';
    case 'audio': return '#6FA26A';
    default:      return '#8A7F74';
  }
}

// ── Established connections ──────────────────────────────────────────

interface ConnectionLinesProps {
  elements: CanvasElement[];
  connections: Connection[];
}

export const ConnectionLines = function ConnectionLines({
  elements,
  connections,
}: ConnectionLinesProps) {
  useDragOffsetsVersion();

  return (
    <>
      {connections.map(conn => {
        const fromEl = elements.find(el => el.id === conn.fromId);
        const toEl = elements.find(el => el.id === conn.toId);
        if (!fromEl || !toEl || !fromEl.outputs || !toEl.inputs) return null;

        const fromPortIdx = fromEl.outputs.findIndex(p => p.id === conn.fromPortId);
        const toPortIdx = toEl.inputs.findIndex(p => p.id === conn.toPortId);
        if (fromPortIdx === -1 || toPortIdx === -1) return null;

        const fromPortType = fromEl.outputs[fromPortIdx].type;

        const outputSpacing = fromEl.height / (fromEl.outputs.length + 1);
        const inputSpacing = toEl.height / (toEl.inputs.length + 1);

        // 拖拽实时跟随：叠加 dragOffsets 的偏移量
        const fromOffset = getDragOffset(fromEl.id);
        const toOffset = getDragOffset(toEl.id);
        const fromX = fromEl.x + (fromOffset?.dx ?? 0);
        const fromY = fromEl.y + (fromOffset?.dy ?? 0);
        const toX = toEl.x + (toOffset?.dx ?? 0);
        const toY = toEl.y + (toOffset?.dy ?? 0);

        const startX = fromX + fromEl.width;
        const startY = fromY + outputSpacing * (fromPortIdx + 1);
        const endX = toX;
        const endY = toY + inputSpacing * (toPortIdx + 1);

        return (
          <Group key={conn.id}>
            <Line
              points={getBezierPoints(startX, startY, endX, endY)}
              stroke={getPortColor(fromPortType)}
              strokeWidth={5}
              opacity={0.22}
              bezier
              listening={false}
              lineCap="round"
            />
            <Line
              points={getBezierPoints(startX, startY, endX, endY)}
              stroke={getPortColor(fromPortType)}
              strokeWidth={1.6}
              bezier
              listening={false}
              lineCap="round"
            />
          </Group>
        );
      })}
    </>
  );
};

// ── Transient drawing line ───────────────────────────────────────────

interface DrawingConnectionLineProps {
  drawingConnection: DrawingConnection;
}

export const DrawingConnectionLine = function DrawingConnectionLine({
  drawingConnection,
}: DrawingConnectionLineProps) {
  return (
    <Line
      points={getBezierPoints(
        drawingConnection.startX, drawingConnection.startY,
        drawingConnection.toX, drawingConnection.toY,
      )}
      stroke={getPortColor(drawingConnection.fromPortType)}
      strokeWidth={1.8}
      dash={[5, 4]}
      bezier
      lineCap="round"
    />
  );
};

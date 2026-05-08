/**
 * ConnectionLines — Konva rendering of bezier connections between nodes.
 *
 * Extracted from InfiniteCanvas to isolate pure-visual rendering logic.
 * Contains both established connection lines (double-stroke glow effect)
 * and the transient "drawing" line shown while dragging a port.
 */
import React from 'react';
import { Line, Group } from 'react-konva';
import type { CanvasElement, Connection } from '@/types/canvas';
import type { DrawingConnection } from '@/store/types';

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

export const ConnectionLines = React.memo(function ConnectionLines({
  elements,
  connections,
}: ConnectionLinesProps) {
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

        const startX = fromEl.x + fromEl.width;
        const startY = fromEl.y + outputSpacing * (fromPortIdx + 1);
        const endX = toEl.x;
        const endY = toEl.y + inputSpacing * (toPortIdx + 1);

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
});

// ── Transient drawing line ───────────────────────────────────────────

interface DrawingConnectionLineProps {
  drawingConnection: DrawingConnection;
}

export const DrawingConnectionLine = React.memo(function DrawingConnectionLine({
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
});

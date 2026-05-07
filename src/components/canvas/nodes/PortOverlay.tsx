import React from 'react';
import { Group, Circle } from 'react-konva';
import { useCanvasStore } from '../../../store/useCanvasStore';
import { getPortColor } from './shared';

interface PortOverlayProps {
  el: any;
  isSelected: boolean;
  hoveredId: string | null;
}

export function PortOverlay({ el, isSelected, hoveredId }: PortOverlayProps) {
  if (!el.inputs && !el.outputs) return null;
  const showPorts = isSelected || hoveredId === el.id;
  const { x, y, width, height } = el;

  const inputSpacing = height / ((el.inputs?.length || 0) + 1);
  const outputSpacing = height / ((el.outputs?.length || 0) + 1);
  const portRadius = 7;

  return (
    <>
      {el.inputs?.map((port: any, i: number) => {
        const portY = inputSpacing * (i + 1);
        return (
          <Group key={`in-${port.id}`} x={0} y={portY} opacity={showPorts ? 1 : 0} listening={showPorts}>
            <Circle
              x={0}
              y={0}
              radius={portRadius}
              fill="#FFFFFF"
              stroke={getPortColor(port.type)}
              strokeWidth={1.8}
              onMouseEnter={(e) => {
                const stage = e.target.getStage();
                if (stage) stage.container().style.cursor = 'crosshair';
              }}
              onMouseLeave={(e) => {
                const stage = e.target.getStage();
                if (stage) stage.container().style.cursor = 'default';
              }}
              onPointerDown={(e) => {
                e.cancelBubble = true;
                const setDrawingConnection = useCanvasStore.getState().setDrawingConnection;
                const existingConn = useCanvasStore.getState().connections.find(c => c.toPortId === port.id);
                if (existingConn) {
                  useCanvasStore.getState().deleteConnections([existingConn.id]);
                  const fromEl = useCanvasStore.getState().elements.find(e => e.id === existingConn.fromId);
                  if (fromEl) {
                    setDrawingConnection({
                      fromElementId: fromEl.id,
                      fromPortId: existingConn.fromPortId,
                      fromPortType: port.type,
                      startX: x,
                      startY: y + portY,
                      toX: x,
                      toY: y + portY,
                      isDisconnecting: true,
                      existingConnectionId: existingConn.id,
                    });
                  }
                } else {
                  setDrawingConnection({
                    fromElementId: el.id, 
                    fromPortId: port.id, 
                    fromPortType: port.type, 
                    startX: x, 
                    startY: y + portY, 
                    toX: x, 
                    toY: y + portY, 
                    isDisconnecting: true
                  });
                }
              }}
            />
          </Group>
        );
      })}

      {el.outputs?.map((port: any, i: number) => {
        const portY = outputSpacing * (i + 1);
        return (
          <Group key={`out-${port.id}`} x={width} y={portY} opacity={showPorts ? 1 : 0} listening={showPorts}>
            <Circle
              x={0}
              y={0}
              radius={portRadius}
              fill="#FFFFFF"
              stroke={getPortColor(port.type)}
              strokeWidth={1.8}
              onMouseEnter={(e) => {
                const stage = e.target.getStage();
                if (stage) stage.container().style.cursor = 'crosshair';
              }}
              onMouseLeave={(e) => {
                const stage = e.target.getStage();
                if (stage) stage.container().style.cursor = 'default';
              }}
              onPointerDown={(e) => {
                e.cancelBubble = true;
                useCanvasStore.getState().setDrawingConnection({
                  fromElementId: el.id,
                  fromPortId: port.id,
                  fromPortType: port.type,
                  startX: x + width,
                  startY: y + portY,
                  toX: x + width,
                  toY: y + portY,
                  isDisconnecting: false,
                });
              }}
            />
          </Group>
        );
      })}
    </>
  );
}

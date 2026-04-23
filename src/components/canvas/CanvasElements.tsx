import { useRef, useState } from 'react';
import { Rect, Text, Group, Image as KonvaImage, Circle } from 'react-konva';
import { Html } from 'react-konva-utils';
import useImage from 'use-image';
import {
  Sparkles, AlignLeft, AlertTriangle, RefreshCw, Trash2,
  Settings as SettingsIcon,
} from 'lucide-react';
import { useCanvasStore } from '../../store/useCanvasStore';
import { retryGeneration } from '../../services/imageGeneration';
import { AIGenerationError } from '../../types/canvas';

/**
 * Warm-paper port palette.
 *
 * Konva's Circle takes a resolved color string — oklch tokens can't be
 * read from CSS vars in a canvas. These values mirror the --port-* vars
 * from tokens.css (close-enough sRGB approximations of the oklch source).
 */
function getPortColor(type: string) {
  switch (type) {
    case 'text':  return '#3F8FA6';   // teal
    case 'image': return '#C67654';   // terracotta
    case 'video': return '#8866B5';   // plum
    case 'audio': return '#6FA26A';   // green
    default:      return '#8A7F74';   // neutral ink
  }
}

/* -------------------------------------------------------------------- */
/*  Tokens (sRGB mirrors) — keeping Konva and DOM in visual sync        */
/* -------------------------------------------------------------------- */

const INK_1 = '#5A4E42';             // secondary ink — selection border
const PAPER_EDGE = 'rgba(40,30,20,0.12)'; // polaroid hairline

/* Polaroid card classes — shared across rectangle / text / video / audio
   DOM overlays. We don't use backdrop blur: the canvas already has a
   paper ground, blur stacked on opaque paper produces muddy tones. */
const POLAROID_STYLE: React.CSSProperties = {
  background: 'var(--bg-1)',
  border: '1px solid var(--line-1)',
  borderRadius: 'var(--r-md)',
  boxShadow: 'var(--shadow-ink-2)',
  overflow: 'hidden',
};

/* -------------------------------------------------------------------- */
/*  Helper: image-source node                                           */
/* -------------------------------------------------------------------- */

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

  // Polaroid-style image: render behind a 1px ink hairline by layering a
  // slightly larger rect under the image rect. The image itself gets the
  // paper shadow for subtle lift.
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

/* -------------------------------------------------------------------- */
/*  Selection handles                                                   */
/* -------------------------------------------------------------------- */

const HANDLE_SIZE = 10;
const HANDLE_HALF = HANDLE_SIZE / 2;

type Corner = 'tl' | 'tr' | 'bl' | 'br';

function SelectionHandles({ el }: { el: any }) {
  const { x, y, width, height, id } = el;
  const dragStartRef = useRef<{ mx: number; my: number; x: number; y: number; w: number; h: number } | null>(null);

  const corners: { corner: Corner; cx: number; cy: number }[] = [
    { corner: 'tl', cx: x,         cy: y },
    { corner: 'tr', cx: x + width, cy: y },
    { corner: 'bl', cx: x,         cy: y + height },
    { corner: 'br', cx: x + width, cy: y + height },
  ];

  return (
    <>
      {/* Selection border — hand-drawn ink dashed rect */}
      <Rect
        x={x - 2}
        y={y - 2}
        width={width + 4}
        height={height + 4}
        stroke={INK_1}
        strokeWidth={1.4}
        dash={[6, 4]}
        fill="transparent"
        cornerRadius={4}
        listening={false}
        opacity={0.9}
      />
      {/* Corner handles — circular ink dots on paper disc */}
      {corners.map(({ corner, cx, cy }) => (
        <Circle
          key={corner}
          x={cx}
          y={cy}
          radius={HANDLE_HALF}
          fill="#F7EFE1"
          stroke={INK_1}
          strokeWidth={1.2}
          draggable
          onDragStart={(e) => {
            e.cancelBubble = true;
            const stage = e.target.getStage();
            const scale = stage!.scaleX();
            const stageX = stage!.x();
            const stageY = stage!.y();
            const ptr = stage!.getPointerPosition()!;
            dragStartRef.current = {
              mx: (ptr.x - stageX) / scale,
              my: (ptr.y - stageY) / scale,
              x: el.x,
              y: el.y,
              w: el.width,
              h: el.height,
            };
            e.target.x(cx);
            e.target.y(cy);
          }}
          onDragMove={(e) => {
            e.cancelBubble = true;
            if (!dragStartRef.current) return;
            const stage = e.target.getStage();
            const scale = stage!.scaleX();
            const stageX = stage!.x();
            const stageY = stage!.y();
            const ptr = stage!.getPointerPosition()!;
            const mx = (ptr.x - stageX) / scale;
            const my = (ptr.y - stageY) / scale;
            const dx = mx - dragStartRef.current.mx;
            const dy = my - dragStartRef.current.my;
            const { x: ox, y: oy, w: ow, h: oh } = dragStartRef.current;

            let newX = ox, newY = oy, newW = ow, newH = oh;
            if (corner === 'tl') { newX = ox + dx; newY = oy + dy; newW = Math.max(60, ow - dx); newH = Math.max(40, oh - dy); }
            if (corner === 'tr') { newY = oy + dy; newW = Math.max(60, ow + dx); newH = Math.max(40, oh - dy); }
            if (corner === 'bl') { newX = ox + dx; newW = Math.max(60, ow - dx); newH = Math.max(40, oh + dy); }
            if (corner === 'br') { newW = Math.max(60, ow + dx); newH = Math.max(40, oh + dy); }

            e.target.x(cx);
            e.target.y(cy);

            useCanvasStore.getState().updateElement(id, { x: newX, y: newY, width: newW, height: newH });
          }}
          onDragEnd={(e) => {
            e.cancelBubble = true;
            e.target.x(cx);
            e.target.y(cy);
            dragStartRef.current = null;
          }}
        />
      ))}
    </>
  );
}

/* -------------------------------------------------------------------- */
/*  Main                                                                */
/* -------------------------------------------------------------------- */

export function CanvasElements() {
  const {
    elements, selectedIds, setSelection, updateElement, updateElementPosition,
    deleteElements, activeTool, setDrawingConnection, drawingConnection,
  } = useCanvasStore();

  return (
    <>
      {elements.map((el) => {
        const isSelected = selectedIds.includes(el.id);
        const { id, x, y, rotation, width, height } = el;

        const outerGroupProps = {
          id,
          x,
          y,
          width,
          height,
          rotation: rotation || 0,
          draggable: activeTool === 'select' && !el.isLocked && !drawingConnection,
          dragBoundFunc: function (this: any, pos: any) {
            if (useCanvasStore.getState().drawingConnection) {
              return this.absolutePosition();
            }
            return pos;
          },
          onPointerDown: (e: any) => {
            if (activeTool === 'select') {
              e.cancelBubble = true;
              const isShiftPressed = e.evt.shiftKey;
              if (isShiftPressed) {
                if (isSelected) setSelection(selectedIds.filter(selId => selId !== id));
                else setSelection([...selectedIds, id]);
              } else {
                setSelection([id]);
              }
            }
          },
          onDragMove: (e: any) => {
            if (e.target.id() === id) {
              updateElementPosition(id, e.target.x(), e.target.y());
            }
          },
          onDragEnd: (e: any) => {
            if (e.target.id() === id) {
              updateElement(id, { x: e.target.x(), y: e.target.y() });
            }
          },
        };

        let nodeContent: React.JSX.Element | null = null;

        if (el.type === 'rectangle') {
          const rectEl = el as any;
          nodeContent = (
            <Group>
              <Rect width={width} height={height} fill="transparent" />
              <Html divProps={{ style: { pointerEvents: 'none' } }}>
                <div
                  style={{
                    ...POLAROID_STYLE,
                    width,
                    height,
                    background: rectEl.fill || 'var(--bg-2)',
                    borderRadius: rectEl.cornerRadius
                      ? `${Math.max(8, rectEl.cornerRadius)}px`
                      : POLAROID_STYLE.borderRadius,
                  }}
                />
              </Html>
            </Group>
          );
        }
        else if (el.type === 'circle') {
          const circleEl = el as any;
          nodeContent = (
            <Group>
              <Rect width={width} height={height} fill="transparent" />
              <Html divProps={{ style: { pointerEvents: 'none' } }}>
                <div
                  style={{
                    ...POLAROID_STYLE,
                    width,
                    height,
                    background: circleEl.fill || 'var(--bg-2)',
                    borderRadius: '50%',
                  }}
                />
              </Html>
            </Group>
          );
        }
        else if (el.type === 'text') {
          const textEl = el as any;
          nodeContent = (
            <Group>
              <Rect width={width} height={height} fill="transparent" />
              <Html divProps={{ style: { pointerEvents: 'none' } }}>
                <div
                  className="flex flex-col"
                  style={{
                    ...POLAROID_STYLE,
                    width,
                    height,
                    fontFamily: textEl.fontFamily || 'var(--font-serif)',
                  }}
                >
                  <div
                    className="flex items-center justify-between hairline-b"
                    style={{ padding: '8px 12px', background: 'var(--bg-2)' }}
                  >
                    <div className="flex items-center gap-2">
                      <AlignLeft size={13} strokeWidth={1.6} style={{ color: 'var(--ink-2)' }} />
                      <span
                        className="meta"
                        style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--ink-2)' }}
                      >
                        Text
                      </span>
                    </div>
                    <span className="meta" style={{ fontSize: 9.5, color: 'var(--ink-3)' }}>
                      {textEl.fontSize || 14}px
                    </span>
                  </div>
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
        else if (el.type === 'image') {
          nodeContent = <URLImage el={el} width={width} height={height} />;
        }
        else if (el.type === 'sticky') {
          const sticky = el as any;
          // Sticky notes are the one exception to the uniform polaroid
          // treatment — wax-yellow paper, folded corner ink shadow, and
          // a tiny -0.4° rotation via Konva's own rotation (applied at
          // the outer group so hit-box still matches).
          nodeContent = (
            <Group>
              <Rect width={width} height={height} fill="transparent" />
              <Html divProps={{ style: { pointerEvents: 'none' } }}>
                <div
                  className="flex"
                  style={{
                    width,
                    height,
                    background: sticky.fill || 'var(--sticky-yellow)',
                    border: '1px solid var(--sticky-yellow-edge)',
                    borderRadius: 'var(--r-sm)',
                    boxShadow: 'var(--shadow-ink-2)',
                    padding: 14,
                    overflow: 'hidden',
                    position: 'relative',
                  }}
                >
                  {/* Folded corner hint */}
                  <svg
                    aria-hidden="true"
                    style={{ position: 'absolute', right: 0, bottom: 0, width: 16, height: 16, opacity: 0.35 }}
                    viewBox="0 0 16 16"
                  >
                    <path d="M0 16 L16 0 L16 16 Z" fill="rgba(40,30,20,0.20)" />
                  </svg>
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
        else if (el.type === 'aigenerating') {
          const aig = el as any;
          const error = aig.error as AIGenerationError | undefined;
          nodeContent = (
            <Group>
              <Rect width={width} height={height} fill="transparent" />
              <Html divProps={{ style: { pointerEvents: 'none' } }}>
                {error ? (
                  <GenErrorPanel
                    width={width}
                    height={height}
                    elementId={id}
                    error={error}
                    onDelete={() => deleteElements([id])}
                  />
                ) : (
                  <div
                    className="flex items-center justify-center overflow-hidden relative"
                    style={{
                      ...POLAROID_STYLE,
                      width,
                      height,
                      borderColor: 'color-mix(in oklch, var(--accent) 26%, var(--line-1))',
                      boxShadow: '0 0 0 1px color-mix(in oklch, var(--accent) 18%, transparent), var(--shadow-ink-2)',
                    }}
                  >
                    {/* Ink bloom halo */}
                    <div
                      aria-hidden="true"
                      className="anim-ink-diffuse"
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background: `radial-gradient(ellipse at center,
                          color-mix(in oklch, var(--accent) 16%, transparent) 0%,
                          transparent 65%)`,
                      }}
                    />
                    <div className="relative flex flex-col items-center justify-center gap-3">
                      <span
                        className="anim-ink-diffuse inline-block"
                        style={{
                          width: 16, height: 16,
                          borderRadius: '50%',
                          background: 'var(--accent)',
                          boxShadow: '0 0 0 4px color-mix(in oklch, var(--accent) 22%, transparent)',
                        }}
                      />
                      <div
                        className="chip-paper flex items-center gap-2"
                        style={{
                          padding: '5px 11px',
                          fontSize: 11,
                          color: 'var(--accent)',
                        }}
                      >
                        <Sparkles className="w-3.5 h-3.5" strokeWidth={1.6} />
                        <span className="serif-it">正在生成…</span>
                      </div>
                    </div>
                  </div>
                )}
              </Html>
            </Group>
          );
        }
        else if (el.type === 'video' || el.type === 'audio') {
          const media = el as any;
          nodeContent = (
            <Group>
              <Rect width={width} height={height} fill="transparent" />
              <Html divProps={{ style: { pointerEvents: 'none' } }}>
                <div
                  className="flex flex-col"
                  style={{ ...POLAROID_STYLE, width, height }}
                >
                  <div
                    className="hairline-b flex items-center justify-between"
                    style={{
                      height: 26,
                      padding: '0 12px',
                      background: 'var(--bg-2)',
                    }}
                  >
                    <span className="meta" style={{ fontSize: 9.5 }}>
                      {el.type === 'video' ? 'VIDEO' : 'AUDIO'}
                    </span>
                    <span
                      style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: el.type === 'video' ? 'var(--port-video)' : 'var(--port-audio)',
                      }}
                    />
                  </div>
                  <div
                    className="flex-1 pointer-events-auto flex items-center justify-center overflow-hidden"
                    style={{ background: 'var(--bg-3)' }}
                  >
                    {el.type === 'video' ? (
                      media.src
                        ? <video controls src={media.src} className="w-full h-full object-contain" onPointerDown={(e) => e.stopPropagation()} />
                        : <EmptyMedia label="空白视频节点" icon="▶" />
                    ) : (
                      media.src
                        ? <audio controls src={media.src} className="w-[90%]" onPointerDown={(e) => e.stopPropagation()} />
                        : <EmptyMedia label="空白音频节点" icon="♪" />
                    )}
                  </div>
                </div>
              </Html>
            </Group>
          );
        }

        const portRadius = 5;
        const renderPorts = () => {
          if (!el.inputs && !el.outputs) return null;

          const inputSpacing = height / ((el.inputs?.length || 0) + 1);
          const outputSpacing = height / ((el.outputs?.length || 0) + 1);

          return (
            <>
              {el.inputs?.map((port, i) => {
                const portY = inputSpacing * (i + 1);
                return (
                  <Group key={`in-${port.id}`} x={0} y={portY}>
                    {/* Halo ring */}
                    <Circle
                      x={0} y={0} radius={portRadius + 3}
                      fill="#F7EFE1"
                      stroke="rgba(40,30,20,0.10)"
                      strokeWidth={1}
                      listening={false}
                    />
                    <Circle
                      x={0}
                      y={0}
                      radius={portRadius}
                      fill={getPortColor(port.type)}
                      stroke="#F7EFE1"
                      strokeWidth={1.2}
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
                        }
                      }}
                    />
                    <Text
                      text={port.label}
                      x={12}
                      y={-5}
                      fontSize={9.5}
                      fontFamily="IBM Plex Mono, ui-monospace, monospace"
                      fill={INK_1}
                    />
                  </Group>
                );
              })}

              {el.outputs?.map((port, i) => {
                const portY = outputSpacing * (i + 1);
                return (
                  <Group key={`out-${port.id}`} x={width} y={portY}>
                    <Circle
                      x={0} y={0} radius={portRadius + 3}
                      fill="#F7EFE1"
                      stroke="rgba(40,30,20,0.10)"
                      strokeWidth={1}
                      listening={false}
                    />
                    <Circle
                      x={0}
                      y={0}
                      radius={portRadius}
                      fill={getPortColor(port.type)}
                      stroke="#F7EFE1"
                      strokeWidth={1.2}
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
                        setDrawingConnection({
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
                    <Text
                      text={port.label}
                      x={-12 - (port.label?.length || 0) * 6}
                      y={-5}
                      fontSize={9.5}
                      fontFamily="IBM Plex Mono, ui-monospace, monospace"
                      fill={INK_1}
                      align="right"
                    />
                  </Group>
                );
              })}
            </>
          );
        };

        // Sticky gets a subtle rotation for paper charm.
        const rotOverride = el.type === 'sticky'
          ? (rotation ?? -0.4)
          : (rotation || 0);

        return (
          <Group key={id} {...outerGroupProps} rotation={rotOverride}>
            {nodeContent}
            {renderPorts()}
          </Group>
        );
      })}

      {/* Selection handles above all nodes */}
      {activeTool === 'select' && selectedIds.map((selId) => {
        const el = elements.find(e => e.id === selId);
        if (!el) return null;
        return <SelectionHandles key={`sel-${selId}`} el={el} />;
      })}
    </>
  );
}

/* -------------------------------------------------------------------- */
/*  Empty media placeholder                                             */
/* -------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------- */
/*  Error state for aigenerating placeholder                            */
/* -------------------------------------------------------------------- */

function GenErrorPanel({
  width,
  height,
  elementId,
  error,
  onDelete,
}: {
  width: number;
  height: number;
  elementId: string;
  error: AIGenerationError;
  onDelete: () => void;
}) {
  const [retrying, setRetrying] = useState(false);
  const isMissingKey = error.kind === 'missingKey';

  const handlePrimary = async () => {
    if (isMissingKey) {
      window.dispatchEvent(new CustomEvent('open-settings'));
      return;
    }
    setRetrying(true);
    try {
      await retryGeneration(elementId);
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div
      className="flex flex-col overflow-hidden pointer-events-auto paper-scroll"
      style={{
        width,
        height,
        background: 'var(--danger-soft)',
        border: '1px solid color-mix(in oklch, var(--danger) 25%, transparent)',
        borderRadius: 'var(--r-md)',
        boxShadow: 'var(--shadow-ink-2)',
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        className="flex items-center gap-2 hairline-b"
        style={{
          padding: '8px 12px',
          background: 'color-mix(in oklch, var(--danger) 10%, transparent)',
          borderBottomColor: 'color-mix(in oklch, var(--danger) 20%, transparent)',
        }}
      >
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" strokeWidth={1.8} style={{ color: 'var(--danger)' }} />
        <span className="serif" style={{ fontSize: 12, fontWeight: 500, color: 'var(--danger)' }}>
          生成失败
        </span>
      </div>
      <div
        className="flex-1 min-h-0 overflow-auto paper-scroll"
        style={{
          padding: '8px 12px',
          fontSize: 12,
          color: 'var(--danger)',
          lineHeight: 1.45,
        }}
      >
        <div style={{ fontWeight: 500, wordBreak: 'break-word' }} title={error.message}>
          {error.message}
        </div>
        {error.detail && (
          <details className="mt-1.5" style={{ fontSize: 11, color: 'color-mix(in oklch, var(--danger) 80%, var(--ink-1))' }}>
            <summary className="cursor-pointer select-none">查看原始响应</summary>
            <pre
              className="mt-1 mono paper-scroll"
              style={{
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontSize: 10.5,
                background: 'var(--bg-1)',
                borderRadius: 4,
                padding: 6,
                maxHeight: 96,
                overflow: 'auto',
              }}
            >
              {error.detail}
            </pre>
          </details>
        )}
      </div>
      <div
        className="flex items-center gap-1.5 hairline-t"
        style={{
          padding: '6px 8px',
          background: 'color-mix(in oklch, var(--danger) 6%, transparent)',
          borderTopColor: 'color-mix(in oklch, var(--danger) 20%, transparent)',
        }}
      >
        <button
          type="button"
          onClick={handlePrimary}
          disabled={retrying}
          className="btn btn-danger"
          style={{
            padding: '4px 10px',
            fontSize: 11,
            background: 'var(--danger)',
            color: 'var(--accent-fg)',
            borderColor: 'var(--danger)',
          }}
        >
          {isMissingKey ? (
            <>
              <SettingsIcon className="w-3 h-3" strokeWidth={1.6} />
              去设置
            </>
          ) : retrying ? (
            <>
              <span
                className="anim-ink-diffuse inline-block"
                style={{ width: 7, height: 7, borderRadius: '50%', background: 'currentColor' }}
              />
              重试中…
            </>
          ) : (
            <>
              <RefreshCw className="w-3 h-3" strokeWidth={1.6} />
              重试
            </>
          )}
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="btn btn-ghost"
          style={{ padding: '4px 10px', fontSize: 11, color: 'var(--danger)' }}
        >
          <Trash2 className="w-3 h-3" strokeWidth={1.6} />
          移除
        </button>
      </div>
    </div>
  );
}

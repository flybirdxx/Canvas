import { useRef, useState } from 'react';
import { Rect, Text, Group, Image as KonvaImage, Circle } from 'react-konva';
import { Html } from 'react-konva-utils';
import useImage from 'use-image';
import {
  Sparkles, AlignLeft, AlertTriangle, RefreshCw, Trash2,
  Settings as SettingsIcon,
  File as FileIcon, FileText, FileArchive, FileCode, FileAudio, FileVideo,
  FileImage, Upload,
} from 'lucide-react';
import { useCanvasStore } from '../../store/useCanvasStore';
import { retryGeneration } from '../../services/imageGeneration';
import { AIGenerationError } from '../../types/canvas';
import {
  formatBytes, formatDuration, previewKindForMime, buildFileElement,
} from '../../services/fileIngest';
import type { FilePreviewKind } from '../../services/fileIngest';

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
const BG_1 = '#F5EFE4';              // --bg-1 sRGB mirror (warm paper)

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

// 图片/占位图必须锁死长宽比——否则拉框会把 KonvaImage 压扁，而且后续
// 生成完成回填真图时尺寸不一致会再拉一次，用户根本还不回来。
// 其它节点（rect/circle/text 等）保持自由缩放的旧行为，不改动。
//
// `file` 类型：凡是卡面就是一张真实渲染图（image kind / video 首帧 /
// audio 波形图）都锁比例，避免缩放时画面被压扁；PDF / other 没有缩略
// 图，卡面是纯文本布局，允许自由拉宽让用户按文件名调大小。
const MIN_W = 60;
const MIN_H = 40;
function shouldLockAspectRatio(el: any): boolean {
  if (el.type === 'image' || el.type === 'aigenerating') return true;
  if (el.type === 'file') {
    const mt = String(el.mimeType || '').toLowerCase();
    if (mt.startsWith('image/')) return true;
    // video / audio 只要抽到了缩略图就按原生比例锁定；抽取失败回落到通用
    // 卡（无 thumbnailDataUrl），这时允许自由拉伸。
    if ((mt.startsWith('video/') || mt.startsWith('audio/')) && el.thumbnailDataUrl) return true;
  }
  return false;
}

function SelectionHandles({ el }: { el: any }) {
  const { x, y, width, height, id } = el;
  const lockRatio = shouldLockAspectRatio(el);
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

            if (lockRatio && ow > 0 && oh > 0) {
              // 长宽比锁定：以拖拽起点的 w/h 作为基准比；两个轴选"相对位移更大"
              // 的那一根作为 driver，另一根直接由比例反推。
              // 对角顶点（和当前 corner 对角）必须保持固定——否则会看到边长对了
              // 但节点整体在漂。所以 minW/minH 先 clamp 到 newW/newH，再根据
              // corner 反推新的 newX/newY。
              const aspect = ow / oh;
              let rawW = ow;
              let rawH = oh;
              if (corner === 'tl') { rawW = ow - dx; rawH = oh - dy; }
              if (corner === 'tr') { rawW = ow + dx; rawH = oh - dy; }
              if (corner === 'bl') { rawW = ow - dx; rawH = oh + dy; }
              if (corner === 'br') { rawW = ow + dx; rawH = oh + dy; }

              // 哪一轴变化幅度大就听谁的；避免鼠标稍微抖一下 H 就盖过 W。
              const absDW = Math.abs(rawW - ow);
              const absDH = Math.abs(rawH - oh);
              if (absDW >= absDH) {
                newW = Math.max(MIN_W, rawW);
                newH = newW / aspect;
              } else {
                newH = Math.max(MIN_H, rawH);
                newW = newH * aspect;
              }
              // 反向再兜一下，防止另一轴低于最小值。
              if (newW < MIN_W) { newW = MIN_W; newH = newW / aspect; }
              if (newH < MIN_H) { newH = MIN_H; newW = newH * aspect; }

              // 根据 corner 把对角顶点钉死：只有被拖的那个角在动。
              switch (corner) {
                case 'tl': newX = ox + ow - newW; newY = oy + oh - newH; break;
                case 'tr': newY = oy + oh - newH; break;
                case 'bl': newX = ox + ow - newW; break;
                case 'br': break;
              }
            } else {
              if (corner === 'tl') { newX = ox + dx; newY = oy + dy; newW = Math.max(MIN_W, ow - dx); newH = Math.max(MIN_H, oh - dy); }
              if (corner === 'tr') { newY = oy + dy; newW = Math.max(MIN_W, ow + dx); newH = Math.max(MIN_H, oh - dy); }
              if (corner === 'bl') { newX = ox + dx; newW = Math.max(MIN_W, ow - dx); newH = Math.max(MIN_H, oh + dy); }
              if (corner === 'br') { newW = Math.max(MIN_W, ow + dx); newH = Math.max(MIN_H, oh + dy); }
            }

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
        else if (el.type === 'file') {
          const fileEl = el as any;
          const fileKind = previewKindForMime(String(fileEl.mimeType || ''));
          // "有视觉缩略图"的三条路径合并走 Konva：image 用 src 本身；video
          // 用首帧 thumbnailDataUrl；audio 用波形 thumbnailDataUrl。Konva
          // 渲染 + 透明 hit rect 能保证全卡面拖拽、缩放期间命中开销恒定。
          //
          // pdf / other 或抽取失败时回落到 DOM 卡面（AttachmentCardBody），
          // 靠 pointer-events: none 让 Konva 接管拖拽；卡内无任何交互元素，
          // 不会抢事件。
          const hasThumb = fileKind === 'image'
            ? !!fileEl.src
            : !!fileEl.thumbnailDataUrl;

          if (hasThumb) {
            const thumbSrc = fileKind === 'image' ? fileEl.src : fileEl.thumbnailDataUrl;
            nodeContent = (
              <Group>
                {/* Hit target：和 rectangle / circle / text 等分支一致，留一
                    张透明 Rect 专门承接 Konva 的 hit canvas；这是节点能被
                    选中/拖拽/缩放的唯一命中面。FileImageKonvaBody 里所有
                    shapes 都 listening=false，是故意让命中测试只打到这
                    一层，保持拖拽期间命中开销恒定。 */}
                <Rect width={width} height={height} fill="transparent" />
                <FileImageKonvaBody el={fileEl} src={thumbSrc} width={width} height={height} />
                <Html divProps={{ style: { pointerEvents: 'none' } }}>
                  <div className="relative" style={{ width, height, pointerEvents: 'none' }}>
                    {/* video 需要一个"▶"中央覆盖层暗示这是可打开播放的视频，
                        而不是一张普通截图；audio / image 不需要（波形 / 图
                        自己即表达）。 */}
                    {fileKind === 'video' && <FileVideoPlayBadge />}
                    <FileNodeOverlayChips
                      el={fileEl}
                      width={width}
                      height={height}
                      kind={fileKind}
                      absoluteInCard
                    />
                    <FileNodeInfoBand el={fileEl} />
                  </div>
                </Html>
              </Group>
            );
          } else {
            nodeContent = (
              <Group>
                <Rect width={width} height={height} fill="transparent" />
                <Html divProps={{ style: { pointerEvents: 'none' } }}>
                  <FileNodeBody el={fileEl} width={width} height={height} />
                </Html>
              </Group>
            );
          }
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

/**
 * 失败态面板。早期版本是个塞满整个 aigenerating 节点的红色大块（header +
 * body + footer 三段式），视觉上像节点"被炸了"，而且用户完全看不到下方
 * 的 NodeInputBar，只能走面板里的"重试"按钮（= 原参数重试），无法调整
 * prompt / model / 档位。
 *
 * 现在改成：
 *   · 外层保留节点的 polaroid 框（尺寸不变），只给它一层淡红描边和底色
 *     表示"这一格出事了"；
 *   · 内层是个**自适应宽度的紧凑卡片**居中贴底显示，占节点下沿的一条；
 *   · 详情（原始响应）默认折叠，不把节点撑爆；
 *   · 重试 / 移除按钮留在卡片内，作为"同参数再来一次"的快捷入口；
 *   · 上方大片空间留空，让用户在 `InfiniteCanvas` 渲染的 NodeInputBar 里
 *     调参数 → 提交（handleSubmit 把失败 placeholder 视作 replace-in-place
 *     锚点，就地换成新 placeholder）。
 */
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
      className="relative overflow-hidden pointer-events-auto"
      style={{
        ...POLAROID_STYLE,
        width,
        height,
        borderColor: 'color-mix(in oklch, var(--danger) 32%, var(--line-1))',
        background: 'color-mix(in oklch, var(--danger) 4%, var(--bg-0))',
        boxShadow: '0 0 0 1px color-mix(in oklch, var(--danger) 18%, transparent), var(--shadow-ink-2)',
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* 轻度红晕背景提示失败状态，不遮挡内容 */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse at center,
            color-mix(in oklch, var(--danger) 10%, transparent) 0%,
            transparent 70%)`,
          pointerEvents: 'none',
        }}
      />
      {/* Compact card at bottom. 采用 "贴底" 而不是 "居中" 的布局，原因：
          如果节点被缩得很小（比如 200×160），居中卡片会把框填满；贴底则
          上半部分永远空着，给用户一种"这个节点还在等你重配"的暗示。
          max-height 控制住详情展开时不会超出节点。 */}
      <div
        className="absolute left-2 right-2 bottom-2 flex flex-col gap-1.5"
        style={{ maxHeight: 'calc(100% - 16px)' }}
      >
        <div className="flex items-start gap-1.5 min-w-0">
          <AlertTriangle
            className="w-3.5 h-3.5 shrink-0"
            strokeWidth={1.8}
            style={{ color: 'var(--danger)', marginTop: 2 }}
          />
          <div className="flex-1 min-w-0">
            <div
              className="serif"
              style={{
                fontSize: 11.5,
                fontWeight: 600,
                color: 'var(--danger)',
                lineHeight: 1.2,
              }}
            >
              生成失败
            </div>
            <div
              style={{
                fontSize: 11,
                color: 'color-mix(in oklch, var(--danger) 85%, var(--ink-1))',
                lineHeight: 1.4,
                marginTop: 2,
                // 超过 3 行就截断；详情在 details 里展开
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                wordBreak: 'break-word',
              }}
              title={error.message}
            >
              {error.message}
            </div>
          </div>
        </div>

        {error.detail && (
          <details
            style={{
              fontSize: 10.5,
              color: 'color-mix(in oklch, var(--danger) 75%, var(--ink-1))',
            }}
          >
            <summary className="cursor-pointer select-none" style={{ opacity: 0.85 }}>
              查看原始响应
            </summary>
            <pre
              className="mt-1 mono paper-scroll"
              style={{
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontSize: 10,
                background: 'var(--bg-1)',
                border: '1px solid var(--line-1)',
                borderRadius: 4,
                padding: 6,
                maxHeight: 80,
                overflow: 'auto',
              }}
            >
              {error.detail}
            </pre>
          </details>
        )}

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handlePrimary}
            disabled={retrying}
            className="btn btn-danger"
            style={{
              padding: '3px 9px',
              fontSize: 10.5,
              background: 'var(--danger)',
              color: 'var(--accent-fg)',
              borderColor: 'var(--danger)',
            }}
            title={isMissingKey ? '打开设置面板' : '以原参数重新发起生成'}
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
                  style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }}
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
            style={{ padding: '3px 9px', fontSize: 10.5, color: 'var(--danger)' }}
            title="从画布移除此占位符"
          >
            <Trash2 className="w-3 h-3" strokeWidth={1.6} />
            移除
          </button>
          <span
            className="serif-it"
            style={{
              fontSize: 10,
              color: 'color-mix(in oklch, var(--ink-2) 80%, transparent)',
              marginLeft: 'auto',
              paddingRight: 2,
            }}
            title="在下方输入条调整参数后提交即可就地替换此占位符"
          >
            或在下方调整后重新提交
          </span>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- */
/*  File attachment node                                                */
/* -------------------------------------------------------------------- */

/**
 * 通用文件附件节点的渲染体。
 *
 * 布局：**全幅预览** + 右上角悬浮"替换"胶囊。故意不再挂头部的 FILE 标签
 * 或底部的文件名/大小条——这些装饰条在附件节点很密集时会让画布变成密
 * 密麻麻的 info chips，读起来反而比原文件还累。文件名、大小、MIME 通
 * 过 `title` 原生 tooltip 暴露；要系统化展示再回到 PropertiesPanel。
 *
 * 视觉上沿用 Warm Paper Studio 的 token（POLAROID_STYLE 纸质卡 + 羊皮
 * 暖背景），没有为了"更酷"切到深色玻璃；和 image / video 节点保持同族
 * 观感。
 *
 * 按 `mimeType` 走四档智能预览：
 *   · image/\*          → <img object-fit:contain>
 *   · video/\*          → <video controls>
 *   · audio/\*          → <audio controls>，文件名显式挂出来（音频无视觉
 *                         内容，只有原生控制条太孤立）
 *   · application/pdf   → <iframe>（浏览器原生 PDF 查看器）
 *   · 其它              → 附件卡片 (AttachmentCardBody)
 */
function FileNodeBody({
  el,
  width,
  height,
}: {
  el: any;
  width: number;
  height: number;
}) {
  const name = String(el.name || 'untitled');
  const mime = String(el.mimeType || '');
  const kind = previewKindForMime(mime);
  const sizeLabel = formatBytes(Number(el.sizeBytes) || 0);
  const tooltip = `${name}\n${sizeLabel}${mime ? ` · ${mime}` : ''}`;

  // 交互模型：文件节点按"资料卡"而非"嵌入式播放器"来设计——
  // - 卡片根 div 显式 pointer-events: none → 整张卡都是 Konva 的命中
  //   面，任何地方点/拖都能选中/拖拽/缩放节点，和 image / rect 等节点
  //   体验一致。
  // - 卡内一律不挂原生播放控件（<video/audio/iframe controls>）。这些
  //   控件一旦 pointer-events: auto 就会铺满卡面抢事件，让用户无法全
  //   卡面拖拽。要看/听/读内容 → 点右上角"打开"胶囊在新标签预览，这
  //   是资料卡应有的行为（对齐 Figma 附件、Notion 文件块等同类产品）。
  // - 唯一的 DOM 交互热点就是右上角的胶囊条（替换 / 打开），由
  //   FileNodeOverlayChips 自行管理 opt-in。
  return (
    <div
      className="relative overflow-hidden"
      style={{ ...POLAROID_STYLE, width, height, pointerEvents: 'none' }}
      title={tooltip}
    >
      <div
        className="flex items-center justify-center overflow-hidden"
        style={{ width: '100%', height: '100%', background: 'var(--bg-2)' }}
      >
        {/* 图像 kind 在上层已经走 Konva 渲染路径；这里保留 <img> 作为从
            Html 路径误路由时的兜底，避免空白。正常链路不会进来。 */}
        {kind === 'image' && el.src && (
          <img
            src={el.src}
            alt={name}
            draggable={false}
            style={{
              width: '100%', height: '100%', objectFit: 'contain', display: 'block',
            }}
          />
        )}
        {/* video / audio / pdf / other 统一走占位缩略卡：大图标 +
            文件名 + 元信息。AttachmentCardBody 已经覆盖这套布局，直接
            复用。pickAttachmentIcon 会按 MIME 选合适的 lucide 图标（视
            频用 FileVideo，音频用 FileAudio，PDF 用 FileText，其它按扩
            展名分类）。 */}
        {kind !== 'image' && (
          <AttachmentCardBody
            name={name}
            mime={mime}
            sizeLabel={sizeLabel}
            pageCount={typeof el.pageCount === 'number' ? el.pageCount : undefined}
          />
        )}
      </div>

      <FileNodeOverlayChips
        el={el}
        width={width}
        height={height}
        kind={kind}
        absoluteInCard
      />
    </div>
  );
}

/**
 * 图像类型 file 节点的 Konva 渲染。纯 Konva 层，无 DOM overlay——拖拽
 * 时只触发 Konva canvas 的 GPU 重绘，不会走 react-konva-utils 的 Html
 * reposition 开销；这是把 file 节点的拖拽流畅度和 image 节点拉齐的关
 * 键。
 *
 * 包含三层：
 *   1) 1px 偏移的 PAPER_EDGE 描边 Rect：复刻宝丽来卡纸的外描边
 *   2) BG_1 填充 Rect：底纸颜色，给没图或透明 PNG 留底
 *   3) KonvaImage：按 contain 数学居中贴入，保留纸质阴影
 *
 * 尺寸：`buildFileElement` 已按真实 naturalWidth/Height 锁好节点框，
 * 理论上 width/height 和图片原生比例一致，这里额外再算一次 contain 做
 * 防御——兼容从旧版持久化回来的 320×320 节点或用户手动缩放出的非比例
 * 框。
 */
function FileImageKonvaBody({
  el, src, width, height,
}: {
  el: any;
  /** 要画的图源——image kind 传 el.src（原图本身），video/audio 传 el.thumbnailDataUrl。 */
  src?: string;
  width: number;
  height: number;
}) {
  const imageSrc = src ?? el.src ?? '';
  const [img] = useImage(imageSrc);
  const paperRect = (
    <Rect
      x={-1} y={-1}
      width={width + 2} height={height + 2}
      cornerRadius={13}
      stroke={PAPER_EDGE}
      strokeWidth={1}
      listening={false}
    />
  );
  const bgRect = (
    <Rect
      width={width} height={height}
      cornerRadius={12}
      fill={BG_1}
      shadowColor="rgba(40,30,20,0.12)"
      shadowBlur={20}
      shadowOffsetY={6}
      shadowOpacity={1}
      listening={false}
    />
  );
  if (!img) {
    // 图片未加载完：只画纸底，避免空白节点先闪一下再内容跳变
    return <>{paperRect}{bgRect}</>;
  }
  // contain 数学：按短边适配，另一轴居中留白
  const nw = img.naturalWidth || img.width || 1;
  const nh = img.naturalHeight || img.height || 1;
  const imgAspect = nw / nh;
  const frameAspect = width / height;
  let drawW: number; let drawH: number; let drawX: number; let drawY: number;
  if (imgAspect > frameAspect) {
    drawW = width;
    drawH = width / imgAspect;
    drawX = 0;
    drawY = (height - drawH) / 2;
  } else {
    drawH = height;
    drawW = height * imgAspect;
    drawX = (width - drawW) / 2;
    drawY = 0;
  }
  return (
    <>
      {paperRect}
      {bgRect}
      <KonvaImage
        image={img}
        x={drawX}
        y={drawY}
        width={drawW}
        height={drawH}
        cornerRadius={12}
        listening={false}
      />
    </>
  );
}

/**
 * 视频节点中央的"▶"徽标。让用户一眼区分"这是一张截图" vs "这是一段视频
 * 的首帧"——截图不会有这个覆盖层。pointer-events: none，不参与交互，
 * 真正的播放入口仍然是右上角的"打开"胶囊。
 */
function FileVideoPlayBadge() {
  const SIZE = 44;
  return (
    <div
      className="absolute flex items-center justify-center"
      style={{
        top: '50%',
        left: '50%',
        width: SIZE,
        height: SIZE,
        marginTop: -SIZE / 2,
        marginLeft: -SIZE / 2,
        borderRadius: '50%',
        background: 'rgba(25, 20, 15, 0.55)',
        backdropFilter: 'blur(1px)',
        boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
        pointerEvents: 'none',
      }}
    >
      {/* CSS 三角代替 SVG：更轻；视觉微右偏，光学上更居中。 */}
      <span
        style={{
          display: 'inline-block',
          width: 0,
          height: 0,
          marginLeft: 3,
          borderTop: '8px solid transparent',
          borderBottom: '8px solid transparent',
          borderLeft: '13px solid rgba(255, 248, 235, 0.95)',
        }}
      />
    </div>
  );
}

/**
 * 底部左下角的"信息胶囊"。给所有"有视觉缩略图"的 file 节点用——image /
 * video / audio 卡面都被内容塞满，文件名 / 大小只靠 hover tooltip 会在
 * 多张类似截图/波形图之间无法区分，这一条常驻 chip 把元信息固化进视觉。
 * 刻意压低视觉权重：
 *
 *   · pointer-events: none，绝不抢 Konva 的拖拽 / 选中事件
 *   · 最大宽度压到 70% 节点宽，ellipsis 截断长文件名
 *   · 底色沿用 chip-paper，和右上角"替换/打开"呼应但更安静（无 hover 态）
 *
 * video/audio 还会在右段补一个时长 `02:35`；pdf（在 AttachmentCardBody 里
 * 展示）显示页数。
 */
function FileNodeInfoBand({ el }: { el: any }) {
  const name = String(el.name || 'untitled');
  const sizeLabel = formatBytes(Number(el.sizeBytes) || 0);
  const durationMs = typeof el.durationMs === 'number' ? el.durationMs : undefined;
  const durationLabel = durationMs ? formatDuration(durationMs) : '';
  return (
    <div
      className="absolute flex items-center chip-paper"
      style={{
        left: 10,
        bottom: 10,
        padding: '3px 8px',
        borderRadius: 'var(--r-full, 999px)',
        fontSize: 10,
        lineHeight: 1.2,
        color: 'var(--ink-1)',
        letterSpacing: '0.02em',
        maxWidth: '70%',
        pointerEvents: 'none',
        opacity: 0.92,
      }}
      title={`${name} · ${sizeLabel}${durationLabel ? ` · ${durationLabel}` : ''}`}
    >
      <span
        style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: '100%',
        }}
      >
        {name}
        <span style={{ color: 'var(--ink-3)' }}>
          {' · '}{sizeLabel}
          {durationLabel && <> · {durationLabel}</>}
        </span>
      </span>
    </div>
  );
}

/**
 * 文件节点右上角的交互胶囊组（替换 + 可选"打开"）。从 FileNodeBody 里
 * 抽出来，供纯 Konva 路径（image kind）共用：Konva 层负责画内容，这个
 * 组件以 DOM absolute 定位悬浮在节点右上角，通过 pointer-events-auto
 * 自身 opt-in 响应点击，其余区域维持 pointer-events: none 让 Konva 拿
 * 到拖拽事件。
 *
 * `absoluteInCard`：区分父容器是不是已有 `position: relative`。
 *   - true ：被 FileNodeBody 直接内嵌，父是 relative 的卡片 → 用 absolute
 *   - false：被 Html overlay 作为根内容（image kind），Html 自己是
 *            pointer-events: none 的 full-size div，不保证 relative；
 *            此时自己套一层 relative 容器。
 */
function FileNodeOverlayChips({
  el, width, height, kind, absoluteInCard,
}: {
  el: any;
  width: number;
  height: number;
  kind: FilePreviewKind;
  absoluteInCard?: boolean;
}) {
  const name = String(el.name || 'untitled');
  const mime = String(el.mimeType || '');
  const sizeLabel = formatBytes(Number(el.sizeBytes) || 0);
  const tooltip = `${name}\n${sizeLabel}${mime ? ` · ${mime}` : ''}`;

  const updateElement = useCanvasStore(s => s.updateElement);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  const handleReplaceClick = () => {
    replaceInputRef.current?.click();
  };
  const handleReplaceChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      // 以当前节点"几何中心"为 origin 走一次完整 buildFileElement：让新文件
      // 按 MIME 重新抽取缩略图 / 时长 / 页数，并按原生宽高比给出新尺寸。
      // 中心不变是为了用户直觉——"内容换了，位置没动"。id / 端口 / 既有
      // 连接都通过 updateElement 的 merge 语义保留，图库端口（file image
      // 节点的 image output）也不会丢。
      const cx = el.x + el.width / 2;
      const cy = el.y + el.height / 2;
      const rebuilt = await buildFileElement(file, { x: cx, y: cy });
      // 显式把可选字段一并写入（包括 undefined），确保从视频/音频换成 PDF
      // 时旧的 thumbnailDataUrl / durationMs 会被 overwrite 掉，而不是残留。
      updateElement(el.id, {
        name: rebuilt.name,
        mimeType: rebuilt.mimeType,
        sizeBytes: rebuilt.sizeBytes,
        src: rebuilt.src,
        x: rebuilt.x,
        y: rebuilt.y,
        width: rebuilt.width,
        height: rebuilt.height,
        thumbnailDataUrl: rebuilt.thumbnailDataUrl,
        durationMs: rebuilt.durationMs,
        pageCount: rebuilt.pageCount,
      } as any);
    } catch (err) {
      console.warn('[file] replace failed', file.name, err);
    }
  };

  const stopPropagation = (e: React.SyntheticEvent) => e.stopPropagation();
  const interactiveStyle = { pointerEvents: 'auto' as const };

  const chipBar = (
    <div
      className="absolute flex items-center gap-1.5"
      style={{ top: 10, right: 10, ...interactiveStyle }}
      onPointerDown={stopPropagation}
    >
      {/* 非图像类型（video / audio / pdf / other）没有卡内的内嵌预览，
          所有"看内容"的入口都收口在这颗"打开"胶囊——新标签页打开 data URL，
          浏览器会按 MIME 自行决定：视频/音频/PDF 直接内置播放；压缩包等
          未知类型走下载对话框。图像 kind 卡面自己就显示了内容，不需要。 */}
      {kind !== 'image' && el.src && (
        <a
          href={el.src}
          download={name}
          target="_blank"
          rel="noopener noreferrer"
          className="chip-paper flex items-center gap-1 no-underline"
          style={{
            padding: '4px 9px',
            borderRadius: 'var(--r-full, 999px)',
            fontSize: 10.5,
            color: 'var(--ink-0)',
            lineHeight: 1,
            cursor: 'pointer',
          }}
          title="在新标签打开 / 下载"
          onMouseEnter={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-ink-2)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.boxShadow = ''; }}
        >
          <FileText className="w-3 h-3" strokeWidth={1.8} />
          <span className="serif-it" style={{ letterSpacing: '0.02em' }}>打开</span>
        </a>
      )}
      <button
        type="button"
        onClick={handleReplaceClick}
        className="chip-paper flex items-center gap-1 transition-all"
        style={{
          padding: '4px 9px',
          borderRadius: 'var(--r-full, 999px)',
          fontSize: 10.5,
          color: 'var(--ink-0)',
          cursor: 'pointer',
          lineHeight: 1,
        }}
        title={`替换当前附件\n${tooltip}`}
        onMouseEnter={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-ink-2)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.boxShadow = ''; }}
      >
        <Upload className="w-3 h-3" strokeWidth={1.8} />
        <span className="serif-it" style={{ letterSpacing: '0.02em' }}>替换</span>
      </button>
      <input
        ref={replaceInputRef}
        type="file"
        accept="*/*"
        style={{ display: 'none' }}
        onChange={handleReplaceChange}
      />
    </div>
  );

  if (absoluteInCard) return chipBar;
  // image kind 路径：Html 根内容需要自带一个 relative 容器承载 absolute
  // 定位的胶囊条。外层 div pointer-events: none，内部 chipBar 自身 opt-in。
  return (
    <div className="relative" style={{ width, height, pointerEvents: 'none' }}>
      {chipBar}
    </div>
  );
}

/**
 * 附件卡片：没有原生预览时的降级展示。纯展示型——大号图标 + 文件名 +
 * 元信息（大小 · 扩展名），**不绑定任何点击事件**；整张卡片继承外层
 * Html 的 pointer-events: none，保证 Konva 能正常在这里响应拖拽 / 选
 * 中 / 缩放。
 *
 * "打开 / 下载"的入口已经上提到外层 FileNodeBody 的右上角胶囊里，和
 * "替换"并列，保持交互只存在于右上角这一个明确区域，避免点卡片面积
 * 时和画布拖拽抢事件。
 */
function AttachmentCardBody({
  name,
  mime,
  sizeLabel,
  pageCount,
  durationLabel,
}: {
  name: string;
  mime: string;
  sizeLabel: string;
  /** PDF 页数（可选，解析失败时缺省），在元信息行显示。 */
  pageCount?: number;
  /** video/audio 抽取失败时的降级路径仍可能带时长，但目前只有主卡片走缩略
   *  图分支会写时长，这里留一个入口以防之后扩展。 */
  durationLabel?: string;
}) {
  const Icon = pickAttachmentIcon(name, mime);
  const metaParts: string[] = [sizeLabel];
  if (pageCount && pageCount > 0) metaParts.push(`${pageCount} 页`);
  else if (mime) metaParts.push(mime.split('/').pop() || '');
  if (durationLabel) metaParts.push(durationLabel);
  return (
    <div
      className="flex flex-col items-center justify-center gap-2.5"
      style={{
        width: '100%',
        height: '100%',
        padding: 16,
        textAlign: 'center',
      }}
    >
      <Icon
        className="w-9 h-9"
        strokeWidth={1.3}
        style={{ color: 'var(--ink-2)' }}
      />
      <div
        style={{
          fontSize: 12,
          color: 'var(--ink-0)',
          fontWeight: 500,
          lineHeight: 1.3,
          wordBreak: 'break-all',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          maxWidth: '100%',
        }}
      >
        {name}
      </div>
      <div
        className="meta"
        style={{ fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.03em' }}
      >
        {metaParts.filter(Boolean).join(' · ')}
      </div>
    </div>
  );
}

/**
 * 按扩展名/MIME 挑一个 lucide 图标。目的是让用户一眼认出"这是个压缩包
 * 还是文档"，纯美学；任何无法归类的都回退到通用 FileIcon。
 */
function pickAttachmentIcon(name: string, mime: string) {
  const mt = mime.toLowerCase();
  if (mt.startsWith('image/')) return FileImage;
  if (mt.startsWith('video/')) return FileVideo;
  if (mt.startsWith('audio/')) return FileAudio;

  const ext = name.toLowerCase().split('.').pop() || '';
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'].includes(ext)) return FileArchive;
  if ([
    'js', 'jsx', 'ts', 'tsx', 'py', 'rb', 'go', 'rs', 'java', 'c', 'cpp', 'h',
    'css', 'scss', 'html', 'json', 'yaml', 'yml', 'toml', 'xml', 'sh', 'bat', 'ps1',
  ].includes(ext)) return FileCode;
  if (['txt', 'md', 'markdown', 'rtf', 'log', 'csv', 'doc', 'docx'].includes(ext)) return FileText;

  return FileIcon;
}

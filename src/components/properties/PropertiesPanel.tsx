import {
  Layers, Type, Square, Settings2, Trash2, Link2, Upload,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
} from 'lucide-react';
import { useCanvasStore } from '../../store/useCanvasStore';

/**
 * PropertiesPanel — right-anchored paper chip inspector.
 *
 * Renders only when something is selected. Paper-chip chrome; sections
 * separated by hairline rules; section headers use mono meta chips.
 * Inputs are .input-paper (sunken bg with signal focus ring).
 */
export function PropertiesPanel() {
  const { elements, selectedIds, updateElement, deleteElements } = useCanvasStore();

  if (selectedIds.length === 0) return null;

  // For MVP: show properties for the first selected element only.
  const selectedId = selectedIds[0];
  const el = elements.find(e => e.id === selectedId);
  if (!el) return null;

  const hasSize =
    el.type === 'rectangle' || el.type === 'circle' ||
    el.type === 'image' || el.type === 'sticky' ||
    el.type === 'video' || el.type === 'audio';

  const isMedia = el.type === 'image' || el.type === 'video' || el.type === 'audio';
  const isShapeOrText =
    el.type === 'rectangle' || el.type === 'circle' ||
    el.type === 'text' || el.type === 'sticky';

  return (
    <aside
      className="chip-paper anim-fade-in z-30 pointer-events-auto flex flex-col overflow-hidden"
      style={{
        position: 'absolute',
        top: 72,
        right: 16,
        width: 280,
        maxHeight: 'calc(100vh - 148px)',
        boxShadow: 'var(--shadow-ink-2)',
      }}
    >
      {/* Header */}
      <header
        className="flex items-center justify-between hairline-b"
        style={{ padding: '10px 14px', background: 'var(--bg-2)' }}
      >
        <div className="flex items-center gap-2">
          <Settings2 className="w-3.5 h-3.5" strokeWidth={1.6} style={{ color: 'var(--ink-2)' }} />
          <span
            className="serif"
            style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-0)' }}
          >
            属性
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="chip-meta">{el.type}</span>
          <button
            onClick={() => deleteElements([el.id])}
            className="btn btn-ghost btn-icon"
            style={{ width: 26, height: 26, padding: 0 }}
            title="删除元素 (Delete)"
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--danger-soft)';
              e.currentTarget.style.color = 'var(--danger)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--ink-1)';
            }}
          >
            <Trash2 className="w-3.5 h-3.5" strokeWidth={1.6} />
          </button>
        </div>
      </header>

      <div
        className="paper-scroll flex flex-col overflow-y-auto"
        style={{ padding: 14, gap: 16 }}
      >
        {/* Layout group */}
        <section className="flex flex-col gap-2.5">
          <SectionHead icon={<Layers className="w-3 h-3" strokeWidth={1.8} />}>布局</SectionHead>
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="X">
              <input
                type="number"
                value={Math.round(el.x)}
                onChange={(e) => updateElement(el.id, { x: Number(e.target.value) })}
                className="input-paper mono"
                style={{ fontSize: 11.5 }}
              />
            </Field>
            <Field label="Y">
              <input
                type="number"
                value={Math.round(el.y)}
                onChange={(e) => updateElement(el.id, { y: Number(e.target.value) })}
                className="input-paper mono"
                style={{ fontSize: 11.5 }}
              />
            </Field>
            {hasSize && (
              <>
                <Field label="宽">
                  <input
                    type="number"
                    value={Math.round(el.width)}
                    onChange={(e) =>
                      updateElement(el.id, { width: Math.max(5, Number(e.target.value)) })
                    }
                    className="input-paper mono"
                    style={{ fontSize: 11.5 }}
                  />
                </Field>
                <Field label="高">
                  <input
                    type="number"
                    value={Math.round(el.height)}
                    onChange={(e) =>
                      updateElement(el.id, { height: Math.max(5, Number(e.target.value)) })
                    }
                    className="input-paper mono"
                    style={{ fontSize: 11.5 }}
                  />
                </Field>
              </>
            )}
          </div>
        </section>

        {isMedia && (
          <>
            <hr className="rule-ink" />
            <section className="flex flex-col gap-2.5">
              <SectionHead icon={<Link2 className="w-3 h-3" strokeWidth={1.8} />}>媒体源</SectionHead>
              <Field label="链接 URL">
                <input
                  type="text"
                  placeholder="https://…"
                  value={(el as any).src || ''}
                  onChange={(e) => updateElement(el.id, { src: e.target.value })}
                  className="input-paper"
                  style={{ fontSize: 11.5 }}
                />
              </Field>
              <label
                className="relative flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                style={{
                  padding: '7px 10px',
                  borderRadius: 'var(--r-sm)',
                  border: '1px dashed var(--line-2)',
                  background: 'var(--bg-2)',
                  color: 'var(--ink-1)',
                }}
              >
                <input
                  type="file"
                  accept={el.type + '/*'}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (el.type === 'image') {
                      const reader = new FileReader();
                      reader.onload = (ev) =>
                        updateElement(el.id, { src: ev.target?.result as string });
                      reader.readAsDataURL(file);
                    } else {
                      updateElement(el.id, { src: URL.createObjectURL(file) });
                    }
                    e.target.value = '';
                  }}
                />
                <Upload className="w-3.5 h-3.5" strokeWidth={1.6} />
                <span style={{ fontSize: 11.5, fontWeight: 500 }}>
                  上传{el.type === 'image' ? '图片' : el.type === 'video' ? '视频' : '音频'}
                </span>
              </label>
            </section>
          </>
        )}

        {isShapeOrText && (
          <>
            <hr className="rule-ink" />
            <section className="flex flex-col gap-2.5">
              <SectionHead icon={
                el.type === 'text'
                  ? <Type className="w-3 h-3" strokeWidth={1.8} />
                  : <Square className="w-3 h-3" strokeWidth={1.8} />
              }>
                外观与内容
              </SectionHead>

              {(el.type === 'text' || el.type === 'sticky') && (
                <Field label="内容">
                  <textarea
                    value={(el as any).text}
                    onChange={(e) => updateElement(el.id, { text: e.target.value })}
                    className="input-paper"
                    style={{ fontSize: 12, minHeight: 64, lineHeight: 1.55 }}
                  />
                </Field>
              )}

              {el.type === 'text' && (
                <>
                  <Field label="字体">
                    <select
                      value={(el as any).fontFamily || 'var(--font-serif)'}
                      onChange={(e) => updateElement(el.id, { fontFamily: e.target.value })}
                      className="input-paper"
                      style={{ fontSize: 11.5 }}
                    >
                      <option value="var(--font-serif)">Serif · Fraunces</option>
                      <option value="var(--font-sans)">Sans · General Sans</option>
                      <option value="var(--font-mono)">Mono · IBM Plex Mono</option>
                      <option value="sans-serif">System Sans</option>
                      <option value="serif">System Serif</option>
                      <option value="monospace">System Mono</option>
                    </select>
                  </Field>

                  <div>
                    <Label>
                      <span>字号</span>
                      <span className="mono" style={{ color: 'var(--ink-0)' }}>
                        {(el as any).fontSize || 16}px
                      </span>
                    </Label>
                    <input
                      type="range"
                      min="8"
                      max="120"
                      value={(el as any).fontSize || 16}
                      onChange={(e) =>
                        updateElement(el.id, { fontSize: Number(e.target.value) })
                      }
                      className="w-full"
                      style={{ accentColor: 'var(--accent)' }}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <Field label="对齐">
                      <div
                        className="flex"
                        style={{
                          background: 'var(--bg-3)',
                          border: '1px solid var(--line-1)',
                          borderRadius: 'var(--r-sm)',
                          padding: 2,
                        }}
                      >
                        {([
                          { id: 'left', icon: <AlignLeft className="w-3 h-3" /> },
                          { id: 'center', icon: <AlignCenter className="w-3 h-3" /> },
                          { id: 'right', icon: <AlignRight className="w-3 h-3" /> },
                          { id: 'justify', icon: <AlignJustify className="w-3 h-3" /> },
                        ] as const).map((btn) => {
                          const active = ((el as any).align || 'left') === btn.id;
                          return (
                            <button
                              key={btn.id}
                              onClick={() => updateElement(el.id, { align: btn.id as any })}
                              className="flex-1 flex justify-center items-center transition-colors"
                              style={{
                                padding: '4px 0',
                                borderRadius: 'calc(var(--r-sm) - 2px)',
                                background: active ? 'var(--bg-1)' : 'transparent',
                                color: active ? 'var(--accent)' : 'var(--ink-2)',
                                boxShadow: active ? 'var(--shadow-ink-0)' : 'none',
                              }}
                            >
                              {btn.icon}
                            </button>
                          );
                        })}
                      </div>
                    </Field>
                    <Field label="行高">
                      <input
                        type="number"
                        step="0.1"
                        min="0.5"
                        max="5"
                        value={(el as any).lineHeight || 1.2}
                        onChange={(e) =>
                          updateElement(el.id, { lineHeight: Number(e.target.value) })
                        }
                        className="input-paper mono"
                        style={{ fontSize: 11.5 }}
                      />
                    </Field>
                  </div>

                  <Field label="颜色">
                    <ColorPicker
                      value={(el as any).fill || 'var(--ink-0)'}
                      onChange={(color) => updateElement(el.id, { fill: color })}
                    />
                  </Field>
                </>
              )}

              {(el.type === 'rectangle' || el.type === 'circle' || el.type === 'sticky') && (
                <>
                  <Field label="填充">
                    <ColorPicker
                      value={(el as any).fill || '#E1D7CB'}
                      onChange={(color) => updateElement(el.id, { fill: color })}
                    />
                  </Field>

                  {el.type === 'rectangle' && (
                    <div>
                      <Label>
                        <span>圆角</span>
                        <span className="mono" style={{ color: 'var(--ink-0)' }}>
                          {(el as any).cornerRadius || 0}px
                        </span>
                      </Label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={(el as any).cornerRadius || 0}
                        onChange={(e) =>
                          updateElement(el.id, { cornerRadius: Number(e.target.value) })
                        }
                        className="w-full"
                        style={{ accentColor: 'var(--accent)' }}
                      />
                    </div>
                  )}
                </>
              )}
            </section>
          </>
        )}

        {/* Story 2.4: scene 节点编辑 — 外观与内容 */}
        {el.type === 'scene' && (
          <>
            <hr className="rule-ink" />
            <section className="flex flex-col gap-2.5">
              <SectionHead icon={<Square className="w-3 h-3" strokeWidth={1.8} />}>
                分镜内容
              </SectionHead>

              <Field label="场次标题">
                <input
                  type="text"
                  value={(el as any).title || ''}
                  onChange={(e) => updateElement(el.id, { title: e.target.value })}
                  placeholder="例如：咖啡厅相遇"
                  className="input-paper"
                  style={{ fontSize: 12 }}
                />
              </Field>

              <Field label="分镜内容">
                <textarea
                  value={(el as any).content || ''}
                  onChange={(e) => updateElement(el.id, { content: e.target.value })}
                  placeholder="描述这一场的画面、动作、台词..."
                  className="input-paper"
                  style={{ fontSize: 12, minHeight: 80, lineHeight: 1.55, resize: 'vertical' }}
                />
              </Field>

              <Field label="场次编号">
                <input
                  type="number"
                  min={1}
                  value={(el as any).sceneNum || 1}
                  onChange={(e) => updateElement(el.id, { sceneNum: Number(e.target.value) })}
                  className="input-paper mono"
                  style={{ fontSize: 12 }}
                />
              </Field>

              {(el as any).scriptId && (
                <div style={{ fontSize: 11, color: 'var(--ink-2)', padding: '4px 0' }}>
                  来自剧本节点
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------- */

function SectionHead({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <h4
      className="meta flex items-center gap-1.5"
      style={{ color: 'var(--ink-2)' }}
    >
      <span style={{ color: 'var(--ink-3)' }}>{icon}</span>
      {children}
    </h4>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <Label>{label}</Label>
      {children}
    </label>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="flex items-center justify-between"
      style={{
        fontSize: 10.5,
        color: 'var(--ink-2)',
        letterSpacing: '0.02em',
      }}
    >
      {children}
    </span>
  );
}

/** Color picker — paper-styled native picker + warm preset strip. */
function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  // Warm-paper-compatible palette. Neutrals first, accents last.
  const presets = [
    '#F7EFE1', // cream
    '#E1D7CB', // warm gray
    '#F3E3A0', // wax yellow (sticky)
    '#EFC8A3', // peach
    '#CFE0D7', // mint
    '#BFD5E4', // sky
    '#D48A68', // terracotta
    '#3F3A34', // ink
    '#FAFAF8', // paper white
  ];

  return (
    <div className="flex flex-wrap gap-1.5">
      <input
        type="color"
        value={value.startsWith('#') ? value : '#E1D7CB'}
        onChange={(e) => onChange(e.target.value)}
        className="cursor-pointer"
        style={{
          width: 28,
          height: 28,
          padding: 0,
          background: 'transparent',
          border: '1px solid var(--line-1)',
          borderRadius: 'var(--r-sm)',
        }}
      />
      {presets.map((c) => (
        <button
          type="button"
          key={c}
          onClick={() => onChange(c)}
          className="transition-transform"
          style={{
            width: 28,
            height: 28,
            borderRadius: 'var(--r-sm)',
            background: c,
            border: value === c
              ? `2px solid var(--accent)`
              : '1px solid var(--line-1)',
            boxShadow: value === c ? 'var(--shadow-ink-1)' : 'var(--shadow-ink-0)',
            cursor: 'pointer',
          }}
          aria-label={c}
        />
      ))}
    </div>
  );
}

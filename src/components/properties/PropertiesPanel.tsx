import { Layers, Settings2, Trash2, Upload } from 'lucide-react';
import type React from 'react';
import { useCanvasStore } from '@/store/useCanvasStore';
import type { PlanningElement, PlanningNodeKind, PropVisibility } from '@/types/canvas';

const PLANNING_KIND_OPTIONS: { value: PlanningNodeKind; label: string }[] = [
  { value: 'projectSeed', label: '项目种子' },
  { value: 'storyBible', label: '故事圣经' },
  { value: 'characterPackage', label: '角色生产包' },
  { value: 'plot', label: '剧情节点' },
  { value: 'reference', label: '引用对象' },
  { value: 'productionTask', label: '生产任务' },
];

const TASK_TYPE_OPTIONS: { value: NonNullable<PlanningElement['recommendedTaskType']>; label: string }[] = [
  { value: 'image', label: '图片' },
  { value: 'text', label: '文本' },
  { value: 'video', label: '视频' },
  { value: 'audio', label: '音频' },
];

const PROP_VISIBILITY_OPTIONS: { value: PropVisibility; label: string }[] = [
  { value: 'full', label: '完整可见' },
  { value: 'partial', label: '局部可见' },
  { value: 'obscured', label: '被遮挡' },
  { value: 'markOnly', label: '只露标识' },
];

export function PropertiesPanel() {
  const { elements, selectedIds, updateElement, deleteElements } = useCanvasStore();
  if (selectedIds.length === 0) return null;

  const el = elements.find(e => e.id === selectedIds[0]);
  if (!el) return null;

  const hasSize = el.type !== 'aigenerating';
  const isMedia = el.type === 'image' || el.type === 'video' || el.type === 'audio';
  const isTextLike = el.type === 'text' || el.type === 'sticky';
  const isPlanning = el.type === 'planning';

  return (
    <aside
      className="chip-paper anim-fade-in z-30 pointer-events-auto flex flex-col overflow-hidden"
      style={{ position: 'absolute', top: 72, right: 16, width: 280, maxHeight: 'calc(100vh - 148px)', boxShadow: 'var(--shadow-ink-2)' }}
    >
      <header className="flex items-center justify-between hairline-b" style={{ padding: '10px 14px', background: 'var(--bg-2)' }}>
        <div className="flex items-center gap-2">
          <Settings2 className="w-3.5 h-3.5" strokeWidth={1.6} style={{ color: 'var(--ink-2)' }} />
          <span className="serif" style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-0)' }}>属性</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="chip-meta">{el.type}</span>
          <button onClick={() => deleteElements([el.id])} className="btn btn-ghost btn-icon" style={{ width: 26, height: 26, padding: 0 }} title="删除元素">
            <Trash2 className="w-3.5 h-3.5" strokeWidth={1.6} />
          </button>
        </div>
      </header>

      <div className="paper-scroll flex flex-col overflow-y-auto" style={{ padding: 14, gap: 16 }}>
        <section className="flex flex-col gap-2.5">
          <SectionHead icon={<Layers className="w-3 h-3" strokeWidth={1.8} />}>布局</SectionHead>
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="X">
              <input type="number" value={Math.round(el.x)} onChange={e => updateElement(el.id, { x: Number(e.target.value) })} className="input-paper mono" style={{ fontSize: 11.5 }} />
            </Field>
            <Field label="Y">
              <input type="number" value={Math.round(el.y)} onChange={e => updateElement(el.id, { y: Number(e.target.value) })} className="input-paper mono" style={{ fontSize: 11.5 }} />
            </Field>
            {hasSize && (
              <>
                <Field label="宽">
                  <input type="number" value={Math.round(el.width)} onChange={e => updateElement(el.id, { width: Math.max(5, Number(e.target.value)) })} className="input-paper mono" style={{ fontSize: 11.5 }} />
                </Field>
                <Field label="高">
                  <input type="number" value={Math.round(el.height)} onChange={e => updateElement(el.id, { height: Math.max(5, Number(e.target.value)) })} className="input-paper mono" style={{ fontSize: 11.5 }} />
                </Field>
              </>
            )}
          </div>
        </section>

        {isMedia && (
          <>
            <hr className="rule-ink" />
            <section className="flex flex-col gap-2.5">
              <SectionHead icon={<Upload className="w-3 h-3" strokeWidth={1.8} />}>媒体源</SectionHead>
              <Field label="链接 URL">
                <input type="text" placeholder="https://..." value={el.src || ''} onChange={e => updateElement(el.id, { src: e.target.value })} className="input-paper" style={{ fontSize: 11.5 }} />
              </Field>
            </section>
          </>
        )}

        {isTextLike && (
          <>
            <hr className="rule-ink" />
            <section className="flex flex-col gap-2.5">
              <Field label="内容">
                <textarea value={el.text} onChange={e => updateElement(el.id, { text: e.target.value })} className="input-paper" style={{ fontSize: 12, minHeight: 64, lineHeight: 1.55 }} />
              </Field>
            </section>
          </>
        )}

        {isPlanning && (
          <>
            <hr className="rule-ink" />
            <section className="flex flex-col gap-2.5">
              <SectionHead icon={<Layers className="w-3 h-3" strokeWidth={1.8} />}>企划</SectionHead>
              <Field label="类型">
                <select
                  value={el.kind}
                  onChange={e => updateElement(el.id, { kind: e.target.value as PlanningNodeKind } as Partial<PlanningElement>)}
                  className="input-paper"
                  style={{ fontSize: 11.5 }}
                >
                  {PLANNING_KIND_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="标题">
                <input
                  type="text"
                  value={el.title}
                  onChange={e => updateElement(el.id, { title: e.target.value } as Partial<PlanningElement>)}
                  className="input-paper"
                  style={{ fontSize: 11.5 }}
                />
              </Field>
              <Field label="内容">
                <textarea
                  value={el.body}
                  onChange={e => updateElement(el.id, { body: e.target.value } as Partial<PlanningElement>)}
                  className="input-paper"
                  style={{ fontSize: 12, minHeight: 110, lineHeight: 1.55 }}
                />
              </Field>
              {el.kind === 'productionTask' && (
                <>
                  <Field label="任务类型">
                    <select
                      value={el.recommendedTaskType ?? ''}
                      onChange={e => {
                        const value = e.target.value as PlanningElement['recommendedTaskType'] | '';
                        updateElement(el.id, { recommendedTaskType: value || undefined } as Partial<PlanningElement>);
                      }}
                      className="input-paper"
                      style={{ fontSize: 11.5 }}
                    >
                      <option value="">空</option>
                      {TASK_TYPE_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="道具可见程度">
                    <select
                      value={el.propStates?.[0]?.visibility ?? ''}
                      onChange={e => {
                        const value = e.target.value as PropVisibility | '';
                        const [, ...rest] = el.propStates ?? [];
                        updateElement(el.id, {
                          propStates: value
                            ? [{ ...(el.propStates?.[0] ?? {}), visibility: value, userConfirmed: true }, ...rest]
                            : rest,
                        } as Partial<PlanningElement>);
                      }}
                      className="input-paper"
                      style={{ fontSize: 11.5 }}
                    >
                      <option value="">空</option>
                      {PROP_VISIBILITY_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="验收标准">
                    <textarea
                      value={el.acceptanceCriteria ?? ''}
                      onChange={e => updateElement(el.id, { acceptanceCriteria: e.target.value } as Partial<PlanningElement>)}
                      className="input-paper"
                      style={{ fontSize: 12, minHeight: 72, lineHeight: 1.55 }}
                    />
                  </Field>
                </>
              )}
            </section>
          </>
        )}
      </div>
    </aside>
  );
}

function SectionHead({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return <h4 className="meta flex items-center gap-1.5" style={{ color: 'var(--ink-2)' }}><span style={{ color: 'var(--ink-3)' }}>{icon}</span>{children}</h4>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="flex flex-col gap-1"><span style={{ fontSize: 10.5, color: 'var(--ink-2)' }}>{label}</span>{children}</label>;
}

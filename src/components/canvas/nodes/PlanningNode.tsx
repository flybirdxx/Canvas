import { Group, Rect } from 'react-konva';
import { Html } from 'react-konva-utils';
import { useState } from 'react';
import type React from 'react';
import type { PlanningElement, PlanningNodeKind, PlanningRequirement } from '@/types/canvas';
import { useCanvasStore } from '@/store/useCanvasStore';
import { listModels } from '@/services/gateway';
import { generateShortDramaPlanning } from '@/services/planning';
import {
  buildPlanningNodesFromResponse,
  convertTaskToExecutionNode,
  createTaskFromRequirement,
  detectPropVisualConflict,
  makePlanningConnection,
} from '@/services/planningGraph';
import { useExecutionBorder } from './shared';

const KIND_LABELS: Record<PlanningNodeKind, string> = {
  projectSeed: '项目种子',
  storyBible: '故事圣经',
  characterPackage: '角色生产包',
  plot: '剧情节点',
  reference: '引用对象',
  productionTask: '生产任务',
};

const MATERIAL_LABELS: Record<PlanningRequirement['materialType'], string> = {
  character: '角色',
  scene: '场景',
  prop: '道具',
  image: '图片',
  text: '文本',
  video: '视频',
  audio: '音频',
};

export function PlanningNode({ el }: { el: PlanningElement }) {
  const executionBorder = useExecutionBorder(el.id);
  const updateElement = useCanvasStore((s) => s.updateElement);
  const [isGeneratingStoryBible, setIsGeneratingStoryBible] = useState(false);
  const [storyBibleError, setStoryBibleError] = useState<string | null>(null);
  const requirements = el.requirements ?? [];
  const pendingRequirements = requirements.filter(req => req.status === 'pending');
  const confirmedRequirements = el.kind === 'plot'
    ? requirements.filter(req => req.status === 'confirmed')
    : [];
  const confirmed = requirements.filter(req => req.status === 'confirmed').length;
  const pending = pendingRequirements.length;

  const updateRequirementStatus = (
    requirementId: string,
    status: PlanningRequirement['status'],
    label: string,
  ) => {
    updateElement(
      el.id,
      {
        requirements: requirements.map(req =>
          req.id === requirementId ? { ...req, status } : req,
        ),
      } as Partial<PlanningElement>,
      label,
    );
  };

  const hasPropVisualConflict = (requirement: PlanningRequirement) => {
    if (requirement.materialType !== 'prop') return false;

    const taskDescription = [el.title, el.body, el.acceptanceCriteria].filter(Boolean).join('\n');
    const propDefinition = [requirement.title, requirement.description, requirement.necessity]
      .filter(Boolean)
      .join('\n');

    return detectPropVisualConflict(taskDescription, propDefinition).conflict;
  };

  const stopInteraction = (event: React.SyntheticEvent) => {
    event.stopPropagation();
  };

  const handleConvertTask = (event: React.SyntheticEvent) => {
    event.stopPropagation();
    const executionNode = convertTaskToExecutionNode(el);
    const store = useCanvasStore.getState();

    store.addElement(executionNode);
    store.setSelection([executionNode.id]);

    const nextStore = useCanvasStore.getState();
    const sourceTask = nextStore.elements.find(existing => existing.id === el.id);
    const insertedExecutionNode = nextStore.elements.find(existing => existing.id === executionNode.id);
    const sourceOutputId = sourceTask?.outputs?.[0]?.id;
    const compatibleInput = insertedExecutionNode?.inputs?.find(input =>
      input.type === 'text' || input.type === 'any',
    );

    if (sourceOutputId && compatibleInput?.id) {
      nextStore.addConnection(
        makePlanningConnection(el.id, sourceOutputId, insertedExecutionNode.id, compatibleInput.id),
      );
    }
  };

  const handleCreateTask = (
    event: React.SyntheticEvent,
    requirement: PlanningRequirement,
  ) => {
    event.stopPropagation();
    const store = useCanvasStore.getState();
    const exists = store.elements.some(existing =>
      existing.type === 'planning' &&
      existing.kind === 'productionTask' &&
      existing.sourcePlanningId === el.id &&
      existing.title === requirement.title,
    );
    if (exists) return;

    const task = createTaskFromRequirement(el, requirement);
    store.addElement(task);

    const sourceOutputId = el.outputs?.[0]?.id;
    if (!sourceOutputId) return;

    const insertedTask = useCanvasStore.getState().elements.find(existing => existing.id === task.id);
    if (insertedTask?.type !== 'planning') return;

    const taskInputId = insertedTask.inputs?.[0]?.id;
    if (!taskInputId) return;

    useCanvasStore.getState().addConnection(
      makePlanningConnection(el.id, sourceOutputId, insertedTask.id, taskInputId),
    );
  };

  const handleGenerateStoryBible = async (event: React.SyntheticEvent) => {
    event.stopPropagation();
    if (isGeneratingStoryBible) return;

    setStoryBibleError(null);
    const model = listModels('text')[0]?.id;
    if (!model) {
      setStoryBibleError('没有可用的文本模型');
      return;
    }

    setIsGeneratingStoryBible(true);
    try {
      const response = await generateShortDramaPlanning(el.body, model);
      const { nodes, connections } = buildPlanningNodesFromResponse(el, response);
      const store = useCanvasStore.getState();

      nodes.forEach(node => store.addElement(node));

      if (typeof store.addConnection === 'function') {
        connections
          .filter(connection =>
            connection.id &&
            connection.fromPortId &&
            connection.toPortId,
          )
          .forEach(connection => store.addConnection(connection));
      }
      setStoryBibleError(null);
    } catch (error) {
      setStoryBibleError(error instanceof Error && error.message
        ? error.message
        : '生成故事圣经失败');
    } finally {
      setIsGeneratingStoryBible(false);
    }
  };

  return (
    <Group>
      <Rect width={el.width} height={el.height} fill="transparent" />
      <Rect
        x={-1}
        y={-1}
        width={el.width + 2}
        height={el.height + 2}
        stroke={executionBorder}
        strokeWidth={2}
        fill="transparent"
        listening={false}
      />
      <Html divProps={{ style: { pointerEvents: 'none' } }}>
        <article
          style={{
            width: el.width,
            height: el.height,
            background: 'var(--bg-2)',
            border: '1px solid var(--line-1)',
            borderRadius: 'var(--r-sm)',
            boxShadow: 'var(--shadow-ink-1)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <header
            style={{
              padding: '10px 12px 8px',
              borderBottom: '1px solid var(--line-1)',
              background: 'color-mix(in oklch, var(--accent) 7%, var(--bg-2))',
            }}
          >
            <div
              className="meta"
              style={{
                color: 'var(--accent)',
                fontSize: 10,
                marginBottom: 5,
              }}
            >
              {KIND_LABELS[el.kind]}
            </div>
            <input
              className="serif pointer-events-auto"
              value={el.title}
              onChange={(event) => updateElement(el.id, { title: event.target.value })}
              onPointerDown={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
              style={{
                width: '100%',
                border: 'none',
                outline: 'none',
                background: 'transparent',
                color: 'var(--ink-0)',
                fontSize: 15,
                fontWeight: 600,
                lineHeight: 1.25,
                padding: 0,
              }}
            />
          </header>
          <textarea
            className="pointer-events-auto paper-scroll"
            value={el.body}
            placeholder="记录企划目的、剧情职责、必要素材或验收标准..."
            onChange={(event) => updateElement(el.id, { body: event.target.value })}
            onPointerDown={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
            style={{
              flex: 1,
              minHeight: 0,
              border: 'none',
              outline: 'none',
              resize: 'none',
              background: 'transparent',
              color: 'var(--ink-0)',
              fontSize: 12.5,
              lineHeight: 1.6,
              fontFamily: 'var(--font-sans)',
              padding: 12,
            }}
          />
          {el.kind === 'projectSeed' && (
            <section
              style={{
                padding: '8px 10px',
                borderTop: '1px solid var(--line-1)',
                background: 'color-mix(in oklch, var(--bg-2) 88%, var(--accent) 12%)',
              }}
            >
              <button
                type="button"
                className="pointer-events-auto"
                disabled={isGeneratingStoryBible}
                onPointerDown={stopInteraction}
                onClick={handleGenerateStoryBible}
                style={{
                  ...actionButtonStyle,
                  color: 'var(--accent)',
                  opacity: isGeneratingStoryBible ? 0.65 : 1,
                }}
              >
                生成故事圣经
              </button>
              {storyBibleError && (
                <div
                  role="alert"
                  style={{
                    marginTop: 6,
                    color: 'var(--ink-2)',
                    fontSize: 10.5,
                    lineHeight: 1.45,
                  }}
                >
                  {storyBibleError}
                </div>
              )}
            </section>
          )}
          {(pendingRequirements.length > 0 || confirmedRequirements.length > 0 || el.kind === 'productionTask') && (
            <section
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                padding: '8px 10px',
                borderTop: '1px solid var(--line-1)',
                background: 'color-mix(in oklch, var(--bg-2) 88%, var(--accent) 12%)',
              }}
            >
              {pendingRequirements.map(requirement => (
                <div
                  key={requirement.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    gap: 8,
                    alignItems: 'center',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        color: 'var(--ink-0)',
                        fontSize: 11.5,
                        fontWeight: 600,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {requirement.title}
                    </div>
                    <div
                      style={{
                        color: 'var(--ink-2)',
                        fontSize: 10,
                        lineHeight: 1.4,
                      }}
                    >
                      {MATERIAL_LABELS[requirement.materialType]} · 待确认
                    </div>
                    {hasPropVisualConflict(requirement) && (
                      <div style={conflictHintStyle}>
                        视觉设定可能不一致，由用户自行分辨
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 5 }}>
                    <button
                      type="button"
                      className="pointer-events-auto"
                      onPointerDown={stopInteraction}
                      onClick={(event) => {
                        event.stopPropagation();
                        updateRequirementStatus(requirement.id, 'confirmed', '确认素材需求');
                      }}
                      style={actionButtonStyle}
                    >
                      确认
                    </button>
                    <button
                      type="button"
                      className="pointer-events-auto"
                      onPointerDown={stopInteraction}
                      onClick={(event) => {
                        event.stopPropagation();
                        updateRequirementStatus(requirement.id, 'dismissed', '忽略素材需求');
                      }}
                      style={actionButtonStyle}
                    >
                      忽略
                    </button>
                  </div>
                </div>
              ))}
              {confirmedRequirements.map(requirement => (
                <div
                  key={requirement.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    gap: 8,
                    alignItems: 'center',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        color: 'var(--ink-0)',
                        fontSize: 11.5,
                        fontWeight: 600,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {requirement.title}
                    </div>
                    <div
                      style={{
                        color: 'var(--ink-2)',
                        fontSize: 10,
                        lineHeight: 1.4,
                      }}
                    >
                      {MATERIAL_LABELS[requirement.materialType]} · 已确认
                    </div>
                    {hasPropVisualConflict(requirement) && (
                      <div style={conflictHintStyle}>
                        视觉设定可能不一致，由用户自行分辨
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    className="pointer-events-auto"
                    onPointerDown={stopInteraction}
                    onClick={(event) => handleCreateTask(event, requirement)}
                    style={actionButtonStyle}
                  >
                    创建任务节点
                  </button>
                </div>
              ))}
              {el.kind === 'productionTask' && (
                <button
                  type="button"
                  className="pointer-events-auto"
                  onPointerDown={stopInteraction}
                  onClick={handleConvertTask}
                  style={{
                    ...actionButtonStyle,
                    alignSelf: 'flex-start',
                    color: 'var(--accent)',
                  }}
                >
                  转换为生成节点
                </button>
              )}
            </section>
          )}
          {(pending > 0 || confirmed > 0 || el.recommendedTaskType) && (
            <footer
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 10px',
                borderTop: '1px solid var(--line-1)',
                color: 'var(--ink-2)',
                fontSize: 10.5,
              }}
            >
              {pending > 0 && <span>{pending} 待确认</span>}
              {confirmed > 0 && <span>{confirmed} 已确认</span>}
              {el.recommendedTaskType && <span>建议 {taskTypeLabel(el.recommendedTaskType)}</span>}
            </footer>
          )}
        </article>
      </Html>
    </Group>
  );
}

const actionButtonStyle: React.CSSProperties = {
  border: '1px solid var(--line-1)',
  borderRadius: 6,
  background: 'var(--bg-2)',
  color: 'var(--ink-1)',
  fontSize: 10.5,
  lineHeight: 1.2,
  padding: '4px 7px',
  cursor: 'pointer',
};

const conflictHintStyle: React.CSSProperties = {
  marginTop: 3,
  color: 'var(--ink-2)',
  fontSize: 10,
  lineHeight: 1.35,
};

function taskTypeLabel(type: NonNullable<PlanningElement['recommendedTaskType']>): string {
  switch (type) {
    case 'image':
      return '图片';
    case 'text':
      return '文本';
    case 'video':
      return '视频';
    case 'audio':
      return '音频';
  }
}

import type { PlanningElement, PlanningRequirement } from '@/types/canvas';

const MATERIAL_LABELS: Record<PlanningRequirement['materialType'], string> = {
  character: '角色',
  scene: '场景',
  prop: '道具',
  image: '图像',
  text: '文本',
  video: '视频',
  audio: '音频',
};

const STATUS_LABELS: Record<PlanningRequirement['status'], string> = {
  pending: '待确认',
  confirmed: '已确认',
  dismissed: '已忽略',
};

interface PlanningTextOptions {
  includeDismissed?: boolean;
}

export function formatPlanningText(
  el: PlanningElement,
  options: PlanningTextOptions = {},
): string {
  const requirements = (el.requirements ?? [])
    .filter(req => options.includeDismissed || req.status !== 'dismissed')
    .map(formatRequirement);

  return [
    el.title,
    el.body,
    el.acceptanceCriteria ? `验收标准：${el.acceptanceCriteria}` : '',
    ...requirements,
  ]
    .filter(Boolean)
    .join('\n');
}

function formatRequirement(req: PlanningRequirement): string {
  const title = `${MATERIAL_LABELS[req.materialType]} · ${STATUS_LABELS[req.status]}：${req.title}`;
  const details = [req.description, req.necessity].filter(Boolean).join('；');
  return details ? `${title}\n${details}` : title;
}

import screenwritingMasterTemplate from './screenwritingMasterTemplate.md?raw';

export const SCREENWRITING_REWRITE_PRESET_ID = 'text-screenwriting-rewrite';
export const SCREENWRITING_MASTER_TEMPLATE_PRESET_ID = 'text-screenwriting-master-template';

export const SCREENWRITING_REWRITE_PRESET_SNIPPET = [
  '剧本优化续写：把当前内容改写为可拍摄的场景片段，不要只写梗概。',
  '核心原则：以视觉和声音推进剧情，动作即潜台词，对白口语化且只露一角。',
  '红线：不要写心理描写；不要写括号暗示；不要用角色台词解释设定或主题；不要说教、强行煽情或使用书面化 AI 腔。',
  '输出结构：场景标题、场景目标、视觉动作、对白、节奏拍点、道具/声音提示、续写后的完整片段。',
  '每一场必须有明确冲突、信息增量或转折；能被摄影机拍到的内容优先。',
].join('\n');

export const SCREENWRITING_MASTER_SYSTEM_PROMPT = [
  '<screenwriting_master_system>',
  screenwritingMasterTemplate.trim(),
  '</screenwriting_master_system>',
].join('\n');

export const SCREENWRITING_MASTER_TEMPLATE_PRESET_SNIPPET = [
  '完整编剧模板：使用完整编剧大师系统提示作为 system prompt 执行，不替换当前输入内容。',
  '适合复杂剧本续写、剧本医生、分步骤编剧工作流；如果只需要快速场景化改写，请用“剧本优化续写”。',
].join('\n');

export function isScreenwritingMasterTemplatePreset(id: string): boolean {
  return id === SCREENWRITING_MASTER_TEMPLATE_PRESET_ID;
}

export function buildScreenwritingRewritePrompt(source: string): string {
  const trimmedSource = source.trim() || '未提供原始内容，请先根据当前节点上下文补齐可续写的核心情境。';

  return [
    SCREENWRITING_REWRITE_PRESET_SNIPPET,
    '',
    '请基于下面原始内容执行剧本优化续写：',
    trimmedSource,
  ].join('\n');
}

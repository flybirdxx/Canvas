import { v4 as uuidv4 } from 'uuid';

import type { PlanningMaterialType, PlanningRequirement } from '@/types/canvas';
import { generateTextByModelId } from './gateway';

export interface RawPlanningRequirement {
  title?: unknown;
  materialType?: unknown;
  description?: unknown;
  necessity?: unknown;
}

export interface RawPlanningSection {
  title?: unknown;
  body?: unknown;
}

export interface RawPlanningCharacter extends RawPlanningSection {
  plotResponsibility?: unknown;
}

export interface RawPlanningPlot extends RawPlanningSection {
  requirements?: unknown;
}

export interface RawPlanningResponse {
  storyBible?: unknown;
  characters?: unknown;
  plots?: unknown;
}

export interface NormalizedPlanningSection {
  id: string;
  title: string;
  body: string;
}

export interface NormalizedPlanningCharacter extends NormalizedPlanningSection {
  plotResponsibility?: string;
}

export interface NormalizedPlanningPlot extends NormalizedPlanningSection {
  requirements: PlanningRequirement[];
}

export interface NormalizedPlanningResponse {
  storyBible: NormalizedPlanningSection;
  characters: NormalizedPlanningCharacter[];
  plots: NormalizedPlanningPlot[];
}

const ALLOWED_MATERIAL_TYPES = new Set<PlanningMaterialType>([
  'character',
  'scene',
  'prop',
  'image',
  'text',
  'video',
  'audio',
]);

export function buildShortDramaPlanningPrompt(seed: string): string {
  return [
    '你是短剧项目模板企划助手，请把用户的一句想法整理为可生产的短剧企划。',
    '必须围绕短剧项目模板输出：storyBible、characters、plots。',
    '素材需求只能来自剧情推进、角色识别、关键反转、拍摄执行或后期制作的生产必要性。',
    '不要列出低价值素材，例如泛泛的氛围图、可有可无的道具、重复人物图、无明确用途的参考图。',
    '每个 plot 的 requirements 只列必要素材，并说明 necessity。',
    'materialType 只能使用 character、scene、prop、image、text、video、audio。',
    '只输出 JSON，不要 Markdown，不要解释，不要代码围栏。',
    'JSON 结构：{"storyBible":{"title":"","body":""},"characters":[{"title":"","body":"","plotResponsibility":""}],"plots":[{"title":"","body":"","requirements":[{"title":"","materialType":"prop","description":"","necessity":""}]}]}',
    '',
    `用户种子：${seed.trim() || '未提供'}`,
  ].join('\n');
}

export function normalizePlanningResponse(raw: RawPlanningResponse): NormalizedPlanningResponse {
  const storyBible = toRecord(raw.storyBible) ?? {};

  return {
    storyBible: {
      id: uuidv4(),
      title: toText(storyBible.title, '未命名短剧企划'),
      body: toText(storyBible.body, '暂无故事圣经，请补充项目核心设定。'),
    },
    characters: normalizeCharacters(raw.characters),
    plots: normalizePlots(raw.plots),
  };
}

export function parsePlanningJson(text: string): RawPlanningResponse {
  const trimmed = text.trim();
  let rawParseError: unknown;

  try {
    return parseJsonObject(trimmed);
  } catch (error) {
    rawParseError = error;
  }

  for (const block of extractFencedBlocks(text)) {
    try {
      return parseJsonObject(block.trim());
    } catch {
      // Skip non-JSON or non-object code blocks and keep looking.
    }
  }

  const detail = rawParseError instanceof Error ? rawParseError.message : String(rawParseError);
  throw new Error(`企划返回内容不是可解析的 JSON 对象：${detail}`);
}

export async function generateShortDramaPlanning(
  seed: string,
  model: string,
): Promise<NormalizedPlanningResponse> {
  const result = await generateTextByModelId({
    model,
    messages: [{ role: 'user', content: buildShortDramaPlanningPrompt(seed) }],
  });

  if (result.ok === false) {
    throw new Error(
      result.detail
        ? `企划生成失败：${result.message}\n${result.detail}`
        : `企划生成失败：${result.message}`,
    );
  }

  return normalizePlanningResponse(parsePlanningJson(result.text));
}

function normalizeCharacters(value: unknown): NormalizedPlanningCharacter[] {
  if (!Array.isArray(value)) return [];

  return value.map((item, index) => {
    const character = toRecord(item) ?? {};
    const responsibility = toOptionalText(character.plotResponsibility);
    const body = toText(character.body, '暂无角色说明。');

    return {
      id: uuidv4(),
      title: toText(character.title, `角色 ${index + 1}`),
      body: responsibility ? `${body}\n剧情职责：${responsibility}` : body,
      plotResponsibility: responsibility,
    };
  });
}

function normalizePlots(value: unknown): NormalizedPlanningPlot[] {
  if (!Array.isArray(value)) return [];

  return value.map((item, index) => {
    const plot = toRecord(item) ?? {};
    const plotId = uuidv4();

    return {
      id: plotId,
      title: toText(plot.title, `剧情节点 ${index + 1}`),
      body: toText(plot.body, '暂无剧情说明。'),
      requirements: normalizeRequirements(plot.requirements, plotId),
    };
  });
}

function normalizeRequirements(
  value: unknown,
  sourcePlotId: string,
): PlanningRequirement[] {
  if (!Array.isArray(value)) return [];

  return value.map((item, index) => {
    const requirement = toRecord(item) ?? {};

    return {
      id: uuidv4(),
      title: toText(requirement.title, `必要素材 ${index + 1}`),
      materialType: normalizeMaterialType(requirement.materialType),
      description: toOptionalText(requirement.description),
      status: 'pending',
      sourcePlotId,
      necessity: toOptionalText(requirement.necessity),
    };
  });
}

function normalizeMaterialType(value: unknown): PlanningMaterialType {
  return typeof value === 'string' && ALLOWED_MATERIAL_TYPES.has(value as PlanningMaterialType)
    ? value as PlanningMaterialType
    : 'prop';
}

function parseJsonObject(text: string): RawPlanningResponse {
  const parsed: unknown = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('企划 JSON 顶层必须是对象。');
  }
  return parsed as RawPlanningResponse;
}

function extractFencedBlocks(text: string): string[] {
  return [...text.matchAll(/```[^\r\n]*\r?\n([\s\S]*?)```/g)].map(match => match[1]);
}

function toRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function toText(value: unknown, fallback: string): string {
  const text = toOptionalText(value);
  return text ?? fallback;
}

function toOptionalText(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  const text = String(value).trim();
  return text || undefined;
}

/**
 * submitVideo — video generation submission extracted from NodeInputBar.handleSubmit.
 *
 * Spawns one AIGeneratingElement placeholder via replaceElement, then delegates
 * to runVideoGeneration. Providers aren't online yet; the gateway returns a
 * structured failure that surfaces through the existing error panel + retry flow.
 */
import { v4 as uuidv4 } from 'uuid';
import type { CanvasElement } from '@/types/canvas';
import type { UpstreamImageContribution } from '@/utils/flowResolver';
import type { VideoGenRequest } from '@/services/videoGeneration';
import { computeInheritedVersions } from './utils';

export interface SubmitVideoConfig {
  element: CanvasElement;
  prompt: string;
  effectivePrompt: string;
  aspect: string;
  quality: string;
  duration: string;
  model: string;
  upstreamImages: UpstreamImageContribution[];
  replaceElement: (oldId: string, newElement: CanvasElement, label?: string) => void;
  setIsGenerating: (v: boolean) => void;
  runVideoGeneration: (id: string, req: VideoGenRequest) => Promise<void>;
}

export async function submitVideo(config: SubmitVideoConfig): Promise<void> {
  const {
    element, prompt, effectivePrompt, aspect, quality, duration, model,
    upstreamImages, replaceElement, setIsGenerating, runVideoGeneration,
  } = config;

  const [wR, hR] = aspect.split(':').map(Number);
  const qmap: Record<string, number> = { '480P': 480, '720P': 720, '1080P': 1080 };
  const short = qmap[quality] ?? 720;
  let vw = short;
  let vh = short;
  if (wR && hR) {
    if (wR >= hR) vw = Math.round(short * (wR / hR));
    else vh = Math.round(short * (hR / wR));
  }
  const secs = parseInt(duration.replace(/[^0-9]/g, ''), 10) || 5;

  const pid = uuidv4();
  const inheritedVersions = computeInheritedVersions(element);
  replaceElement(element.id, {
    id: pid,
    type: 'aigenerating',
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
    inheritedVersions,
    inheritedPrompt: prompt,
  }, '开始视频生成');

  const vreq: VideoGenRequest = {
    model,
    prompt: effectivePrompt,
    size: `${vw}x${vh}`,
    w: element.width,
    h: element.height,
    durationSec: secs,
    seedImage: upstreamImages[0]?.src,
  };

  setIsGenerating(true);
  try {
    await runVideoGeneration(pid, vreq);
  } finally {
    setIsGenerating(false);
  }
}

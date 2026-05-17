/**
 * Text generation service — bridges the NodeInputBar (text mode) to the
 * gateway's `generateTextByModelId`. Follows the same pattern as
 * imageGeneration.ts but is simpler: no placeholder dance, no async polling,
 * just a single synchronous HTTP call that updates the existing text node.
 */

import { useCanvasStore } from '@/store/useCanvasStore';
import { useGenerationHistoryStore } from '@/store/useGenerationHistoryStore';
import { generateTextByModelId } from './gateway';
import type { GatewayErrorKind } from './gateway/types';
import { v4 as uuidv4 } from 'uuid';

export interface TextGenRequestPayload {
  /** The text element being generated on. */
  elementId: string;
  /** The composed effective prompt (local prompt + upstream context). */
  prompt: string;
  /** Optional system prompt sent before the user's composed prompt. */
  systemPrompt?: string;
  /** Wire-level model id (e.g. "google/gemini-3.1-pro-preview"). */
  model: string;
  /** Callback to flip the generating spinner off. */
  setIsGenerating: (v: boolean) => void;
}

export type TextGenErrorKind = GatewayErrorKind;

export interface TextGenError {
  kind: TextGenErrorKind;
  message: string;
  detail?: string;
}

function getStore() {
  return useCanvasStore.getState();
}

/**
 * Run a single text generation on an existing text node. The result is
 * written back to the node's `text` field in-place — no placeholder needed.
 *
 * On failure, we leave the node content unchanged but log an alert so the
 * user can diagnose (future: surface errors in a toast or error panel).
 */
export async function runTextGeneration(payload: TextGenRequestPayload): Promise<void> {
  const { elementId, prompt, systemPrompt, model, setIsGenerating } = payload;
  const store = getStore();
  const el = store.elements.find(e => e.id === elementId);
  if (!el || el.type !== 'text') {
    setIsGenerating(false);
    return;
  }

  const trimmedSystemPrompt = systemPrompt?.trim();
  const messages = trimmedSystemPrompt
    ? [
        { role: 'system' as const, content: trimmedSystemPrompt },
        { role: 'user' as const, content: prompt },
      ]
    : [
        { role: 'user' as const, content: prompt },
      ];

  const result = await generateTextByModelId({ model, messages });

  if (result.ok === true) {
    store.updateElement(
      elementId,
      { text: result.text, prompt },
      '生成文本',
    );

    // Record to generation history
    useGenerationHistoryStore.getState().addEntry({
      id: uuidv4(),
      elementId,
      prompt,
      model: model || '',
      // Text gen doesn't have a thumbnail; store an empty string.
      thumbnailUrl: '',
      resultUrls: [],
      modality: 'text',
    });
  } else {
    // Leave existing text in place; surface the error
    const msg = `文本生成失败：${result.message}${result.detail ? `\n${result.detail}` : ''}`;
    alert(msg);
  }

  setIsGenerating(false);
}

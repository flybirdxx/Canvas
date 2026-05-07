import React, { useState } from 'react';
import { Group, Rect } from 'react-konva';
import { Html } from 'react-konva-utils';
import { Sparkles, AlertTriangle, Settings as SettingsIcon, RefreshCw, Trash2 } from 'lucide-react';
import { useCanvasStore } from '../../../store/useCanvasStore';
import { retryGeneration } from '../../../services/imageGeneration';
import type { AIGenerationError } from '../../../types/canvas';
import { POLAROID_STYLE, useExecutionBorder } from './shared';

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
        background: 'color-mix(in oklch, var(--danger) 4%, var(--bg-2))',
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
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

export function AIGeneratingNode({ el }: { el: any }) {
  const { id, width, height } = el;
  const executionBorder = useExecutionBorder(id);
  const deleteElements = useCanvasStore((s) => s.deleteElements);
  const error = el.error as AIGenerationError | undefined;

  return (
    <Group>
      <Rect width={width} height={height} fill="transparent" />
      <Rect
        x={-1} y={-1}
        width={width + 2} height={height + 2}
        stroke={executionBorder}
        strokeWidth={2}
        fill="transparent"
        listening={false}
      />
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
            }}
          >
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

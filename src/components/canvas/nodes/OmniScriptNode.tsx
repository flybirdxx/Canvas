import { useCallback, useEffect, useMemo, useState } from 'react';
import type React from 'react';
import { Group, Rect } from 'react-konva';
import { Html } from 'react-konva-utils';
import { Play, AlertCircle } from 'lucide-react';
import type { OmniScriptElement } from '@/types/canvas';
import { useCanvasStore } from '@/store/useCanvasStore';
import { analyzeVideoToOmniScript } from '@/services/omniscript';
import { listModels } from '@/services/gateway';
import { readBlob } from '@/services/fileStorage';
import { resolveUpstreamVideoSource } from '@/utils/mediaResolver';

export function OmniScriptNode({ el, width, height }: { el: OmniScriptElement; width: number; height: number }) {
  const updateElement = useCanvasStore(s => s.updateElement);
  const elements = useCanvasStore(s => s.elements);
  const connections = useCanvasStore(s => s.connections);
  const [isBusy, setIsBusy] = useState(false);

  const models = useMemo(() => listModels('text'), []);
  const selectedModel = el.model || models[0]?.id || '';
  const upstreamVideo = useMemo(() => resolveUpstreamVideoSource(el.id, elements, connections), [el.id, elements, connections]);
  const result = el.result ?? { segments: [], structuredScript: [], highlights: [] };

  const run = useCallback(async () => {
    setIsBusy(true);
    updateElement(el.id, { analysisStatus: 'running', error: undefined, model: selectedModel }, '分析 OmniScript');
    let videoDataUrl = upstreamVideo?.dataUrl;
    if (!el.videoUrl && !videoDataUrl && upstreamVideo?.fileRef) {
      try {
        videoDataUrl = await readBlob(upstreamVideo.fileRef) ?? undefined;
      } catch {
        setIsBusy(false);
        updateElement(el.id, {
          analysisStatus: 'error',
          error: '读取上游视频文件失败，请重新上传或替换视频节点。',
        }, 'OmniScript 分析失败');
        return;
      }
    }
    const outcome = await analyzeVideoToOmniScript({
      model: selectedModel,
      videoUrl: el.videoUrl || upstreamVideo?.url,
      videoDataUrl,
      videoFileRef: videoDataUrl ? undefined : upstreamVideo?.fileRef,
      notes: el.notes,
    });
    setIsBusy(false);
    if (outcome.ok === true) {
      updateElement(el.id, {
        analysisStatus: 'success',
        result: outcome.result,
        rawText: outcome.rawText,
        error: undefined,
      }, '完成 OmniScript 分析');
    } else {
      updateElement(el.id, {
        analysisStatus: 'error',
        error: (outcome as { ok: false; message: string }).message,
      }, 'OmniScript 分析失败');
    }
  }, [el.id, el.videoUrl, el.notes, selectedModel, upstreamVideo, updateElement]);

  useEffect(() => {
    const handleToolbarRun = (event: Event) => {
      const detail = (event as CustomEvent<{ id?: string }>).detail;
      if (detail?.id !== el.id) return;
      if (isBusy || !selectedModel) return;
      void run();
    };

    window.addEventListener('omniscript:run', handleToolbarRun);
    return () => window.removeEventListener('omniscript:run', handleToolbarRun);
  }, [el.id, isBusy, run, selectedModel]);

  return (
    <Group>
      <Rect width={width} height={height} fill="transparent" />
      <Html divProps={{ style: { pointerEvents: 'none' } }}>
      <div
        style={{
          width,
          height,
          pointerEvents: 'none',
          background: 'var(--bg-2)',
          border: '1px solid var(--line-1)',
          borderRadius: 8,
          boxShadow: 'var(--shadow-ink-1)',
          overflow: 'hidden',
          color: 'var(--ink-0)',
          fontFamily: 'var(--font-sans)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--line-1)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontWeight: 650, fontSize: 14, flex: 1 }}>OmniScript</div>
          <select
            value={selectedModel}
            onChange={e => updateElement(el.id, { model: e.target.value }, '选择 OmniScript 模型')}
            style={controlStyle}
          >
            {models.map(model => <option key={model.id} value={model.id}>{model.label}</option>)}
          </select>
          <button
            type="button"
            disabled={isBusy || !selectedModel}
            onClick={run}
            title="分析视频"
            style={{
              ...iconButtonStyle,
              opacity: isBusy || !selectedModel ? 0.5 : 1,
              cursor: isBusy || !selectedModel ? 'not-allowed' : 'pointer',
            }}
          >
            <Play size={15} />
          </button>
        </div>

        <div style={{ padding: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <input
            value={el.videoUrl ?? ''}
            onChange={e => updateElement(el.id, { videoUrl: e.target.value }, '编辑视频链接')}
            placeholder="视频链接 https://..."
            style={controlStyle}
          />
          <div style={{ ...hintStyle, color: upstreamVideo ? 'var(--accent)' : 'var(--ink-3)' }}>
            {upstreamVideo ? `已引用上游：${upstreamVideo.label}` : '可连接上游 video/file 节点'}
          </div>
          <textarea
            value={el.notes ?? ''}
            onChange={e => updateElement(el.id, { notes: e.target.value }, '编辑分析要求')}
            placeholder="补充仿写目标、账号风格或关注点"
            style={{ ...controlStyle, gridColumn: '1 / -1', minHeight: 58, resize: 'none' }}
          />
        </div>

        {el.error && (
          <div style={{ margin: '0 12px 8px', padding: 8, borderRadius: 6, background: '#fff0f0', color: '#9b1c1c', fontSize: 12, display: 'flex', gap: 6 }}>
            <AlertCircle size={14} />
            <span>{el.error}</span>
          </div>
        )}

        <div style={{ flex: 1, padding: '0 12px 12px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, minHeight: 0, pointerEvents: 'auto' }}>
          <Column title="分段剧情概述" items={result.segments.map(item => `${item.time ? `${item.time} ` : ''}${item.summary}`)} />
          <Column title="结构化剧本" items={result.structuredScript.map(item => [item.time, item.visual, item.audio, item.copy].filter(Boolean).join(' | '))} />
          <Column title="高光时刻" items={result.highlights.map(item => `${item.time ? `${item.time} ` : ''}${item.reason}`)} />
        </div>
      </div>
      </Html>
    </Group>
  );
}

function Column({ title, items }: { title: string; items: string[] }) {
  return (
    <div style={{ minWidth: 0, background: 'var(--bg-1)', border: '1px solid var(--line-1)', borderRadius: 6, padding: 8, overflow: 'auto' }}>
      <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 6 }}>{title}</div>
      {items.length === 0 ? (
        <div style={{ color: 'var(--ink-3)', fontSize: 11, lineHeight: 1.5 }}>等待分析结果</div>
      ) : items.map((item, index) => (
        <div key={index} style={{ fontSize: 11, lineHeight: 1.45, marginBottom: 6, whiteSpace: 'pre-wrap' }}>{item}</div>
      ))}
    </div>
  );
}

const controlStyle: React.CSSProperties = {
  pointerEvents: 'auto',
  width: '100%',
  border: '1px solid var(--line-1)',
  borderRadius: 6,
  background: 'var(--bg-0)',
  color: 'var(--ink-0)',
  font: 'inherit',
  fontSize: 12,
  padding: '6px 8px',
  outline: 'none',
};

const iconButtonStyle: React.CSSProperties = {
  pointerEvents: 'auto',
  width: 30,
  height: 30,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '1px solid var(--line-1)',
  borderRadius: 6,
  background: 'var(--accent)',
  color: 'var(--accent-fg)',
};

const hintStyle: React.CSSProperties = {
  fontSize: 11,
  display: 'flex',
  alignItems: 'center',
  minWidth: 0,
};

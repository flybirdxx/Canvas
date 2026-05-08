import { useState } from 'react';
import { X, Archive, AlertTriangle } from 'lucide-react';
import { exportZip, type ExportZipOptions } from '@/utils/exportZip';
import { useCanvasStore } from '@/store/useCanvasStore';
import { getStage } from '@/utils/stageRegistry';

interface ExportZipDialogProps {
  onClose: () => void;
}

type ExportPhase = 'idle' | 'assets' | 'thumbnails' | 'generating' | 'done' | 'error';

export function ExportZipDialog({ onClose }: ExportZipDialogProps) {
  const [includeAiData, setIncludeAiData] = useState(true);
  const [includeConnections, setIncludeConnections] = useState(true);
  const [phase, setPhase] = useState<ExportPhase>('idle');
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(1);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const elements = useCanvasStore(s => s.elements);

  const phaseLabel: Record<ExportPhase, string> = {
    idle: '',
    assets: '正在打包素材…',
    thumbnails: '正在生成缩略图…',
    generating: '正在生成 ZIP 文件…',
    done: '',
    error: '',
  };

  const handleExport = async () => {
    setPhase('assets');
    setErrorMsg(null);
    setProgress(0);
    setTotal(elements.length);

    try {
      const opts: ExportZipOptions = { includeAiData, includeConnections };
      const stage = getStage();
      const stageRef = stage ? { current: stage } : null;

      await exportZip(opts, stageRef, (newPhase, processed, newTotal) => {
        setPhase(newPhase);
        setProgress(processed);
        setTotal(newTotal);
      });

      setPhase('done');
      setTimeout(onClose, 1500);
    } catch (err: any) {
      setPhase('error');
      setErrorMsg(err?.message ?? '导出失败，请重试。');
    }
  };

  const percent = total > 0 ? Math.round((progress / total) * 100) : 0;

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 200, backdropFilter: 'blur(4px)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget && phase !== 'assets' && phase !== 'generating') onClose(); }}
    >
      <div style={{
        background: 'var(--bg-0)',
        borderRadius: 'var(--r-lg)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
        width: 440, maxWidth: '95vw',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid var(--line-1)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Archive size={18} strokeWidth={1.6} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-0)' }}>
              导出 ZIP
            </span>
          </div>
          {phase === 'idle' && (
            <button onClick={onClose} style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              padding: 4, color: 'var(--ink-3)', borderRadius: 'var(--r-sm)',
              display: 'flex',
            }}>
              <X size={16} />
            </button>
          )}
        </div>

        {/* Body */}
        <div style={{ padding: '20px' }}>
          {phase === 'idle' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                {elements.length} 个节点将被打包为 ZIP 文件
              </div>

              <OptionRow
                label="包含 AI 元数据"
                description="导出模型名称、Prompt、Seed 等信息"
                checked={includeAiData}
                onChange={setIncludeAiData}
              />
              <OptionRow
                label="包含连线配置"
                description="导出节点间的连接关系"
                checked={includeConnections}
                onChange={setIncludeConnections}
              />

              <div style={{ marginTop: 8 }}>
                <button
                  onClick={handleExport}
                  style={{
                    width: '100%',
                    padding: '10px 0',
                    background: elements.length === 0 ? 'var(--bg-2)' : 'var(--accent)',
                    color: elements.length === 0 ? 'var(--ink-3)' : 'var(--accent-fg)',
                    border: 'none',
                    borderRadius: 'var(--r-md)',
                    fontSize: 13, fontWeight: 600,
                    cursor: elements.length === 0 ? 'not-allowed' : 'pointer',
                  }}
                  disabled={elements.length === 0}
                >
                  {elements.length === 0 ? '无节点可导出' : '开始导出'}
                </button>
              </div>
            </div>
          )}

          {(phase === 'assets' || phase === 'thumbnails') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ fontSize: 13, color: 'var(--ink-1)' }}>
                {phaseLabel[phase]} {progress} / {total}
              </div>
              <div style={{
                height: 8, background: 'var(--bg-2)',
                borderRadius: 99, overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: `${percent}%`,
                  background: 'var(--accent)',
                  transition: 'width 0.2s ease',
                }} />
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', textAlign: 'center' }}>
                {percent}%
              </div>
            </div>
          )}

          {phase === 'generating' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ fontSize: 13, color: 'var(--ink-1)' }}>
                正在生成 ZIP 文件…
              </div>
              <div style={{
                height: 8, background: 'var(--bg-2)',
                borderRadius: 99, overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: `${progress}%`,
                  background: 'var(--accent)',
                  transition: 'width 0.3s ease',
                }} />
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', textAlign: 'center' }}>
                {progress}%
              </div>
            </div>
          )}

          {phase === 'done' && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 12, padding: '12px 0',
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%',
                background: 'var(--bg-2)', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Archive size={22} strokeWidth={1.6} style={{ color: 'var(--success)' }} />
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-0)' }}>
                导出完成
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                文件已自动下载
              </div>
            </div>
          )}

          {phase === 'error' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 14px',
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: 'var(--r-sm)',
              }}>
                <AlertTriangle size={16} style={{ color: '#ef4444', flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: '#ef4444' }}>{errorMsg}</span>
              </div>
              <button
                onClick={() => setPhase('idle')}
                style={{
                  padding: '8px 0', background: 'var(--bg-2)',
                  border: '1px solid var(--line-1)',
                  borderRadius: 'var(--r-md)', fontSize: 12,
                  color: 'var(--ink-1)', cursor: 'pointer',
                }}
              >
                重新导出
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function OptionRow({
  label, description, checked, onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      cursor: 'pointer',
    }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ marginTop: 2, accentColor: 'var(--accent)' }}
      />
      <div>
        <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--ink-0)' }}>{label}</div>
        <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>{description}</div>
      </div>
    </label>
  );
}

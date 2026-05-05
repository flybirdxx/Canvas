import { useRef, useState } from 'react';
import { X, Upload, CheckCircle, AlertCircle, FileArchive } from 'lucide-react';
import { parseZipFile, restoreCanvas, type ParsedCanvas } from '../utils/importZip';

interface ImportZipDialogProps {
  onClose: () => void;
}

type Status = 'idle' | 'parsing' | 'confirming' | 'restoring' | 'done' | 'error';

export function ImportZipDialog({ onClose }: ImportZipDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedCanvas | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatus('parsing');
    setErrorMsg(null);

    try {
      const result = await parseZipFile(file);
      setParsed(result);
      setStatus('confirming');
    } catch (err: any) {
      setStatus('error');
      setErrorMsg(err?.message ?? '无法读取 ZIP 文件');
    }
  };

  const handleRestore = async () => {
    if (!parsed) return;
    setStatus('restoring');

    try {
      await restoreCanvas(parsed);
      setStatus('done');
      setTimeout(onClose, 1500);
    } catch (err: any) {
      setStatus('error');
      setErrorMsg(err?.message ?? '导入失败，请重试');
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 200, backdropFilter: 'blur(4px)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget && status !== 'restoring') onClose(); }}
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
            <FileArchive size={18} strokeWidth={1.6} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-0)' }}>
              导入 ZIP
            </span>
          </div>
          {status !== 'restoring' && (
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
          {status === 'idle' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{
                border: '2px dashed var(--line-1)',
                borderRadius: 'var(--r-md)',
                padding: '32px 20px',
                textAlign: 'center',
                cursor: 'pointer',
              }}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (!file) return;
                  if (!file.name.endsWith('.zip') && file.type !== 'application/zip') {
                    setStatus('error');
                    setErrorMsg('只支持 ZIP 文件，请选择 .zip 格式的文件。');
                    return;
                  }
                  const dt = new DataTransfer();
                  dt.items.add(file);
                  if (fileInputRef.current) fileInputRef.current.files = dt.files;
                  fileInputRef.current.dispatchEvent(new Event('change'));
                }}
              >
                <Upload size={28} strokeWidth={1.4} style={{ color: 'var(--ink-3)', margin: '0 auto 10px' }} />
                <div style={{ fontSize: 13, color: 'var(--ink-1)', fontWeight: 500 }}>
                  点击选择或拖拽 ZIP 文件
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 4 }}>
                  或从 AI Canvas 导出的 canvas-export-*.zip 文件
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".zip"
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />
              </div>
            </div>
          )}

          {status === 'parsing' && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 12, padding: '20px 0',
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                border: '3px solid var(--line-1)',
                borderTopColor: 'var(--accent)',
                animation: 'spin 0.8s linear infinite',
              }} />
              <div style={{ fontSize: 13, color: 'var(--ink-1)' }}>正在解析 ZIP 文件…</div>
            </div>
          )}

          {status === 'confirming' && parsed && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{
                background: 'var(--bg-2)',
                borderRadius: 'var(--r-md)',
                padding: '14px 16px',
                display: 'flex', flexDirection: 'column', gap: 8,
              }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-0)', marginBottom: 4 }}>
                  预览
                </div>
                <PreviewRow label="节点数量" value={`${parsed.nodeCount} 个节点`} />
                <PreviewRow label="连线数量" value={`${parsed.connectionCount} 条连线`} />
                {parsed.groups.length > 0 && (
                  <PreviewRow label="分组数量" value={`${parsed.groups.length} 个分组`} />
                )}
                {parsed.exportedAt && (
                  <PreviewRow label="导出时间" value={new Date(parsed.exportedAt).toLocaleString()} />
                )}
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => { setParsed(null); setStatus('idle'); }}
                  style={{
                    flex: 1, padding: '9px 0',
                    background: 'var(--bg-2)',
                    border: '1px solid var(--line-1)',
                    borderRadius: 'var(--r-md)',
                    fontSize: 13, color: 'var(--ink-1)',
                    cursor: 'pointer',
                  }}
                >
                  取消
                </button>
                <button
                  onClick={handleRestore}
                  style={{
                    flex: 2, padding: '9px 0',
                    background: 'var(--accent)',
                    color: 'var(--accent-fg)',
                    border: 'none',
                    borderRadius: 'var(--r-md)',
                    fontSize: 13, fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  导入到画布
                </button>
              </div>
            </div>
          )}

          {status === 'restoring' && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 12, padding: '20px 0',
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                border: '3px solid var(--line-1)',
                borderTopColor: 'var(--accent)',
                animation: 'spin 0.8s linear infinite',
              }} />
              <div style={{ fontSize: 13, color: 'var(--ink-1)' }}>正在导入画布…</div>
            </div>
          )}

          {status === 'done' && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 12, padding: '12px 0',
            }}>
              <CheckCircle size={36} strokeWidth={1.4} style={{ color: 'var(--success)' }} />
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-0)' }}>
                导入成功
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                {parsed?.nodeCount ?? 0} 个节点已添加到画布
              </div>
            </div>
          )}

          {status === 'error' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 14px',
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: 'var(--r-sm)',
              }}>
                <AlertCircle size={16} style={{ color: '#ef4444', flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: '#ef4444' }}>{errorMsg}</span>
              </div>
              <button
                onClick={() => { setParsed(null); setStatus('idle'); setErrorMsg(null); }}
                style={{
                  padding: '8px 0', background: 'var(--bg-2)',
                  border: '1px solid var(--line-1)',
                  borderRadius: 'var(--r-md)', fontSize: 12,
                  color: 'var(--ink-1)', cursor: 'pointer',
                }}
              >
                重新选择文件
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
      <span style={{ color: 'var(--ink-3)' }}>{label}</span>
      <span style={{ color: 'var(--ink-0)', fontWeight: 500 }}>{value}</span>
    </div>
  );
}

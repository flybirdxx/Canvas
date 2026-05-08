// src/components/ExportMp4Dialog.tsx
import { useState, useRef, useCallback } from 'react';
import { X, Film, Upload } from 'lucide-react';
import { exportMp4, type Transition, type Resolution, type ExportMp4Options } from '@/utils/exportMp4';

interface ExportMp4DialogProps {
  sceneCount: number;
  onClose: () => void;
}

type Tab = 'basic' | 'audio';

export function ExportMp4Dialog({ sceneCount, onClose }: ExportMp4DialogProps) {
  const [tab, setTab] = useState<Tab>('basic');
  const [frameDuration, setFrameDuration] = useState(3);
  const [transition, setTransition] = useState<Transition>('fade');
  const [resolution, setResolution] = useState<Resolution>('1080p');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleAudioChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAudioFile(file);
    const url = URL.createObjectURL(file);
    const audio = new Audio(url);
    audio.onloadedmetadata = () => {
      setAudioDuration(audio.duration);
      audioRef.current = audio;
    };
    audio.onerror = () => {
      setAudioFile(null);
      setError('无法读取音频文件。');
    };
  }, []);

  const handleExport = async () => {
    setExporting(true);
    setError(null);
    setProgress(0);

    try {
      let audioData: ArrayBuffer | undefined;
      if (audioFile) {
        audioData = await audioFile.arrayBuffer();
      }

      const opts: ExportMp4Options = {
        frameDuration,
        transition,
        resolution,
        audioData,
        audioDuration: audioDuration || undefined,
      };

      await exportMp4(opts);
      setProgress(100);
      setTimeout(onClose, 1500);
    } catch (err: any) {
      setError(err.message ?? '导出失败，请重试。');
    } finally {
      setExporting(false);
    }
  };

  const resolutionOptions: { value: Resolution; label: string; dims: string }[] = [
    { value: '720p',  label: '720p',  dims: '1280 × 720'  },
    { value: '1080p', label: '1080p', dims: '1920 × 1080' },
    { value: '4k',    label: '4K',    dims: '3840 × 2160' },
  ];

  const transitionOptions: { value: Transition; label: string }[] = [
    { value: 'none',  label: '无'      },
    { value: 'fade',  label: '淡入淡出' },
    { value: 'slide', label: '滑入'    },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
        backdropFilter: 'blur(4px)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: 'var(--bg-0)',
          borderRadius: 'var(--r-lg)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          width: 440,
          maxWidth: '95vw',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--line-1)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Film size={18} strokeWidth={1.6} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-0)' }}>
              导出 MP4 视频
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              color: 'var(--ink-3)',
              borderRadius: 'var(--r-sm)',
              display: 'flex',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Scene count badge */}
        <div style={{
          padding: '12px 20px 0',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <span style={{
            background: 'var(--accent)',
            color: 'var(--accent-fg)',
            borderRadius: 99,
            padding: '3px 10px',
            fontSize: 12,
            fontWeight: 600,
          }}>
            {sceneCount} 个分镜
          </span>
          <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
            {sceneCount} 帧 × {frameDuration}s ≈ {Math.round(sceneCount * frameDuration)}s
          </span>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          gap: 0,
          padding: '14px 20px 0',
          borderBottom: '1px solid var(--line-1)',
        }}>
          {(['basic', 'audio'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '6px 14px',
                fontSize: 12.5,
                fontWeight: tab === t ? 600 : 400,
                color: tab === t ? 'var(--accent)' : 'var(--ink-2)',
                background: 'transparent',
                border: 'none',
                borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
                cursor: 'pointer',
                marginBottom: -1,
              }}
            >
              {t === 'basic' ? '视频设置' : '音频轨道'}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ padding: '20px' }}>

          {tab === 'basic' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Frame duration */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-1)', display: 'block', marginBottom: 8 }}>
                  每帧时长
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <input
                    type="range"
                    min={1} max={10} step={0.5}
                    value={frameDuration}
                    onChange={(e) => setFrameDuration(parseFloat(e.target.value))}
                    style={{ flex: 1, accentColor: 'var(--accent)' }}
                  />
                  <span style={{ fontSize: 13, color: 'var(--ink-1)', minWidth: 36, textAlign: 'right' }}>
                    {frameDuration}s
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                  {[1, 3, 5].map(v => (
                    <button
                      key={v}
                      onClick={() => setFrameDuration(v)}
                      style={{
                        background: frameDuration === v ? 'var(--accent)' : 'var(--bg-2)',
                        color: frameDuration === v ? 'var(--accent-fg)' : 'var(--ink-3)',
                        border: 'none',
                        borderRadius: 99,
                        padding: '2px 10px',
                        fontSize: 11,
                        cursor: 'pointer',
                      }}
                    >
                      {v}s
                    </button>
                  ))}
                </div>
              </div>

              {/* Transition */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-1)', display: 'block', marginBottom: 8 }}>
                  转场效果
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {transitionOptions.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setTransition(opt.value)}
                      style={{
                        flex: 1,
                        padding: '7px 0',
                        fontSize: 12,
                        fontWeight: transition === opt.value ? 600 : 400,
                        color: transition === opt.value ? 'var(--accent-fg)' : 'var(--ink-1)',
                        background: transition === opt.value ? 'var(--accent)' : 'var(--bg-2)',
                        border: transition === opt.value ? '1px solid var(--accent)' : '1px solid var(--line-1)',
                        borderRadius: 'var(--r-sm)',
                        cursor: 'pointer',
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Resolution */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-1)', display: 'block', marginBottom: 8 }}>
                  输出分辨率
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {resolutionOptions.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setResolution(opt.value)}
                      style={{
                        flex: 1,
                        padding: '7px 0',
                        fontSize: 12,
                        fontWeight: resolution === opt.value ? 600 : 400,
                        color: resolution === opt.value ? 'var(--accent-fg)' : 'var(--ink-1)',
                        background: resolution === opt.value ? 'var(--accent)' : 'var(--bg-2)',
                        border: resolution === opt.value ? '1px solid var(--accent)' : '1px solid var(--line-1)',
                        borderRadius: 'var(--r-sm)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                      }}
                    >
                      <span>{opt.label}</span>
                      <span style={{ fontSize: 10, opacity: 0.75 }}>{opt.dims}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'audio' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div
                style={{
                  border: '2px dashed var(--line-1)',
                  borderRadius: 'var(--r-md)',
                  padding: '32px 20px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: 'var(--bg-1)',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--accent)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--line-1)'; }}
                onClick={() => document.getElementById('audio-file-input')?.click()}
              >
                <input
                  id="audio-file-input"
                  type="file"
                  accept="audio/*"
                  style={{ display: 'none' }}
                  onChange={handleAudioChange}
                />
                <Upload size={24} strokeWidth={1.6} style={{ color: 'var(--ink-3)', margin: '0 auto 8px' }} />
                <div style={{ fontSize: 13, color: 'var(--ink-1)', fontWeight: 500 }}>
                  {audioFile ? audioFile.name : '点击上传音频文件'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>
                  MP3 / WAV / AAC，支持最长音频轨道
                </div>
              </div>
              {audioFile && (
                <div style={{
                  background: 'var(--bg-2)',
                  borderRadius: 'var(--r-sm)',
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--ink-1)', fontWeight: 500 }}>{audioFile.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
                      {(audioFile.size / 1024 / 1024).toFixed(1)} MB
                      {audioDuration > 0 && ` · ${Math.round(audioDuration)}s`}
                    </div>
                  </div>
                  <button
                    onClick={() => { setAudioFile(null); setAudioDuration(0); }}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', fontSize: 12 }}
                  >
                    移除
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{
              marginTop: 14,
              padding: '10px 14px',
              background: 'color-mix(in srgb, var(--signal) 12%, transparent)',
              border: '1px solid color-mix(in srgb, var(--signal) 30%, transparent)',
              borderRadius: 'var(--r-sm)',
              fontSize: 12,
              color: 'var(--signal)',
            }}>
              {error}
            </div>
          )}

          {/* Progress */}
          {exporting && (
            <div style={{ marginTop: 14 }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 11,
                color: 'var(--ink-3)',
                marginBottom: 6,
              }}>
                <span>编码中…</span>
                <span>{progress}%</span>
              </div>
              <div style={{
                height: 4,
                background: 'var(--bg-3)',
                borderRadius: 99,
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: `${progress}%`,
                  background: 'var(--accent)',
                  transition: 'width 0.3s',
                  borderRadius: 99,
                }} />
              </div>
            </div>
          )}

          {/* Footer */}
          <div style={{
            display: 'flex',
            gap: 10,
            marginTop: 24,
            justifyContent: 'flex-end',
          }}>
            <button
              onClick={onClose}
              disabled={exporting}
              style={{
                padding: '8px 18px',
                fontSize: 13,
                borderRadius: 'var(--r-sm)',
                border: '1px solid var(--line-1)',
                background: 'var(--bg-1)',
                color: 'var(--ink-1)',
                cursor: exporting ? 'not-allowed' : 'pointer',
                opacity: exporting ? 0.5 : 1,
              }}
            >
              取消
            </button>
            <button
              onClick={handleExport}
              disabled={exporting}
              style={{
                padding: '8px 22px',
                fontSize: 13,
                fontWeight: 600,
                borderRadius: 'var(--r-sm)',
                border: 'none',
                background: 'var(--accent)',
                color: 'var(--accent-fg)',
                cursor: exporting ? 'not-allowed' : 'pointer',
                opacity: exporting ? 0.7 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {exporting ? '导出中…' : '导出 MP4'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * SceneDetailOverlay — 可复用的结构化分镜编辑浮动面板。
 *
 * 提取自 StoryboardView 的 DetailPanel，同时服务于：
 *   - 分镜视图（StoryboardView）底部面板
 *   - 画布（InfiniteCanvas）浮动编辑面板
 *
 * 双页签：📜 剧本（ScriptLine 编辑器） / 🔍 分析（摘要+统计）
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { X, Trash2, Plus, Sparkles, Loader } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useCanvasStore } from '@/store/useCanvasStore';
import type { SceneElement, ScriptLine } from '@/types/canvas';
import { ScriptLineEditor } from '@/components/storyboard/ScriptLineEditor';
import { structureSceneWithAI } from '@/services/ScriptAiService';

export interface SceneDetailOverlayProps {
  scene: SceneElement;
  scriptTitle?: string;
  /** Called after the panel closes (e.g. to clear selection) */
  onClose: () => void;
}

export function SceneDetailOverlay({ scene, scriptTitle, onClose }: SceneDetailOverlayProps) {
  const updateElement = useCanvasStore(s => s.updateElement);
  const deleteElements = useCanvasStore(s => s.deleteElements);

  type TabId = 'script' | 'analysis';
  const [activeTab, setActiveTab] = useState<TabId>('script');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [title, setTitle] = useState(scene.title);

  // Local working copy of lines
  const [lines, setLines] = useState<ScriptLine[]>(() =>
    scene.lines && scene.lines.length > 0
      ? scene.lines
      : scene.content
        ? [{
            id: uuidv4(),
            role: '',
            content: scene.content,
            emotion: undefined,
            emotionEmoji: undefined,
            lineType: 'dialogue' as const,
            timestamp: undefined,
          }]
        : []
  );

  const [analysisNote, setAnalysisNote] = useState(scene.analysisNote || '');

  // Populate from content on first open if no lines exist
  const [didInit, setDidInit] = useState(false);
  useEffect(() => {
    if (didInit) return;
    setDidInit(true);
    if (scene.lines && scene.lines.length > 0) {
      setLines(scene.lines);
    } else if (scene.content && lines.length === 0) {
      setLines([{
        id: uuidv4(),
        role: '',
        content: scene.content,
        emotion: undefined,
        emotionEmoji: undefined,
        lineType: 'dialogue' as const,
        timestamp: undefined,
      }]);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset when scene changes
  useEffect(() => {
    setTitle(scene.title);
    setAnalysisNote(scene.analysisNote || '');
    setConfirmDelete(false);
    setActiveTab('script');
    setDidInit(false);
  }, [scene.id, scene.analysisNote, scene.title]);

  // Auto-save on any change
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // CR-4: clear pending save timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
    };
  }, []);

  const save = useCallback((newLines: ScriptLine[], newTitle: string, newAnalysisNote: string) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      const content = newLines.length > 0
        ? newLines.map(l => l.role ? `${l.role}：${l.content}` : l.content).join('\n')
        : '';
      updateElement(scene.id, {
        title: newTitle,
        content,
        lines: newLines,
        analysisNote: newAnalysisNote,
      });
    }, 300);
  }, [scene.id, updateElement]);

  const handleLineChange = useCallback((index: number, updated: ScriptLine) => {
    setLines(prev => {
      const next = [...prev];
      next[index] = updated;
      save(next, title, analysisNote);
      return next;
    });
  }, [title, analysisNote, save]);

  const handleLineDelete = useCallback((index: number) => {
    setLines(prev => {
      const next = prev.filter((_, i) => i !== index);
      save(next, title, analysisNote);
      return next;
    });
  }, [title, analysisNote, save]);

  const handleAddLine = useCallback(() => {
    const newLine: ScriptLine = {
      id: uuidv4(),
      role: '',
      content: '',
      emotion: undefined,
      emotionEmoji: undefined,
      lineType: 'dialogue',
      timestamp: undefined,
    };
    setLines(prev => {
      const next = [...prev, newLine];
      save(next, title, analysisNote);
      return next;
    });
  }, [title, analysisNote, save]);

  const handleTitleSave = useCallback(() => {
    save(lines, title, analysisNote);
  }, [lines, title, analysisNote, save]);

  const handleAnalysisSave = useCallback((note: string) => {
    setAnalysisNote(note);
    save(lines, title, note);
  }, [lines, title, save]);

  // AI 结构化
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const handleAiStructure = useCallback(async () => {
    const input = lines.map(l => l.role ? `${l.role}：${l.content}` : l.content).join('\n');
    if (!input.trim()) {
      setAiError('没有可解析的内容');
      return;
    }
    setAiLoading(true);
    setAiError(null);
    const outcome = await structureSceneWithAI(input);
    if (outcome.ok === false) {
      setAiError(outcome.message);
      setAiLoading(false);
      return;
    }
    setLines(outcome.lines);
    save(outcome.lines, title, analysisNote);
    setAiLoading(false);
  }, [lines, title, analysisNote, save]);

  // Known roles
  const knownRoles = [...new Set(lines.map(l => l.role).filter(Boolean))];
  const hasLines = lines.length > 0;

  // Delete handler
  const handleDelete = useCallback(() => {
    deleteElements([scene.id]);
    onClose();
  }, [scene.id, deleteElements, onClose]);

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'var(--bg-2)',
        borderTop: '1px solid var(--line-1, rgba(0,0,0,0.08))',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.12)',
        zIndex: 40,
        animation: 'slideUp 200ms ease-out',
        maxHeight: '55vh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      {confirmDelete ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', padding: '20px 32px', maxWidth: 800, margin: '0 auto' }}>
          <p style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 14, color: 'var(--ink-0)' }}>
            删除「{scene.title || `场 ${scene.sceneNum}`}」？此操作可撤销。
          </p>
          <button onClick={handleDelete} style={{ padding: '8px 16px', background: 'var(--danger)', border: 'none', borderRadius: '99px', color: '#FFF', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            确认删除
          </button>
          <button onClick={() => setConfirmDelete(false)} style={{ padding: '8px 16px', background: 'var(--bg-3)', border: 'none', borderRadius: '99px', color: 'var(--ink-0)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
            取消
          </button>
        </div>
      ) : (
        <>
          {/* Header */}
          <div style={{ padding: '12px 24px 0', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: '50%', background: 'var(--accent)', color: 'var(--accent-fg)', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                {scene.sceneNum}
              </span>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                onBlur={handleTitleSave}
                onKeyDown={e => { if (e.key === 'Enter') handleTitleSave(); }}
                className="input-paper"
                style={{ fontSize: 15, fontFamily: 'var(--font-serif)', fontWeight: 600, flex: 1, border: 'none', outline: 'none', background: 'transparent', color: 'var(--ink-0)' }}
                placeholder={`场 ${scene.sceneNum}`}
              />
              {scriptTitle && (
                <span style={{ fontSize: 11, color: 'var(--ink-2)', fontFamily: 'var(--font-sans)', flexShrink: 0 }}>
                  来自「{scriptTitle}」
                </span>
              )}
              <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-2)', padding: '4px', flexShrink: 0 }}>
                <X size={18} strokeWidth={1.6} />
              </button>
            </div>
            {/* Tab bar */}
            <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--line-1)', marginBottom: 0 }}>
              {([{ id: 'script' as TabId, label: '📜 剧本' }, { id: 'analysis' as TabId, label: '🔍 分析' }]).map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ padding: '8px 20px', fontSize: 13, fontWeight: activeTab === tab.id ? 600 : 400, color: activeTab === tab.id ? 'var(--ink-0)' : 'var(--ink-2)', background: 'transparent', border: 'none', borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent', cursor: 'pointer', fontFamily: 'inherit', marginBottom: -1 }}>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab content */}
          <div className="paper-scroll" style={{ flex: 1, overflowY: 'auto', padding: '12px 24px 20px' }}>
            {activeTab === 'script' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 900 }}>
                {!hasLines && (
                  <div style={{ textAlign: 'center', padding: '24px 16px', color: 'var(--ink-2)', fontSize: 13, fontFamily: 'var(--font-sans)', lineHeight: 1.7 }}>
                    <p style={{ margin: 0 }}>暂无结构化剧本行。</p>
                    <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--ink-3)' }}>点击「+ 添加行」开始，或使用快捷语法：角色 (情绪) 台词</p>
                  </div>
                )}
                {lines.map((line, index) => (
                  <ScriptLineEditor key={line.id} line={line} knownRoles={knownRoles} onChange={(updated) => handleLineChange(index, updated)} onDelete={() => handleLineDelete(index)} />
                ))}
                {aiError && (
                  <div style={{ padding: '8px 12px', background: 'var(--danger-soft)', borderRadius: 'var(--r-sm)', fontSize: 12, color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>{aiError}</span>
                    <button onClick={() => setAiError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: 12, fontWeight: 600 }}>关闭</button>
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 8, borderTop: hasLines ? 'none' : '1px solid var(--line-1)' }}>
                  <button onClick={handleAddLine} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', background: 'var(--bg-3)', border: '1px dashed var(--line-2)', borderRadius: '99px', color: 'var(--ink-1)', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                    <Plus size={12} strokeWidth={1.6} /> 添加行
                  </button>
                  <button onClick={handleAiStructure} disabled={aiLoading} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', background: aiLoading ? 'var(--bg-3)' : 'var(--accent)', border: 'none', borderRadius: '99px', color: aiLoading ? 'var(--ink-2)' : 'var(--accent-fg)', fontSize: 12, fontWeight: 600, cursor: aiLoading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: aiLoading ? 0.6 : 1 }}>
                    {aiLoading ? <Loader size={12} strokeWidth={1.6} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={12} strokeWidth={1.6} />}
                    {aiLoading ? '分析中…' : 'AI 智能结构化'}
                  </button>
                  <div style={{ flex: 1 }} />
                  <button onClick={() => setConfirmDelete(true)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', background: 'var(--danger-soft)', border: 'none', borderRadius: '99px', color: 'var(--danger)', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                    <Trash2 size={12} strokeWidth={1.6} /> 删除分镜
                  </button>
                </div>
              </div>
            )}
            {activeTab === 'analysis' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 700 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>分析备注</label>
                  <textarea value={analysisNote} onChange={e => handleAnalysisSave(e.target.value)} placeholder="例如：📍 地点：雨中的咖啡厅 | 🌤 天气：小雨，微凉 | 🎥 镜头建议：中景，缓慢推近..." className="input-paper" style={{ width: '100%', minHeight: 100, fontSize: 13, fontFamily: 'var(--font-sans)', lineHeight: 1.7, resize: 'vertical', color: 'var(--ink-0)' }} />
                  <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 4 }}>记录地点、天气、摄影机角度、灯光建议等分析信息。</div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>行统计</label>
                  <div style={{ fontSize: 12, color: 'var(--ink-1)', display: 'flex', gap: 16 }}>
                    <span>总行数：<strong style={{ color: 'var(--ink-0)' }}>{lines.length}</strong></span>
                    <span>对白：<strong style={{ color: 'var(--ink-0)' }}>{lines.filter(l => l.lineType === 'dialogue').length}</strong></span>
                    <span>动作：<strong style={{ color: 'var(--ink-0)' }}>{lines.filter(l => l.lineType === 'action').length}</strong></span>
                    <span>环境：<strong style={{ color: 'var(--ink-0)' }}>{lines.filter(l => l.lineType === 'environment').length}</strong></span>
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>场次编号</label>
                  <input type="number" min={1} value={scene.sceneNum} onChange={e => updateElement(scene.id, { sceneNum: Number(e.target.value) })} className="input-paper mono" style={{ width: 80, fontSize: 12 }} />
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

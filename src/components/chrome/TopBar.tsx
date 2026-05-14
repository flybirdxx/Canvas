import {
  ChevronDown, FileText, Download, Settings, MessageCircle,
  Play, BookOpen, LayoutGrid, LayoutPanelLeft,
  PlayCircle,
} from 'lucide-react';
import type { SceneExecutionProgress } from '@/hooks/canvas/useSceneExecution';

export interface TopBarProps {
  onOpenSettings: () => void;
  onOpenTemplates: () => void;
  onRun?: () => void;
  onCreateScript?: () => void;
  onToggleView?: () => void;
  viewMode?: 'canvas' | 'storyboard';
  /** Storyboard execution: total number of scene nodes */
  totalScenes?: number;
  /** Storyboard execution: how many scene cards are currently selected */
  sceneSelectedCount?: number;
  /** Storyboard execution: live progress from useSceneExecution */
  executionProgress?: SceneExecutionProgress;
  /** Storyboard execution: execute all scenes */
  onExecuteAll?: () => void;
  /** Storyboard execution: execute selected scenes */
  onExecuteSelected?: () => void;
}

export function TopBar({
  onOpenSettings,
  onOpenTemplates,
  onRun,
  onCreateScript,
  onToggleView,
  viewMode,
  totalScenes = 0,
  sceneSelectedCount = 0,
  executionProgress,
  onExecuteAll,
  onExecuteSelected,
}: TopBarProps) {
  const isStoryboard = viewMode === 'storyboard';
  const { done, total, isRunning } = executionProgress ?? {
    done: 0, total: 0, current: null, isRunning: false,
  };

  /** Render the unified view-switcher pill */
  const renderViewSwitcher = () => {
    if (!onToggleView) return null;
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '4px', background: 'var(--bg-2)', borderRadius: '99px', boxShadow: 'var(--shadow-ink-1)' }}>
        <button
          onClick={onToggleView}
          title="画布视图 (Ctrl+Shift+V)"
          style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px',
            background: viewMode === 'canvas' ? 'var(--accent)' : 'transparent',
            border: 'none', borderRadius: '99px', cursor: 'pointer',
            fontSize: 12, fontWeight: 500,
            color: viewMode === 'canvas' ? 'var(--accent-fg)' : 'var(--ink-2)',
            fontFamily: 'inherit', transition: 'all 150ms ease',
          }}
        >
          <LayoutGrid size={14} strokeWidth={1.6} />
          画布
        </button>
        <button
          onClick={onToggleView}
          title="分镜视图 (Ctrl+Shift+V)"
          style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px',
            background: viewMode === 'storyboard' ? 'var(--accent)' : 'transparent',
            border: 'none', borderRadius: '99px', cursor: 'pointer',
            fontSize: 12, fontWeight: 500,
            color: viewMode === 'storyboard' ? 'var(--accent-fg)' : 'var(--ink-2)',
            fontFamily: 'inherit', transition: 'all 150ms ease',
          }}
        >
          <LayoutPanelLeft size={14} strokeWidth={1.6} />
          分镜
        </button>
      </div>
    );
  };

  /** Render storyboard mode bar (single unified line) */
  const renderStoryboardBar = () => (
    <div style={{
      position: 'absolute', top: 16, left: 20, right: 20,
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '6px 12px',
      background: 'var(--bg-2)',
      border: '1px solid var(--line-1)',
      borderRadius: '99px',
      boxShadow: 'var(--shadow-ink-1)',
      zIndex: 28,
    }}>
      {/* Logo + project */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--ink-0)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-fg)' }} />
        </div>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-0)', marginRight: 4 }}>Untitled</span>
        <FileText size={16} strokeWidth={1.6} style={{ color: 'var(--ink-2)' }} />
        <ChevronDown size={14} strokeWidth={2} style={{ color: 'var(--ink-2)' }} />
      </div>

      {/* Separator */}
      <div style={{ width: 1, height: 16, background: 'var(--line-1)', flexShrink: 0 }} />

      {/* View switcher */}
      {renderViewSwitcher()}

      {/* Separator */}
      <div style={{ width: 1, height: 16, background: 'var(--line-1)', flexShrink: 0 }} />

      {/* Scene count badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 8px', background: 'var(--bg-3)', borderRadius: '99px' }}>
        <LayoutPanelLeft size={12} strokeWidth={1.6} style={{ color: 'var(--ink-2)' }} />
        <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--ink-2)' }}>
          {totalScenes} 个场景
        </span>
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Progress indicator (only during execution) */}
      {isRunning && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <div style={{ width: 100, height: 4, background: 'var(--line-1)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              width: total > 0 ? `${(done / total) * 100}%` : '0%',
              height: '100%', background: 'var(--accent)', borderRadius: 2,
              transition: 'width 300ms ease',
            }} />
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-1)', flexShrink: 0 }}>
            {done}/{total}
          </span>
        </div>
      )}

      {/* Execute All */}
      <button
        onClick={onExecuteAll}
        disabled={isRunning || totalScenes === 0}
        title={totalScenes === 0 ? '尚无分镜卡片' : '按场次顺序生成全部'}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px',
          background: totalScenes > 0 && !isRunning ? 'var(--accent)' : 'var(--bg-3)',
          border: 'none', borderRadius: '99px',
          color: totalScenes > 0 && !isRunning ? 'var(--accent-fg)' : 'var(--ink-2)',
          fontSize: 12, fontWeight: 600,
          cursor: totalScenes > 0 && !isRunning ? 'pointer' : 'not-allowed',
          opacity: isRunning ? 0.5 : 1,
          fontFamily: 'inherit', transition: 'all 150ms ease',
          flexShrink: 0,
        }}
      >
        <Play size={13} strokeWidth={1.8} />
        生成全部
      </button>

      {/* Execute Selected (only when some are selected) */}
      {sceneSelectedCount > 0 && (
        <button
          onClick={onExecuteSelected}
          disabled={isRunning}
          title={`生成选中的 ${sceneSelectedCount} 个分镜`}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
            background: 'var(--bg-3)', border: '1px solid var(--line-1)', borderRadius: '99px',
            color: 'var(--ink-0)',
            fontSize: 12, fontWeight: 500,
            cursor: isRunning ? 'not-allowed' : 'pointer',
            opacity: isRunning ? 0.5 : 1,
            fontFamily: 'inherit', transition: 'all 150ms ease',
            flexShrink: 0,
          }}
        >
          <PlayCircle size={13} strokeWidth={1.8} />
          生成选中 ({sceneSelectedCount})
        </button>
      )}

      {/* Separator */}
      <div style={{ width: 1, height: 16, background: 'var(--line-1)', flexShrink: 0 }} />

      {/* Settings */}
      <button
        onClick={onOpenSettings}
        title="Settings"
        style={{
          width: 30, height: 30, borderRadius: '50%',
          background: 'var(--bg-3)', border: '1px solid var(--line-1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--ink-2)', cursor: 'pointer', flexShrink: 0,
        }}
      >
        <Settings size={15} strokeWidth={1.6} />
      </button>
    </div>
  );

  /** Render canvas mode bar */
  const renderCanvasBar = () => (
    <div>
      {/* Left — logo + project */}
      <div style={{ position: 'absolute', top: 20, left: 20, display: 'flex', alignItems: 'center', gap: 10, zIndex: 30, pointerEvents: 'auto' }}>
        <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--ink-0)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-fg)' }} />
        </div>
        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink-0)' }}>Untitled</span>
        <FileText size={16} strokeWidth={1.6} style={{ color: 'var(--ink-2)' }} />
        <ChevronDown size={14} strokeWidth={2} style={{ color: 'var(--ink-2)' }} />
      </div>

      {/* Right */}
      <div style={{ position: 'absolute', top: 16, right: 20, display: 'flex', alignItems: 'center', gap: 10, zIndex: 30, pointerEvents: 'auto' }}>
        {onCreateScript && (
          <button
            onClick={onCreateScript}
            title="创建剧本节点"
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--bg-2)', border: 'none', borderRadius: '99px', boxShadow: 'var(--shadow-ink-1)', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: 'var(--ink-0)', fontFamily: 'inherit' }}
          >
            <BookOpen size={15} strokeWidth={1.6} style={{ color: 'var(--ink-2)' }} />
            <span style={{ color: 'var(--ink-2)' }}>剧本</span>
          </button>
        )}

        {renderViewSwitcher()}

        {onRun && (
          <button
            onClick={onRun}
            title="运行选中子图"
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--accent)', border: 'none', borderRadius: '99px', boxShadow: 'var(--shadow-ink-1)', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: 'var(--accent-fg)', fontFamily: 'inherit' }}
          >
            <Play size={15} strokeWidth={1.6} style={{ color: 'var(--accent-fg)' }} />
            <span>运行</span>
          </button>
        )}

        <button onClick={onOpenSettings} title="Export" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--bg-2)', border: 'none', borderRadius: '99px', boxShadow: 'var(--shadow-ink-1)', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: 'var(--ink-0)', fontFamily: 'inherit' }}>
          <Download size={15} strokeWidth={1.6} style={{ color: 'var(--ink-2)' }} />
          <span style={{ color: 'var(--ink-2)' }}>Export</span>
        </button>
        <button onClick={onOpenSettings} title="Settings" style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--ink-0)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-fg)', cursor: 'pointer', boxShadow: 'var(--shadow-ink-1)' }}><Settings size={16} strokeWidth={1.6} /></button>
        {onOpenTemplates && (
          <button onClick={onOpenTemplates} title="Chat" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--accent)', border: 'none', borderRadius: '99px', boxShadow: 'var(--shadow-ink-1)', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: 'var(--accent-fg)', fontFamily: 'inherit' }}>
            <MessageCircle size={15} strokeWidth={1.6} />Chat
          </button>
        )}
      </div>
    </div>
  );

  return <>{isStoryboard ? renderStoryboardBar() : renderCanvasBar()}</>;
}

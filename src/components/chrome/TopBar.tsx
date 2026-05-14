import { ChevronDown, Download, FileText, MessageCircle, Play, Settings } from 'lucide-react';
import type React from 'react';

export interface TopBarProps {
  onOpenSettings: () => void;
  onOpenTemplates: () => void;
  onRun?: () => void;
}

export function TopBar({ onOpenSettings, onOpenTemplates, onRun }: TopBarProps) {
  return (
    <>
      <div style={{ position: 'absolute', top: 20, left: 20, display: 'flex', alignItems: 'center', gap: 10, zIndex: 30, pointerEvents: 'auto' }}>
        <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--ink-0)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-fg)' }} />
        </div>
        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink-0)' }}>Untitled</span>
        <FileText size={16} strokeWidth={1.6} style={{ color: 'var(--ink-2)' }} />
        <ChevronDown size={14} strokeWidth={2} style={{ color: 'var(--ink-2)' }} />
      </div>

      <div style={{ position: 'absolute', top: 16, right: 20, display: 'flex', alignItems: 'center', gap: 10, zIndex: 30, pointerEvents: 'auto' }}>
        {onRun && (
          <button onClick={onRun} title="运行选中子图" style={pillPrimary}>
            <Play size={15} strokeWidth={1.6} />
            <span>运行</span>
          </button>
        )}
        <button onClick={onOpenSettings} title="Export" style={pillSecondary}>
          <Download size={15} strokeWidth={1.6} />
          <span>Export</span>
        </button>
        <button onClick={onOpenSettings} title="Settings" style={roundButton}>
          <Settings size={16} strokeWidth={1.6} />
        </button>
        <button onClick={onOpenTemplates} title="Chat" style={pillPrimary}>
          <MessageCircle size={15} strokeWidth={1.6} />
          <span>Chat</span>
        </button>
      </div>
    </>
  );
}

const pillBase: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 14px',
  border: 'none',
  borderRadius: '99px',
  boxShadow: 'var(--shadow-ink-1)',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 500,
  fontFamily: 'inherit',
};

const pillPrimary: React.CSSProperties = {
  ...pillBase,
  background: 'var(--accent)',
  color: 'var(--accent-fg)',
};

const pillSecondary: React.CSSProperties = {
  ...pillBase,
  background: 'var(--bg-2)',
  color: 'var(--ink-2)',
};

const roundButton: React.CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: '50%',
  background: 'var(--ink-0)',
  border: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--accent-fg)',
  cursor: 'pointer',
  boxShadow: 'var(--shadow-ink-1)',
};

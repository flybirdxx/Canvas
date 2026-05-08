/**
 * QuickAddMenu — context menu for adding nodes to the canvas.
 *
 * Appears when:
 *  1. User drops a connection onto empty space (proposes connected node)
 *  2. User double-clicks empty canvas space
 *
 * Extracted from InfiniteCanvas L581-L601 + L737-L764.
 */
import React from 'react';
import { Type, ImageIcon, Video, Music, FileUp } from 'lucide-react';
import type { QuickAddMenuState } from '@/hooks/canvas/useCanvasConnections';

interface QuickAddMenuProps {
  menu: QuickAddMenuState;
  onAdd: (type: 'text' | 'image' | 'video' | 'audio') => void;
  onUpload: () => void;
}

export function QuickAddMenu({ menu, onAdd, onUpload }: QuickAddMenuProps) {
  return (
    <div
      className="chip-paper anim-pop absolute z-50 flex flex-col gap-0.5"
      style={{
        left: menu.x + 10,
        top: menu.y - 10,
        width: 'max-content',
        minWidth: 140,
        padding: 6,
        boxShadow: 'var(--shadow-ink-3)',
      }}
    >
      <div className="meta" style={{ padding: '4px 10px', fontSize: 9.5 }}>
        Quick Add Node
      </div>
      <QuickAddRow icon={<Type className="w-4 h-4" strokeWidth={1.6} style={{ color: 'var(--port-text)' }} />} label="Text" onClick={() => onAdd('text')} />
      <QuickAddRow icon={<ImageIcon className="w-4 h-4" strokeWidth={1.6} style={{ color: 'var(--port-image)' }} />} label="Image" onClick={() => onAdd('image')} />
      <QuickAddRow icon={<Video className="w-4 h-4" strokeWidth={1.6} style={{ color: 'var(--port-video)' }} />} label="Video" onClick={() => onAdd('video')} />
      <QuickAddRow icon={<Music className="w-4 h-4" strokeWidth={1.6} style={{ color: 'var(--port-audio)' }} />} label="Audio" onClick={() => onAdd('audio')} />
      <QuickAddRow icon={<FileUp className="w-4 h-4" strokeWidth={1.6} style={{ color: 'var(--ink-2)' }} />} label="Upload" onClick={onUpload} />
    </div>
  );
}

function QuickAddRow({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className="flex items-center gap-2.5 text-left transition-colors"
      style={{
        padding: '7px 10px',
        borderRadius: 'var(--r-sm)',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
      }}
      onClick={onClick}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-2)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      {icon}
      <span style={{ fontSize: 13, color: 'var(--ink-0)', fontWeight: 500 }}>{label}</span>
    </button>
  );
}

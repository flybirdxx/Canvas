import { useState, useEffect, useRef } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { usePopupCoordinator } from './popupCoordinator';

export interface MoreMenuItem {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}

export function MoreMenu({ items, disabled }: { items: MoreMenuItem[]; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  usePopupCoordinator(open, setOpen);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (items.length === 0) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(v => !v)}
        title="更多"
        className="transition-colors"
        style={{
          padding: 5,
          borderRadius: 'var(--r-sm)',
          background: open ? 'var(--bg-3)' : 'transparent',
          color: open ? 'var(--ink-0)' : 'var(--ink-2)',
          border: 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.4 : 1,
        }}
      >
        <MoreHorizontal className="w-3.5 h-3.5" strokeWidth={1.6} />
      </button>
      {open && (
        <div
          className="chip-paper anim-pop"
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 6px)',
            right: 0,
            width: 'max-content',
            maxWidth: 'min(320px, calc(100vw - 80px))',
            padding: 4,
            zIndex: 30,
            boxShadow: 'var(--shadow-ink-3)',
          }}
        >
          {items.map(item => (
            <button
              key={item.label}
              type="button"
              onClick={() => {
                item.onClick();
                setOpen(false);
              }}
              className="w-full flex items-center gap-2 transition-colors"
              style={{
                padding: '6px 10px',
                fontSize: 12,
                color: 'var(--ink-1)',
                background: 'transparent',
                border: 'none',
                borderRadius: 'var(--r-sm)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-2)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{ color: 'var(--ink-2)', display: 'inline-flex', alignItems: 'center' }}>{item.icon}</span>
              <span style={{ whiteSpace: 'nowrap' }}>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

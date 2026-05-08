import { useState, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { usePopupCoordinator } from './popupCoordinator';
import type { DropdownOption } from '@/components/input-bar/utils';

export { type DropdownOption };

export function Dropdown({
  options,
  value,
  onChange,
  disabled,
  icon,
  maxLabelWidth,
}: {
  options: DropdownOption[];
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  icon?: React.ReactNode;
  /** If set, the current value label is truncated to this px width with a tooltip. */
  maxLabelWidth?: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = options.find(o => o.value === value) ?? options[0];
  const label = current?.label ?? value;

  usePopupCoordinator(open, setOpen);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className={`relative ${maxLabelWidth ? 'min-w-0' : ''}`} ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(v => !v)}
        title={maxLabelWidth ? label : undefined}
        className={`flex items-center gap-1 transition-colors ${
          maxLabelWidth ? 'min-w-0' : 'whitespace-nowrap'
        }`}
        style={{
          padding: '4px 6px',
          fontSize: 11,
          fontWeight: 500,
          borderRadius: 'var(--r-sm)',
          background: open ? 'var(--bg-3)' : 'transparent',
          color: open ? 'var(--ink-0)' : 'var(--ink-1)',
          border: '1px solid transparent',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
        }}
        onMouseEnter={(e) => {
          if (disabled || open) return;
          e.currentTarget.style.background = 'var(--bg-3)';
          e.currentTarget.style.color = 'var(--ink-0)';
        }}
        onMouseLeave={(e) => {
          if (disabled || open) return;
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = 'var(--ink-1)';
        }}
      >
        {icon}
        <span
          className={maxLabelWidth ? 'truncate' : 'whitespace-nowrap'}
          style={maxLabelWidth ? { maxWidth: maxLabelWidth } : undefined}
        >
          {label}
        </span>
        <ChevronDown className="w-3 h-3 opacity-60 shrink-0" strokeWidth={1.6} />
      </button>
      {open && (
        <div
          className="chip-paper anim-pop"
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 6px)',
            left: 0,
            width: 'max-content',
            maxWidth: 'min(420px, calc(100vw - 80px))',
            padding: 4,
            zIndex: 30,
            boxShadow: 'var(--shadow-ink-3)',
          }}
        >
          {options.map(opt => {
            const selected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className="w-full text-left transition-colors flex items-center"
                style={{
                  padding: '6px 10px',
                  gap: 14,
                  fontSize: 12,
                  borderRadius: 'var(--r-sm)',
                  background: selected ? 'var(--bg-3)' : 'transparent',
                  color: selected ? 'var(--ink-0)' : 'var(--ink-1)',
                  fontWeight: selected ? 600 : 400,
                  border: 'none',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={(e) => {
                  if (selected) return;
                  e.currentTarget.style.background = 'var(--bg-2)';
                }}
                onMouseLeave={(e) => {
                  if (selected) return;
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <span style={{ whiteSpace: 'nowrap' }}>{opt.label}</span>
                {opt.caption && (
                  <span
                    style={{
                      marginLeft: 'auto',
                      fontSize: 10,
                      color: 'var(--ink-3)',
                      fontFamily: 'var(--font-mono)',
                      whiteSpace: 'nowrap',
                      letterSpacing: '0.02em',
                    }}
                  >
                    {opt.caption}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

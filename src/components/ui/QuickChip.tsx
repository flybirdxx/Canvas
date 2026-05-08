interface QuickChipProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title?: string;
}

export function QuickChip({
  icon,
  label,
  onClick,
  active,
  disabled,
  title,
}: QuickChipProps) {
  const bg = disabled ? 'var(--bg-2)' : active ? 'var(--accent-soft)' : 'var(--bg-1)';
  const fg = disabled ? 'var(--ink-3)' : active ? 'var(--accent)' : 'var(--ink-1)';
  const border = disabled
    ? 'var(--line-0)'
    : active
      ? 'color-mix(in oklch, var(--accent) 22%, transparent)'
      : 'var(--line-1)';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="flex items-center gap-1 shrink-0 whitespace-nowrap transition-colors"
      style={{
        padding: '4px 9px',
        fontSize: 11.5,
        fontWeight: 500,
        borderRadius: 'var(--r-pill)',
        background: bg,
        color: fg,
        border: `1px solid ${border}`,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
      onMouseEnter={(e) => {
        if (disabled || active) return;
        e.currentTarget.style.background = 'var(--bg-2)';
        e.currentTarget.style.color = 'var(--ink-0)';
      }}
      onMouseLeave={(e) => {
        if (disabled || active) return;
        e.currentTarget.style.background = 'var(--bg-1)';
        e.currentTarget.style.color = 'var(--ink-1)';
      }}
    >
      {icon}
      {label}
    </button>
  );
}

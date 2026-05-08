import { X } from 'lucide-react';

export function ThumbChip({
  src,
  alt,
  tone,
  badge,
  title,
  onRemove,
}: {
  src: string;
  alt: string;
  tone: 'accent' | 'muted';
  badge?: string;
  title?: string;
  onRemove: () => void;
}) {
  return (
    <div
      className="relative group/thumb"
      style={{
        width: 40, height: 40,
        borderRadius: 'var(--r-sm)',
        overflow: 'hidden',
        background: 'var(--bg-3)',
        border: tone === 'accent'
          ? '2px solid color-mix(in oklch, var(--accent) 32%, transparent)'
          : '1px solid var(--line-1)',
        opacity: tone === 'muted' ? 0.55 : 1,
        boxShadow: 'var(--shadow-ink-0)',
      }}
      title={title}
    >
      <img src={src} alt={alt} className="w-full h-full object-cover" />
      {badge && (
        <div
          className="absolute bottom-0 left-0 right-0 text-center"
          style={{
            fontSize: 8,
            background: 'rgba(20,15,10,0.55)',
            color: 'var(--accent-fg)',
            padding: '1px 0',
            letterSpacing: '0.1em',
          }}
        >
          {badge}
        </div>
      )}
      <button
        type="button"
        onClick={onRemove}
        className="group-hover/thumb:opacity-100 transition-opacity"
        style={{
          position: 'absolute',
          top: -5, right: -5,
          width: 16, height: 16,
          borderRadius: '50%',
          background: 'var(--ink-0)',
          color: 'var(--bg-0)',
          border: '1px solid var(--bg-1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 0,
          cursor: 'pointer',
          boxShadow: 'var(--shadow-ink-1)',
        }}
        title="移除"
      >
        <X className="w-2.5 h-2.5" strokeWidth={2} />
      </button>
    </div>
  );
}

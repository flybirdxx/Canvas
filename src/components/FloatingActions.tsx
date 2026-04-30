import { Grid3X3, Languages, MessageCircle } from 'lucide-react';

interface FloatingActionsProps {
  onOpenTemplates: () => void;
  onOpenChat?: () => void;
}

export function FloatingActions({ onOpenTemplates, onOpenChat }: FloatingActionsProps) {
  return (
    <div
      className="anim-fade-in"
      style={{
        position: 'absolute',
        right: 24,
        top: '50%',
        transform: 'translateY(-60%)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        zIndex: 30,
        pointerEvents: 'auto',
      }}
    >
      {/* Templates — app/plugin browser */}
      <button
        onClick={onOpenTemplates}
        title="Templates"
        style={{
          width: 40, height: 40, borderRadius: '50%',
          background: 'var(--danger-soft)',
          border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
          color: 'var(--danger)',
          boxShadow: 'var(--shadow-ink-1)',
          transition: 'all 150ms ease',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.boxShadow = 'var(--shadow-ink-2)';
          e.currentTarget.style.transform = 'scale(1.05)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.boxShadow = 'var(--shadow-ink-1)';
          e.currentTarget.style.transform = 'scale(1)';
        }}
      >
        <Grid3X3 size={18} strokeWidth={1.6} />
      </button>

      {/* Translate — placeholder */}
      <button
        title="Translate (coming soon)"
        style={{
          width: 40, height: 40, borderRadius: '50%',
          background: 'var(--danger-soft)',
          border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
          color: 'var(--danger)',
          opacity: 0.5,
          boxShadow: 'var(--shadow-ink-1)',
          transition: 'all 150ms ease',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.boxShadow = 'var(--shadow-ink-2)';
          e.currentTarget.style.transform = 'scale(1.05)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.boxShadow = 'var(--shadow-ink-1)';
          e.currentTarget.style.transform = 'scale(1)';
        }}
      >
        <Languages size={18} strokeWidth={1.6} />
      </button>

      {/* Chat / AI — opens dialog */}
      <button
        onClick={onOpenChat}
        title="Chat"
        style={{
          width: 40, height: 40, borderRadius: '50%',
          background: 'var(--danger-soft)',
          border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
          color: 'var(--danger)',
          boxShadow: 'var(--shadow-ink-1)',
          transition: 'all 150ms ease',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.boxShadow = 'var(--shadow-ink-2)';
          e.currentTarget.style.transform = 'scale(1.05)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.boxShadow = 'var(--shadow-ink-1)';
          e.currentTarget.style.transform = 'scale(1)';
        }}
      >
        <MessageCircle size={18} strokeWidth={1.6} />
      </button>
    </div>
  );
}

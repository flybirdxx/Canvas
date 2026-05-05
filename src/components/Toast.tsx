// toast 系统：Story 1.3 — 实时运行面板依赖此系统
import { create } from 'zustand';

export type ToastType = 'success' | 'danger' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  createdAt: number;
}

interface ToastState {
  toasts: Toast[];
  addToast: (message: string, type: ToastType) => void;
  removeToast: (id: string) => void;
}

let _idCounter = 0;

export const useToastStore = create<ToastState>()((set) => ({
  toasts: [],

  addToast: (message, type) => {
    const id = `toast-${++_idCounter}`;
    set((s) => ({ toasts: [...s.toasts, { id, message, type, createdAt: Date.now() }]}));
    // Auto-dismiss after 4s for success/info, 6s for danger.
    const delay = type === 'danger' ? 6000 : 4000;
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, delay);
  },

  removeToast: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
}));

/* -------------------------------------------------------------------- */
/*  Toast Component                                                        */
/* -------------------------------------------------------------------- */

const TYPE_STYLE: Record<ToastType, { bg: string; border: string; color: string; icon: string }> = {
  success: { bg: 'var(--bg-2)', border: 'var(--success, #67C23A)', color: 'var(--success, #67C23A)', icon: '✓' },
  danger:  { bg: 'color-mix(in oklch, #F56C6C 6%, var(--bg-2))', border: '#F56C6C', color: '#F56C6C', icon: '!' },
  info:    { bg: 'var(--bg-2)', border: 'var(--accent)', color: 'var(--accent)', icon: 'i' },
};

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        pointerEvents: 'none',
        alignItems: 'center',
      }}
    >
      {toasts.map((toast) => {
        const s = TYPE_STYLE[toast.type];
        return (
          <div
            key={toast.id}
            className="anim-fade-in"
            style={{
              background: s.bg,
              border: `1px solid ${s.border}`,
              borderRadius: 'var(--r-md)',
              boxShadow: 'var(--shadow-ink-2)',
              padding: '10px 18px',
              fontSize: 13,
              color: s.color,
              fontFamily: 'var(--font-sans)',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              pointerEvents: 'auto',
              maxWidth: 400,
              cursor: 'pointer',
            }}
            onClick={() => removeToast(toast.id)}
            role="alert"
          >
            <span style={{ fontSize: 16, fontWeight: 700 }}>{s.icon}</span>
            <span>{toast.message}</span>
          </div>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------- */
/*  Global toast dispatcher (for executionEngine / other services)          */
/* -------------------------------------------------------------------- */

/**
 * Dispatch a toast from anywhere in the app.
 * Usage: dispatchToast('检测到循环依赖', 'danger')
 */
export function dispatchToast(message: string, type: ToastType = 'info') {
  useToastStore.getState().addToast(message, type);
}

import { CheckCircle2, XCircle, Info, X } from 'lucide-react';
import { useToastStore } from '@/stores/toastStore';

const TYPE_CONFIG = {
  success: {
    icon: <CheckCircle2 size={15} />,
    bg: 'rgba(5, 150, 105, 0.95)',
    border: 'rgba(5, 150, 105, 0.4)',
    shadow: 'rgba(5, 150, 105, 0.25)',
  },
  error: {
    icon: <XCircle size={15} />,
    bg: 'rgba(220, 38, 38, 0.95)',
    border: 'rgba(220, 38, 38, 0.4)',
    shadow: 'rgba(220, 38, 38, 0.25)',
  },
  info: {
    icon: <Info size={15} />,
    bg: 'rgba(30, 64, 175, 0.95)',
    border: 'rgba(30, 64, 175, 0.4)',
    shadow: 'rgba(30, 64, 175, 0.25)',
  },
};

export default function ToastContainer() {
  const { toasts, remove } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <>
      <style>{`
        @keyframes toast-slide-in {
          from { transform: translateX(110%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>

      <div
        style={{
          position: 'fixed',
          bottom: '32px',
          right: '32px',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          pointerEvents: 'none',
        }}
        aria-live="polite"
        aria-label="Notifications"
      >
        {toasts.map((toast) => {
          const cfg = TYPE_CONFIG[toast.type];
          return (
            <div
              key={toast.id}
              role="status"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '11px 14px 11px 16px',
                background: cfg.bg,
                border: `1px solid ${cfg.border}`,
                borderRadius: '8px',
                boxShadow: `0 8px 24px ${cfg.shadow}, 0 2px 6px rgba(0,0,0,0.15)`,
                color: '#fff',
                fontSize: '13px',
                fontWeight: 500,
                fontFamily: 'var(--font-sans)',
                backdropFilter: 'blur(8px)',
                animation: 'toast-slide-in 0.28s cubic-bezier(0.22, 1, 0.36, 1) both',
                pointerEvents: 'all',
                minWidth: '240px',
                maxWidth: '360px',
              }}
            >
              <span style={{ display: 'flex', flexShrink: 0 }}>{cfg.icon}</span>
              <span style={{ flex: 1, lineHeight: 1.4 }}>{toast.message}</span>
              <button
                type="button"
                onClick={() => remove(toast.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(255,255,255,0.15)',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '2px',
                  cursor: 'pointer',
                  color: '#fff',
                  flexShrink: 0,
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.28)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.15)')}
                aria-label="Fermer"
              >
                <X size={13} />
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}

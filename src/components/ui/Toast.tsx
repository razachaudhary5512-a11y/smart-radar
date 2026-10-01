import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '@/lib/format';

type Tone = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  tone: Tone;
  title: string;
  body?: string;
  action?: { label: string; onClick(): void };
}

interface ToastApi {
  show(t: Omit<ToastItem, 'id'>): void;
  success(title: string, body?: string): void;
  error(title: string, body?: string): void;
  info(title: string, body?: string): void;
}

const ToastContext = createContext<ToastApi | null>(null);

const ICONS = { success: CheckCircle2, error: AlertTriangle, info: Info };
const TONES = {
  success: 'text-success-600',
  error: 'text-danger-600',
  info: 'text-primary-600',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const next = useRef(1);

  const dismiss = useCallback((id: number) => setItems((l) => l.filter((t) => t.id !== id)), []);

  const show = useCallback(
    (t: Omit<ToastItem, 'id'>) => {
      const id = next.current++;
      setItems((l) => [...l.slice(-2), { ...t, id }]);
      setTimeout(() => dismiss(id), t.tone === 'error' ? 6000 : 3800);
    },
    [dismiss]
  );

  const api: ToastApi = {
    show,
    success: (title, body) => show({ tone: 'success', title, body }),
    error: (title, body) => show({ tone: 'error', title, body }),
    info: (title, body) => show({ tone: 'info', title, body }),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-0 z-[80] flex flex-col items-center gap-2 px-4 pt-[max(env(safe-area-inset-top),12px)] lg:items-end lg:pr-6 lg:pt-6"
      >
        {items.map((t) => {
          const Icon = ICONS[t.tone];
          return (
            <div
              key={t.id}
              role={t.tone === 'error' ? 'alert' : 'status'}
              className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border border-line bg-surface/95 p-3.5 shadow-lift backdrop-blur-xl animate-slide-up"
            >
              <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', TONES[t.tone])} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">{t.title}</p>
                {t.body && <p className="mt-0.5 text-[13px] text-ink-2">{t.body}</p>}
                {t.action && (
                  <button
                    className="mt-1.5 text-[13px] font-semibold text-primary-600"
                    onClick={() => {
                      t.action!.onClick();
                      dismiss(t.id);
                    }}
                  >
                    {t.action.label}
                  </button>
                )}
              </div>
              <button aria-label="Dismiss" onClick={() => dismiss(t.id)} className="-m-1 rounded-lg p-1 text-ink-3 hover:text-ink">
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/format';

interface SheetProps {
  open: boolean;
  onClose(): void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Desktop dialog width. */
  size?: 'sm' | 'md' | 'lg';
  /** Hide the default header (for custom layouts). */
  bare?: boolean;
}

let openCount = 0;

/** Bottom sheet on mobile, centred dialog on desktop. */
export function Sheet({ open, onClose, title, description, children, footer, size = 'md', bare }: SheetProps) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    openCount++;
    document.body.style.overflow = 'hidden';
    const prevFocus = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => {
      // Only focus fields that opt in, so mobile keyboards don't pop up unexpectedly.
      const first = ref.current?.querySelector<HTMLElement>('[data-autofocus]');
      (first ?? ref.current)?.focus();
    }, 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
      if (e.key === 'Tab' && ref.current) {
        const f = ref.current.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          last.focus();
          e.preventDefault();
        } else if (!e.shiftKey && document.activeElement === last) {
          first.focus();
          e.preventDefault();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey);
      openCount--;
      if (openCount === 0) document.body.style.overflow = '';
      prevFocus?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  const widths = { sm: 'lg:max-w-md', md: 'lg:max-w-lg', lg: 'lg:max-w-2xl' };

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center lg:items-center lg:p-6">
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px] animate-fade-in" onClick={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={cn(
          'relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[28px] border border-line bg-surface shadow-lift outline-none',
          'animate-slide-up lg:rounded-3xl lg:animate-scale-in',
          widths[size]
        )}
      >
        <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-line lg:hidden" />
        {!bare && (title || description) && (
          <div className="flex items-start gap-3 px-5 pb-2 pt-3 lg:px-6 lg:pt-5">
            <div className="min-w-0 flex-1">
              {title && (
                <h2 id={titleId} className="text-lg font-bold tracking-tight text-ink">
                  {title}
                </h2>
              )}
              {description && <p className="mt-1 text-sm text-ink-2">{description}</p>}
            </div>
            <button aria-label="Close" onClick={onClose} className="icon-btn -mr-2 -mt-1 h-9 w-9">
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
        <div className={cn('min-h-0 flex-1 overflow-y-auto overscroll-contain', !bare && 'px-5 pb-5 lg:px-6 lg:pb-6')}>{children}</div>
        {footer && <div className="border-t border-line bg-surface px-5 py-3.5 pb-safe lg:px-6">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

interface ConfirmProps {
  open: boolean;
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  tone?: 'danger' | 'primary';
  busy?: boolean;
  onConfirm(): void;
  onClose(): void;
  children?: ReactNode;
}

export function ConfirmDialog({ open, title, body, confirmLabel = 'Confirm', tone = 'primary', busy, onConfirm, onClose, children }: ConfirmProps) {
  return (
    <Sheet open={open} onClose={onClose} title={title} description={body} size="sm">
      {children}
      <div className="mt-4 flex gap-2.5">
        <button className="btn-secondary flex-1" onClick={onClose} disabled={busy} data-autofocus={tone === 'danger' || undefined}>
          Cancel
        </button>
        <button className={cn(tone === 'danger' ? 'btn-danger' : 'btn-primary', 'flex-1')} onClick={onConfirm} disabled={busy} data-autofocus={tone !== 'danger' || undefined}>
          {busy ? 'Working…' : confirmLabel}
        </button>
      </div>
    </Sheet>
  );
}

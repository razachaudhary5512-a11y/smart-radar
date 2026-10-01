import { useState, type ReactNode } from 'react';
import { BadgeCheck, Loader2, ShieldAlert, type LucideIcon } from 'lucide-react';
import { cn, initials } from '@/lib/format';
import { getCategory } from '@/lib/categories';
import type { PublicProfile } from '@/lib/types';

export { Sheet, ConfirmDialog } from './Sheet';
export { ToastProvider, useToast } from './Toast';

// ── Avatar ──────────────────────────────────────────────────────────────────

const AVATAR_COLORS = ['#2549ea', '#0d9488', '#db2777', '#7c3aed', '#ea580c', '#059669', '#0284c7', '#ca8a04'];

function colorFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

export function Avatar({ name, src, size = 40, className, ring }: { name: string; src?: string | null; size?: number; className?: string; ring?: boolean }) {
  const [broken, setBroken] = useState(false);
  const style = { width: size, height: size, fontSize: Math.max(11, size * 0.38) };
  if (src && !broken) {
    return (
      <img
        src={src}
        alt=""
        onError={() => setBroken(true)}
        className={cn('shrink-0 rounded-full object-cover', ring && 'ring-2 ring-surface', className)}
        style={style}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn('inline-flex shrink-0 select-none items-center justify-center rounded-full font-bold text-white', ring && 'ring-2 ring-surface', className)}
      style={{ ...style, background: colorFor(name || '?') }}
    >
      {initials(name || '?')}
    </span>
  );
}

// ── Verification ────────────────────────────────────────────────────────────

type VerifiableProfile = { verification_status: PublicProfile['verification_status']; verification_expiry?: string | null };

export function verificationState(p: VerifiableProfile | null | undefined) {
  if (!p || p.verification_status !== 'approved') return null;
  if (!p.verification_expiry) return 'valid' as const;
  const days = (new Date(p.verification_expiry).getTime() - Date.now()) / 86_400_000;
  if (days < 0) return 'expired' as const;
  if (days < 30) return 'due_soon' as const;
  return 'valid' as const;
}

export function VerifiedBadge({ profile, size = 16, withLabel }: { profile: VerifiableProfile | null | undefined; size?: number; withLabel?: boolean }) {
  const s = verificationState(profile);
  if (!s || s === 'expired') return null;
  return (
    <span className="inline-flex items-center gap-1 text-primary-600" title={s === 'due_soon' ? 'CNIC verified — renewal due soon' : 'CNIC verified'}>
      <BadgeCheck style={{ width: size, height: size }} className="fill-primary-600 text-white dark:text-surface" />
      {withLabel && <span className="text-xs font-semibold">Verified</span>}
    </span>
  );
}

// ── Category badge ──────────────────────────────────────────────────────────

export function CategoryIcon({ slug, size = 40, rounded = 'rounded-xl' }: { slug: string; size?: number; rounded?: string }) {
  const cat = getCategory(slug);
  const Icon = cat.icon;
  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center', rounded)}
      style={{ width: size, height: size, background: `${cat.color}1a`, color: cat.color }}
    >
      <Icon style={{ width: size * 0.5, height: size * 0.5 }} strokeWidth={2.2} />
    </span>
  );
}

export function CategoryBadge({ slug, className }: { slug: string; className?: string }) {
  const cat = getCategory(slug);
  const Icon = cat.icon;
  return (
    <span
      className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide', className)}
      style={{ background: `${cat.color}17`, color: cat.color }}
    >
      <Icon className="h-3 w-3" strokeWidth={2.5} />
      {cat.short}
    </span>
  );
}

// ── Misc primitives ─────────────────────────────────────────────────────────

export function Badge({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'primary' | 'success' | 'warning' | 'danger'; className?: string }) {
  const tones = {
    neutral: 'bg-surface-2 text-ink-2',
    primary: 'bg-primary-50 text-primary-700 dark:bg-primary-500/15 dark:text-primary-300',
    success: 'bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-500',
    warning: 'bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-500',
    danger: 'bg-danger-50 text-danger-700 dark:bg-danger-500/15 dark:text-danger-400',
  };
  return <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold', tones[tone], className)}>{children}</span>;
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-5 w-5 animate-spin text-ink-3', className)} />;
}

export function EmptyState({ icon: Icon, title, body, action, className }: { icon: LucideIcon; title: string; body?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-14 text-center', className)}>
      <div className="relative mb-4">
        <div className="absolute inset-0 rounded-3xl bg-primary-500/15 blur-xl" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-3xl border border-line bg-surface text-primary-600 shadow-card">
          <Icon className="h-7 w-7" />
        </div>
      </div>
      <h3 className="text-base font-bold text-ink">{title}</h3>
      {body && <p className="mt-1.5 max-w-sm text-sm text-ink-2">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?(): void }) {
  return (
    <EmptyState
      icon={ShieldAlert}
      title="Something went wrong"
      body={message}
      action={onRetry && <button className="btn-outline" onClick={onRetry}>Try again</button>}
    />
  );
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange(v: boolean): void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-50',
        checked ? 'bg-primary-600' : 'bg-line'
      )}
    >
      <span className={cn('inline-block h-5 w-5 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-6' : 'translate-x-1')} />
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  size = 'md',
}: {
  value: T;
  onChange(v: NoInfer<T>): void;
  // NoInfer: T comes from `value` only, so option literals / setState don't widen it.
  options: { value: NoInfer<T>; label: ReactNode; icon?: LucideIcon }[];
  className?: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div role="tablist" className={cn('inline-flex rounded-xl bg-surface-2 p-1', className)}>
      {options.map((o) => {
        const active = o.value === value;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-semibold transition-all',
              size === 'sm' ? 'h-8 px-2.5 text-xs' : 'h-9 px-3.5 text-[13px]',
              active ? 'bg-surface text-ink shadow-card' : 'text-ink-2 hover:text-ink'
            )}
          >
            {Icon && <Icon className="h-4 w-4" />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Image with graceful fallback to a tinted category tile. */
export function SmartImage({ src, alt, className, category }: { src: string; alt: string; className?: string; category?: string }) {
  const [state, setState] = useState<'loading' | 'ok' | 'broken'>('loading');
  if (state === 'broken') {
    const cat = category ? getCategory(category) : null;
    const Icon = cat?.icon;
    return (
      <div className={cn('flex items-center justify-center', className)} style={{ background: cat ? `${cat.color}14` : undefined }}>
        {Icon && <Icon className="h-8 w-8 opacity-50" style={{ color: cat?.color }} />}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onLoad={() => setState('ok')}
      onError={() => setState('broken')}
      className={cn(className, state === 'loading' && 'skeleton')}
    />
  );
}

export function SectionHeader({ title, action, eyebrow, className }: { title: ReactNode; action?: ReactNode; eyebrow?: string; className?: string }) {
  return (
    <div className={cn('flex items-end justify-between gap-3', className)}>
      <div>
        {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
        <h2 className="text-[17px] font-bold tracking-tight text-ink">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function PostCardSkeleton() {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        <div className="skeleton h-10 w-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <div className="skeleton h-3 w-1/3" />
          <div className="skeleton h-3 w-1/4" />
        </div>
      </div>
      <div className="skeleton mt-4 h-4 w-4/5" />
      <div className="skeleton mt-2 h-3 w-full" />
      <div className="skeleton mt-2 h-3 w-2/3" />
      <div className="skeleton mt-4 h-8 w-full rounded-xl" />
    </div>
  );
}

export function TrustRing({ score, size = 56 }: { score: number; size?: number }) {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#2549ea' : score >= 40 ? '#f59e0b' : '#ef4444';
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--line))" strokeWidth={5} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.max(0, Math.min(100, score)) / 100)}
          className="transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <span className="absolute text-sm font-extrabold text-ink">{score}</span>
    </div>
  );
}

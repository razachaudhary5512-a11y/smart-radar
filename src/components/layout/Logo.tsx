import { useId } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/format';

export function LogoMark({ size = 36, className }: { size?: number; className?: string }) {
  // Unique ids: a gradient defined inside a display:none copy would blank the visible one.
  const id = useId().replace(/:/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={cn('shrink-0', className)} aria-hidden>
      <defs>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3b66f5" />
          <stop offset="1" stopColor="#1d38d7" />
        </linearGradient>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#2ee6c5" stopOpacity="0" />
          <stop offset="1" stopColor="#2ee6c5" stopOpacity=".9" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill={`url(#${id}g)`} />
      <circle cx="32" cy="32" r="20" fill="none" stroke="#fff" strokeOpacity=".28" strokeWidth="2.5" />
      <circle cx="32" cy="32" r="11" fill="none" stroke="#fff" strokeOpacity=".45" strokeWidth="2.5" />
      <path d="M32 32 L32 12 A20 20 0 0 1 50.5 24.5 Z" fill={`url(#${id}s)`} />
      <circle cx="32" cy="32" r="3.5" fill="#fff" />
      <circle cx="44" cy="21" r="3" fill="#2ee6c5" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn('flex items-center gap-2.5', className)} aria-label="Be Alert home">
      <LogoMark size={34} />
      <span className="text-[17px] font-extrabold tracking-tight text-ink">
        Be <span className="text-primary-600">Alert</span>
      </span>
    </Link>
  );
}

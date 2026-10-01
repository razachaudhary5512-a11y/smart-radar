import { useId, useMemo } from 'react';
import { getCategory } from '@/lib/categories';
import { cn } from '@/lib/format';
import type { Coords, PostWithRelations } from '@/lib/types';

interface Props {
  center: Coords;
  radiusKm: number;
  posts: PostWithRelations[];
  size?: number;
  onBlipClick?(post: PostWithRelations): void;
}

/** Animated radar with one blip per nearby post, placed by true bearing & distance. */
export function RadarScope({ center, radiusKm, posts, size = 220, onBlipClick }: Props) {
  const r = size / 2;
  const uid = useId().replace(/:/g, '');
  const small = size < 160;
  const blips = useMemo(
    () =>
      posts.slice(0, 40).map((p) => {
        const dy = (p.lat - center.lat) * 111.32;
        const dx = (p.lng - center.lng) * 111.32 * Math.cos((center.lat * Math.PI) / 180);
        const scale = (r - 10) / radiusKm;
        const x = r + Math.max(-r + 8, Math.min(r - 8, dx * scale));
        const y = r - Math.max(-r + 8, Math.min(r - 8, dy * scale));
        const cat = getCategory(p.category);
        return { p, x, y, color: cat.color, urgent: Boolean(cat.isUrgent) };
      }),
    [posts, center.lat, center.lng, radiusKm, r]
  );

  return (
    <div className="relative select-none" style={{ width: size, height: size }} aria-hidden={!onBlipClick}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0">
        <defs>
          <radialGradient id={`${uid}bg`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#2549ea" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#2549ea" stopOpacity="0.02" />
          </radialGradient>
          <linearGradient id={`${uid}sw`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#14d1b0" stopOpacity="0" />
            <stop offset="100%" stopColor="#14d1b0" stopOpacity="0.45" />
          </linearGradient>
        </defs>
        <circle cx={r} cy={r} r={r - 1} fill={`url(#${uid}bg)`} stroke="currentColor" strokeOpacity="0.14" />
        {[0.25, 0.5, 0.75].map((f) => (
          <circle key={f} cx={r} cy={r} r={(r - 1) * f} fill="none" stroke="currentColor" strokeOpacity="0.12" strokeDasharray="3 4" />
        ))}
        <line x1={r} y1={4} x2={r} y2={size - 4} stroke="currentColor" strokeOpacity="0.08" />
        <line x1={4} y1={r} x2={size - 4} y2={r} stroke="currentColor" strokeOpacity="0.08" />
      </svg>
      <div className="absolute inset-0 animate-radar-sweep rounded-full" style={{ transformOrigin: '50% 50%' }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <path d={`M ${r} ${r} L ${r} 2 A ${r - 2} ${r - 2} 0 0 1 ${r + (r - 2) * Math.sin(Math.PI / 3)} ${r - (r - 2) * Math.cos(Math.PI / 3)} Z`} fill={`url(#${uid}sw)`} />
        </svg>
      </div>
      {blips.map(({ p, x, y, color, urgent }) => (
        <button
          key={p.id}
          type="button"
          tabIndex={onBlipClick ? 0 : -1}
          title={p.title}
          onClick={() => onBlipClick?.(p)}
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: x, top: y }}
        >
          {urgent && <span className="absolute inset-0 animate-ping-slow rounded-full" style={{ background: color }} />}
          <span
            className={cn('relative block rounded-full', small ? 'h-1.5 w-1.5 ring-1 ring-white/60' : 'h-2.5 w-2.5 ring-2 ring-surface')}
            style={{ background: color }}
          />
        </button>
      ))}
      <span className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-600 ring-4 ring-primary-600/25" />
      <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 rounded-full bg-surface/80 px-1.5 text-[10px] font-bold text-ink-3 backdrop-blur">
        {radiusKm} km
      </span>
    </div>
  );
}

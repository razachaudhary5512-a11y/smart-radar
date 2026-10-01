import { useState } from 'react';
import { getCategory } from '@/lib/categories';
import { formatDate } from '@/lib/format';

/**
 * Single-series column chart (posts per day). One hue, no legend (the card
 * title names the series), recessive grid, 4px rounded data-ends anchored to
 * the baseline, 2px gaps, per-bar hover tooltip with a larger hit target.
 */
export function DailyBars({ data, height = 200 }: { data: { date: string; count: number }[]; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.count));
  const niceMax = Math.ceil(max / 5) * 5;
  const ticks = [0, niceMax / 2, niceMax];
  const padL = 28;
  const padB = 22;
  const w = 600;
  const plotH = height - padB - 8;
  const band = (w - padL) / data.length;
  const barW = Math.max(4, band - 2 - Math.min(10, band * 0.3));
  const y = (v: number) => 8 + plotH - (v / niceMax) * plotH;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${w} ${height}`} className="h-auto w-full" role="img" aria-label="Posts per day over the last 14 days">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={w} y1={y(t)} y2={y(t)} stroke="rgb(var(--line))" strokeWidth={1} />
            <text x={padL - 6} y={y(t) + 4} textAnchor="end" className="fill-ink-3 text-[10px] font-medium">
              {t}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = padL + i * band + (band - barW) / 2;
          const top = y(d.count);
          const h = Math.max(0, y(0) - top);
          const r = Math.min(4, h / 2, barW / 2);
          const path = `M${x},${y(0)} L${x},${top + r} Q${x},${top} ${x + r},${top} L${x + barW - r},${top} Q${x + barW},${top} ${x + barW},${top + r} L${x + barW},${y(0)} Z`;
          const label = new Date(d.date);
          return (
            <g key={d.date} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={padL + i * band} y={0} width={band} height={height} fill="transparent" />
              <path d={path} className={hover === null || hover === i ? 'fill-primary-600 dark:fill-primary-400' : 'fill-primary-600/40 dark:fill-primary-400/40'} />
              {(i % 2 === 0 || data.length <= 7) && (
                <text x={x + barW / 2} y={height - 6} textAnchor="middle" className="fill-ink-3 text-[10px] font-medium">
                  {label.getDate()}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs shadow-lift"
          style={{ left: `${((padL + hover * band + band / 2) / w) * 100}%`, top: `${(y(data[hover].count) / height) * 100}%` }}
        >
          <p className="font-bold text-ink">{data[hover].count} posts</p>
          <p className="text-ink-3">{formatDate(data[hover].date, { weekday: 'short', day: 'numeric', month: 'short' })}</p>
        </div>
      )}
    </div>
  );
}

/** Horizontal magnitude bars by category — single hue; identity via icon + label text. */
export function CategoryBars({ data }: { data: { category: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const total = data.reduce((s, d) => s + d.count, 0) || 1;
  return (
    <ul className="space-y-3">
      {data.slice(0, 8).map((d) => {
        const c = getCategory(d.category);
        return (
          <li key={d.category} title={`${c.label}: ${d.count} posts (${Math.round((d.count / total) * 100)}%)`}>
            <div className="mb-1 flex items-center justify-between gap-3 text-[13px]">
              <span className="flex min-w-0 items-center gap-2 font-semibold text-ink-2">
                <c.icon className="h-4 w-4 shrink-0 text-ink-3" />
                <span className="truncate">{c.label}</span>
              </span>
              <span className="shrink-0 font-bold tabular-nums text-ink">
                {d.count} <span className="font-medium text-ink-3">· {Math.round((d.count / total) * 100)}%</span>
              </span>
            </div>
            <div className="h-2 rounded-full bg-surface-2">
              <div className="h-full rounded-r-full bg-primary-600 dark:bg-primary-400" style={{ width: `${(d.count / max) * 100}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

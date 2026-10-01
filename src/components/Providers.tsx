import { BadgeCheck, MessageCircle, Phone, Store } from 'lucide-react';
import { CategoryIcon } from '@/components/ui';
import { useApi } from '@/data';
import { useQuery } from '@/lib/hooks';
import { getCategory } from '@/lib/categories';
import { cn, telLink, whatsappLink } from '@/lib/format';
import type { ProviderListing } from '@/lib/types';

/** Admin-approved local businesses — the verified provider directory. */
export function useProviders() {
  const api = useApi();
  return useQuery(() => api.listProviders(), [api], { scopes: ['admin', 'listings'] });
}

function ProviderActions({ p, size = 'sm' }: { p: ProviderListing; size?: 'sm' | 'md' }) {
  if (!p.phone) return null;
  const cls = size === 'sm' ? 'h-8 w-8' : 'h-10 w-10';
  return (
    <div className="flex shrink-0 gap-1.5">
      <a href={telLink(p.phone)} aria-label={`Call ${p.business_name}`} className={cn('inline-flex items-center justify-center rounded-xl bg-primary-600/10 text-primary-600 hover:bg-primary-600/20', cls)}>
        <Phone className="h-4 w-4" />
      </a>
      <a
        href={whatsappLink(p.phone, `Hi ${p.business_name}, I found you on Smart Radar.`)}
        target="_blank"
        rel="noreferrer"
        aria-label={`WhatsApp ${p.business_name}`}
        className={cn('inline-flex items-center justify-center rounded-xl bg-[#25D366]/15 text-[#128C7E] hover:bg-[#25D366]/25', cls)}
      >
        <MessageCircle className="h-4 w-4" />
      </a>
    </div>
  );
}

/** Compact list for the desktop right rail. */
export function ProvidersCard() {
  const { data } = useProviders();
  if (!data?.length) return null;
  return (
    <div className="card p-5">
      <h3 className="flex items-center gap-2 font-bold text-ink">
        <BadgeCheck className="h-4 w-4 fill-primary-600 text-white dark:text-surface" /> Verified local businesses
      </h3>
      <p className="mt-0.5 text-xs text-ink-3">Reviewed and approved by Smart Radar moderators.</p>
      <ul className="mt-3 space-y-1">
        {data.slice(0, 4).map((p) => (
          <li key={p.id} className="-mx-2 flex items-center gap-3 rounded-xl p-2 hover:bg-surface-2">
            <CategoryIcon slug={p.category} size={36} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-ink">{p.business_name}</p>
              <p className="truncate text-[11px] text-ink-3">{getCategory(p.category).short}</p>
            </div>
            <ProviderActions p={p} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Horizontal strip (mobile feed) or grid (Explore). */
export function ProvidersSection({ layout = 'strip', title = 'Verified local businesses' }: { layout?: 'strip' | 'grid'; title?: string }) {
  const { data } = useProviders();
  if (!data?.length) return null;
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-[17px] font-bold tracking-tight text-ink">
          <Store className="h-4 w-4 text-primary-600" /> {title}
        </h2>
        <span className="text-xs font-semibold text-ink-3">{data.length} approved</span>
      </div>
      <div
        className={cn(
          layout === 'strip' ? '-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 no-scrollbar' : 'grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3'
        )}
      >
        {data.map((p) => (
          <article key={p.id} className={cn('card flex flex-col p-4', layout === 'strip' && 'w-[250px] shrink-0 snap-start')}>
            <div className="flex items-center gap-3">
              <CategoryIcon slug={p.category} size={40} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1 truncate text-sm font-bold text-ink">
                  <span className="truncate">{p.business_name}</span>
                  <BadgeCheck className="h-4 w-4 shrink-0 fill-primary-600 text-white dark:text-surface" />
                </p>
                <p className="text-xs text-ink-3">{getCategory(p.category).label}</p>
              </div>
            </div>
            {p.description && <p className="mt-2.5 line-clamp-2 flex-1 text-[13px] text-ink-2">{p.description}</p>}
            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="truncate text-xs text-ink-3">{p.location_label}</span>
              <ProviderActions p={p} size="md" />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

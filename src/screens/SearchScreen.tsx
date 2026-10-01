import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Clock, Search, SearchX, X } from 'lucide-react';
import { PageBody, PageHeader } from '@/components/layout/Page';
import { PostCard } from '@/components/post/PostCard';
import { ProvidersSection } from '@/components/Providers';
import { CategoryIcon, EmptyState, ErrorState, PostCardSkeleton, Segmented } from '@/components/ui';
import { useApi } from '@/data';
import { finalizeFeed } from '@/data/feed';
import { useAuth } from '@/lib/auth';
import { useDebounced, useLocalStorage, useQuery } from '@/lib/hooks';
import { useRadar } from '@/lib/location-context';
import { categoriesByGroup, getCategory } from '@/lib/categories';
import { cn } from '@/lib/format';
import type { FeedSort, PostWithRelations } from '@/lib/types';

const SUGGESTIONS = ['AC repair', '2 bed flat', 'B+ blood', 'Maths tutor', 'iPhone', 'Carpool', 'Electrician', 'Discount'];

export function SearchScreen() {
  const api = useApi();
  const { user } = useAuth();
  const radar = useRadar();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const dq = useDebounced(q, 250);
  const [category, setCategory] = useState<string | null>(params.get('category'));
  const [radius, setRadius] = useState(5);
  const [sort, setSort] = useState<FeedSort>('nearest');
  const [recent, setRecent] = useLocalStorage<string[]>('sr_recent_searches', []);

  const { data, loading, error, refetch, setData } = useQuery(
    () => api.listPosts({ center: radar.coords, radiusKm: 5, sort: 'latest' }, user?.id),
    [api, radar.coords.lat, radar.coords.lng, user?.id],
    { scopes: ['posts', 'bookmarks'] }
  );

  const active = dq.trim().length > 0 || Boolean(category);
  const results = useMemo(
    () => (active ? finalizeFeed(data ?? [], { center: radar.coords, radiusKm: radius, category, search: dq, sort }) : []),
    [active, data, radar.coords, radius, category, dq, sort]
  );

  const commit = (term: string) => {
    const t = term.trim();
    setQ(t);
    const next = new URLSearchParams(params);
    if (t) next.set('q', t);
    else next.delete('q');
    setParams(next, { replace: true });
    if (t) setRecent([t, ...recent.filter((r) => r.toLowerCase() !== t.toLowerCase())].slice(0, 6));
  };

  const onChange = useCallback((p: PostWithRelations) => setData((l) => (l ?? []).map((x) => (x.id === p.id ? p : x))), [setData]);

  return (
    <>
      <PageHeader title="Explore" subtitle="Search everything within 5 km — jobs, rentals, services, deals and more." />
      <PageBody>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            commit(q);
          }}
          className="relative"
        >
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-3" />
          <input
            type="search"
            autoFocus={window.matchMedia('(min-width: 1024px)').matches}
            enterKeyHint="search"
            className="input h-14 rounded-2xl pl-12 pr-12 text-base shadow-card"
            placeholder="Search posts, places, services…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onBlur={() => q.trim() && commit(q)}
          />
          {q && (
            <button type="button" onClick={() => commit('')} className="icon-btn absolute right-2 top-1/2 h-9 w-9 -translate-y-1/2" aria-label="Clear search">
              <X className="h-4 w-4" />
            </button>
          )}
        </form>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Segmented
            size="sm"
            value={String(radius) as '1' | '2' | '3' | '4' | '5'}
            onChange={(v) => setRadius(Number(v))}
            options={['1', '2', '3', '4', '5'].map((k) => ({ value: k as '1', label: `${k} km` }))}
          />
          <Segmented
            size="sm"
            value={sort}
            onChange={setSort}
            options={[
              { value: 'nearest', label: 'Nearest' },
              { value: 'latest', label: 'Latest' },
              { value: 'top', label: 'Top' },
            ]}
          />
          {category && (
            <button onClick={() => setCategory(null)} className="chip-on">
              {getCategory(category).short} <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {!active ? (
          <div className="mt-8 space-y-8">
            {recent.length > 0 && (
              <section>
                <div className="mb-3 flex items-center justify-between">
                  <p className="eyebrow">Recent</p>
                  <button className="text-xs font-semibold text-ink-3 hover:text-ink" onClick={() => setRecent([])}>
                    Clear
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recent.map((r) => (
                    <button key={r} onClick={() => commit(r)} className="chip-off">
                      <Clock className="h-3.5 w-3.5" /> {r}
                    </button>
                  ))}
                </div>
              </section>
            )}
            <ProvidersSection layout="grid" title="Verified businesses near you" />
            <section>
              <p className="eyebrow mb-3">Popular nearby</p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => commit(s)} className="chip-off">
                    <Search className="h-3.5 w-3.5" /> {s}
                  </button>
                ))}
              </div>
            </section>
            {categoriesByGroup().map((g) => (
              <section key={g.group}>
                <p className="eyebrow mb-3">{g.label}</p>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                  {g.items.map((c) => {
                    const n = (data ?? []).filter((p) => p.category === c.slug).length;
                    return (
                      <button key={c.slug} onClick={() => setCategory(c.slug)} className="card flex items-center gap-3 p-3 text-left transition hover:shadow-lift">
                        <CategoryIcon slug={c.slug} size={42} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-ink">{c.label}</p>
                          <p className="truncate text-xs text-ink-3">{c.description}</p>
                        </div>
                        <span className={cn('rounded-full px-2 py-0.5 text-xs font-bold', n ? 'bg-primary-600/10 text-primary-600' : 'text-ink-3')}>{n}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : loading ? (
          <div className="mt-6 space-y-3">
            <PostCardSkeleton />
            <PostCardSkeleton />
          </div>
        ) : results.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title="No matches nearby"
            body={`Nothing matched${dq ? ` “${dq}”` : ''} within ${radius} km. Try a wider radius or different words.`}
          />
        ) : (
          <div className="mx-auto mt-6 max-w-3xl">
            <p className="mb-3 text-sm text-ink-2">
              <b className="text-ink">{results.length}</b> result{results.length === 1 ? '' : 's'} within {radius} km
            </p>
            <div className="space-y-3">
              {results.map((p) => (
                <PostCard key={p.id} post={p} onChange={onChange} />
              ))}
            </div>
          </div>
        )}
      </PageBody>
    </>
  );
}

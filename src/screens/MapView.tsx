import 'leaflet/dist/leaflet.css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Circle, MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { ChevronDown, Crosshair, Layers, List, MapPin, Siren, X } from 'lucide-react';
import { useApi } from '@/data';
import { useAuth } from '@/lib/auth';
import { useQuery } from '@/lib/hooks';
import { useRadar } from '@/lib/location-context';
import { CATEGORIES, getCategory, headlineValue } from '@/lib/categories';
import { formatDistance } from '@/lib/location';
import { cn, telLink, timeAgo } from '@/lib/format';
import { categoryPin, clusterPin, emergencyPin, youAreHere } from '@/components/map/pins';
import { AreaSheet } from '@/components/radar/AreaSheet';
import { CategoryIcon, SmartImage, VerifiedBadge } from '@/components/ui';
import { TILE_ATTRIBUTION, TILE_URL } from '@/services/maps';
import type { Coords, EmergencyContact, PostWithRelations } from '@/lib/types';

export function MapView() {
  const api = useApi();
  const { user } = useAuth();
  const radar = useRadar();
  const navigate = useNavigate();
  const [category, setCategory] = useState<string | null>(null);
  const [selected, setSelected] = useState<PostWithRelations | null>(null);
  const [showEmergency, setShowEmergency] = useState(true);
  const [listOpen, setListOpen] = useState(false);
  const [areaOpen, setAreaOpen] = useState(false);
  const [flyTo, setFlyTo] = useState<{ c: Coords; z?: number; n: number } | null>(null);

  const { data } = useQuery(() => api.listPosts({ center: radar.coords, radiusKm: radar.radiusKm, sort: 'nearest' }, user?.id), [
    api,
    radar.coords.lat,
    radar.coords.lng,
    radar.radiusKm,
    user?.id,
  ]);
  const { data: emergency } = useQuery(() => api.listEmergencyContacts(), [api], { scopes: ['emergency'] });

  const posts = useMemo(() => (data ?? []).filter((p) => !category || p.category === category), [data, category]);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    (data ?? []).forEach((p) => m.set(p.category, (m.get(p.category) ?? 0) + 1));
    return m;
  }, [data]);

  const select = useCallback((p: PostWithRelations) => {
    setSelected(p);
    setFlyTo((f) => ({ c: { lat: p.lat, lng: p.lng }, z: 16, n: (f?.n ?? 0) + 1 }));
  }, []);

  const emergencyPins = (emergency ?? []).filter((e): e is EmergencyContact & { lat: number; lng: number } => e.lat !== null && e.lng !== null);

  return (
    <div className="relative h-[calc(100dvh-4rem-env(safe-area-inset-bottom))] overflow-hidden lg:h-dvh">
      <MapContainer center={[radar.coords.lat, radar.coords.lng]} zoom={14} className="h-full w-full" zoomControl={false} attributionControl>
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
        <ZoomControlBottomRight />
        <Circle
          center={[radar.coords.lat, radar.coords.lng]}
          radius={radar.radiusKm * 1000}
          pathOptions={{ color: '#2549ea', weight: 1.5, dashArray: '6 6', fillColor: '#2549ea', fillOpacity: 0.05 }}
        />
        {radar.gpsCoords && <Marker position={[radar.gpsCoords.lat, radar.gpsCoords.lng]} icon={youAreHere} zIndexOffset={1000} />}
        <Clustered posts={posts} selectedId={selected?.id ?? null} onSelect={select} />
        {showEmergency &&
          emergencyPins.map((e) => (
            <Marker key={e.id} position={[e.lat, e.lng]} icon={emergencyPin()} eventHandlers={{ click: () => window.open(telLink(e.phone), '_self') }} />
          ))}
        <Recenter center={radar.coords} />
        <FlyTo target={flyTo} />
        <MapClick onClick={() => setSelected(null)} />
      </MapContainer>

      {/* Top overlay */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] space-y-2 p-3 pt-[max(env(safe-area-inset-top),12px)] lg:left-[380px] lg:p-5">
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            onClick={() => setAreaOpen(true)}
            className="flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-2xl border border-line bg-surface/95 px-3.5 text-left shadow-lift backdrop-blur-xl lg:max-w-md lg:flex-none"
          >
            <MapPin className="h-5 w-5 shrink-0 text-primary-600" />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-ink-3">{posts.length} posts · {radar.radiusKm} km</p>
              <p className="truncate text-sm font-bold text-ink">{radar.areaLabel}</p>
            </div>
            <ChevronDown className="h-4 w-4 shrink-0 text-ink-3" />
          </button>
          <button
            onClick={() => setShowEmergency((v) => !v)}
            className={cn(
              'flex h-12 w-12 items-center justify-center rounded-2xl border shadow-lift backdrop-blur-xl',
              showEmergency ? 'border-danger-500/40 bg-danger-600 text-white' : 'border-line bg-surface/95 text-ink-2'
            )}
            aria-pressed={showEmergency}
            aria-label="Toggle emergency services layer"
            title="Emergency services layer"
          >
            <Siren className="h-5 w-5" />
          </button>
          <button
            onClick={() => setListOpen(true)}
            className="flex h-12 w-12 items-center justify-center rounded-2xl border border-line bg-surface/95 text-ink-2 shadow-lift backdrop-blur-xl lg:hidden"
            aria-label="Show list"
          >
            <List className="h-5 w-5" />
          </button>
        </div>
        <div className="pointer-events-auto -mx-3 flex gap-2 overflow-x-auto px-3 pb-1 no-scrollbar lg:mx-0 lg:px-0">
          <button onClick={() => setCategory(null)} className={cn(category ? 'chip-off' : 'chip-on', 'shadow-card')}>
            <Layers className="h-4 w-4" /> All
          </button>
          {CATEGORIES.filter((c) => counts.get(c.slug)).map((c) => {
            const on = category === c.slug;
            return (
              <button key={c.slug} onClick={() => setCategory(on ? null : c.slug)} className={cn(on ? 'chip-on' : 'chip-off', 'shadow-card')}>
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
                {c.short} <span className="opacity-60">{counts.get(c.slug)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Recenter */}
      <button
        onClick={() => {
          if (!radar.gpsCoords) radar.requestLocation();
          setFlyTo((f) => ({ c: radar.gpsCoords ?? radar.coords, z: 15, n: (f?.n ?? 0) + 1 }));
        }}
        className="absolute bottom-[132px] right-3 z-[500] flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-surface text-primary-600 shadow-lift lg:bottom-[112px] lg:right-5"
        aria-label="Centre on my location"
      >
        <Crosshair className="h-5 w-5" />
      </button>

      {/* Desktop list panel */}
      <aside className="absolute inset-y-0 left-0 z-[500] hidden w-[360px] flex-col border-r border-line bg-surface/95 backdrop-blur-xl lg:flex">
        <div className="border-b border-line px-5 pb-4 pt-6">
          <h1 className="text-xl font-extrabold tracking-tight text-ink">Live map</h1>
          <p className="text-sm text-ink-2">
            {posts.length} {category ? getCategory(category).short.toLowerCase() : ''} posts within {radar.radiusKm} km
          </p>
        </div>
        <PostList posts={posts} selectedId={selected?.id ?? null} onSelect={select} />
      </aside>

      {/* Mobile selected card */}
      {selected && (
        <div className="absolute inset-x-3 bottom-3 z-[600] animate-slide-up lg:bottom-6 lg:left-[384px] lg:right-auto lg:w-[380px]">
          <SelectedCard post={selected} onClose={() => setSelected(null)} onOpen={() => navigate(`/post/${selected.id}`)} />
        </div>
      )}

      {/* Mobile list sheet */}
      {listOpen && (
        <div className="fixed inset-0 z-[700] flex flex-col bg-surface animate-slide-up lg:hidden">
          <div className="flex items-center justify-between border-b border-line px-4 pb-3 pt-[max(env(safe-area-inset-top),12px)]">
            <p className="font-bold text-ink">{posts.length} posts nearby</p>
            <button className="icon-btn" onClick={() => setListOpen(false)} aria-label="Close list">
              <X className="h-5 w-5" />
            </button>
          </div>
          <PostList
            posts={posts}
            selectedId={selected?.id ?? null}
            onSelect={(p) => {
              setListOpen(false);
              select(p);
            }}
          />
        </div>
      )}

      <AreaSheet open={areaOpen} onClose={() => setAreaOpen(false)} />
    </div>
  );
}

function PostList({ posts, selectedId, onSelect }: { posts: PostWithRelations[]; selectedId: string | null; onSelect(p: PostWithRelations): void }) {
  if (!posts.length) return <p className="p-6 text-center text-sm text-ink-3">No posts in this area yet.</p>;
  return (
    <ul className="flex-1 divide-y divide-line overflow-y-auto">
      {posts.map((p) => {
        const c = getCategory(p.category);
        const h = headlineValue(p.category, p.metadata);
        return (
          <li key={p.id}>
            <button onClick={() => onSelect(p)} className={cn('flex w-full items-start gap-3 px-4 py-3.5 text-left transition hover:bg-surface-2', selectedId === p.id && 'bg-primary-600/5')}>
              <CategoryIcon slug={p.category} size={40} />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: c.color }}>
                  {c.short}
                  {h ? ` · ${h}` : ''}
                </p>
                <p className="line-clamp-2 text-sm font-semibold leading-snug text-ink">{p.title}</p>
                <p className="mt-0.5 text-xs text-ink-3">
                  {formatDistance(p.distance_km)} · {timeAgo(p.created_at)}
                </p>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function SelectedCard({ post, onClose, onOpen }: { post: PostWithRelations; onClose(): void; onOpen(): void }) {
  const c = getCategory(post.category);
  const h = headlineValue(post.category, post.metadata);
  return (
    <div className="card overflow-hidden shadow-lift">
      <div className="flex gap-3 p-3">
        {post.image_urls[0] ? (
          <SmartImage src={post.image_urls[0]} alt="" category={post.category} className="h-20 w-20 shrink-0 rounded-xl object-cover" />
        ) : (
          <CategoryIcon slug={post.category} size={56} rounded="rounded-2xl" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: c.color }}>
              {c.short}
              {h ? ` · ${h}` : ''}
            </p>
            <button onClick={onClose} className="-m-1 rounded-lg p-1 text-ink-3 hover:text-ink" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="line-clamp-2 text-[15px] font-bold leading-snug text-ink">{post.title}</p>
          <p className="mt-1 flex items-center gap-1 text-xs text-ink-3">
            <span className="truncate">{post.author?.display_name || 'Neighbour'}</span>
            <VerifiedBadge profile={post.author} size={13} />
            <span>· {formatDistance(post.distance_km)} · {timeAgo(post.created_at)}</span>
          </p>
        </div>
      </div>
      <div className="flex border-t border-line">
        <Link to={`/post/${post.id}`} onClick={onOpen} className="flex h-11 flex-1 items-center justify-center text-sm font-bold text-primary-600 hover:bg-surface-2">
          View details
        </Link>
      </div>
    </div>
  );
}

// ── map helpers ─────────────────────────────────────────────────────────────

function ZoomControlBottomRight() {
  const map = useMap();
  useEffect(() => {
    const z = L.control.zoom({ position: 'bottomright' });
    z.addTo(map);
    return () => {
      z.remove();
    };
  }, [map]);
  return null;
}

function Recenter({ center }: { center: Coords }) {
  const map = useMap();
  useEffect(() => {
    map.setView([center.lat, center.lng], map.getZoom(), { animate: true });
  }, [map, center.lat, center.lng]);
  return null;
}

function FlyTo({ target }: { target: { c: Coords; z?: number; n: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target.c.lat, target.c.lng], target.z ?? map.getZoom(), { duration: 0.6 });
  }, [map, target]);
  return null;
}

function MapClick({ onClick }: { onClick(): void }) {
  useMapEvents({ click: onClick });
  return null;
}

/** Screen-space grid clustering — recomputed on zoom/pan. */
function Clustered({ posts, selectedId, onSelect }: { posts: PostWithRelations[]; selectedId: string | null; onSelect(p: PostWithRelations): void }) {
  const map = useMap();
  const [view, setView] = useState(0);
  useMapEvents({ zoomend: () => setView((v) => v + 1), moveend: () => setView((v) => v + 1) });

  const groups = useMemo(() => {
    void view;
    const zoom = map.getZoom();
    const cell = zoom >= 17 ? 0 : 56;
    if (!cell) return posts.map((p) => ({ key: p.id, items: [p] }));
    const buckets = new Map<string, PostWithRelations[]>();
    for (const p of posts) {
      const pt = map.project([p.lat, p.lng], zoom);
      const key = `${Math.floor(pt.x / cell)}:${Math.floor(pt.y / cell)}`;
      const b = buckets.get(key);
      if (b) b.push(p);
      else buckets.set(key, [p]);
    }
    return [...buckets.entries()].map(([key, items]) => ({ key, items }));
  }, [posts, map, view]);

  return (
    <>
      {groups.map(({ key, items }) => {
        if (items.length === 1) {
          const p = items[0];
          const c = getCategory(p.category);
          return (
            <Marker
              key={p.id}
              position={[p.lat, p.lng]}
              icon={categoryPin(p.category, { selected: selectedId === p.id, urgent: c.isUrgent })}
              zIndexOffset={selectedId === p.id ? 900 : c.isUrgent ? 500 : 0}
              eventHandlers={{
                click: (e) => {
                  L.DomEvent.stopPropagation(e.originalEvent);
                  onSelect(p);
                },
              }}
            />
          );
        }
        const lat = items.reduce((s, p) => s + p.lat, 0) / items.length;
        const lng = items.reduce((s, p) => s + p.lng, 0) / items.length;
        const urgent = items.find((p) => getCategory(p.category).isUrgent);
        const color = urgent ? getCategory(urgent.category).color : '#2549ea';
        return (
          <Marker
            key={key}
            position={[lat, lng]}
            icon={clusterPin(items.length, color)}
            eventHandlers={{
              click: (e) => {
                L.DomEvent.stopPropagation(e.originalEvent);
                map.flyToBounds(L.latLngBounds(items.map((p) => [p.lat, p.lng] as [number, number])).pad(0.4), { duration: 0.6, maxZoom: 18 });
              },
            }}
          />
        );
      })}
    </>
  );
}

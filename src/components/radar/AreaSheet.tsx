import { useEffect, useState } from 'react';
import { Bookmark, Crosshair, Eye, Loader2, MapPin, Search } from 'lucide-react';
import { Sheet } from '@/components/ui';
import { useRadar } from '@/lib/location-context';
import { useAuth } from '@/lib/auth';
import { useDebounced } from '@/lib/hooks';
import { searchPlaces, type PlaceResult } from '@/services/maps';
import { cn } from '@/lib/format';

export function AreaSheet({ open, onClose }: { open: boolean; onClose(): void }) {
  const radar = useRadar();
  const { profile } = useAuth();
  const [q, setQ] = useState('');
  const dq = useDebounced(q, 450);
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    let alive = true;
    if (dq.trim().length < 3) {
      setResults([]);
      return;
    }
    setSearching(true);
    searchPlaces(dq).then((r) => {
      if (!alive) return;
      setResults(r);
      setSearching(false);
    });
    return () => {
      alive = false;
    };
  }, [dq]);

  const pick = (fn: () => void) => {
    fn();
    onClose();
  };

  const isGps = radar.area.kind === 'gps';

  return (
    <Sheet open={open} onClose={onClose} title="Choose your radar area" description="See what’s happening around you, or peek at another neighbourhood.">
      <button
        onClick={() => pick(radar.selectGps)}
        className={cn('flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition', isGps ? 'border-primary-500 bg-primary-600/5' : 'border-line hover:bg-surface-2')}
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-600 text-white">
          {radar.gpsStatus === 'locating' ? <Loader2 className="h-5 w-5 animate-spin" /> : <Crosshair className="h-5 w-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ink">Current location</p>
          <p className="truncate text-xs text-ink-3">
            {radar.gpsStatus === 'granted'
              ? radar.areaLabel && isGps
                ? radar.areaLabel
                : 'Using GPS'
              : radar.gpsStatus === 'denied'
                ? radar.gpsError ?? 'Location blocked — enable it in browser settings'
                : 'Tap to allow location access'}
          </p>
        </div>
      </button>

      <div className="relative mt-4">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
        <input className="input pl-10" placeholder="Search a neighbourhood, e.g. Gulberg III" value={q} onChange={(e) => setQ(e.target.value)} />
        {searching && <Loader2 className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-ink-3" />}
      </div>
      {results.length > 0 && (
        <ul className="mt-2 divide-y divide-line overflow-hidden rounded-2xl border border-line">
          {results.map((r) => (
            <li key={`${r.lat},${r.lng}`}>
              <button
                onClick={() => pick(() => radar.selectArea({ lat: r.lat, lng: r.lng }, { kind: 'custom', label: r.label }))}
                className="flex w-full items-start gap-3 px-3.5 py-3 text-left hover:bg-surface-2"
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{r.label}</p>
                  <p className="truncate text-xs text-ink-3">{r.detail}</p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {!!profile?.saved_locations?.length && (
        <Group title="Saved places">
          {profile.saved_locations.map((s) => (
            <AreaRow
              key={s.label}
              icon={Bookmark}
              label={s.label}
              active={radar.area.kind === 'saved' && radar.area.label === s.label}
              onClick={() => pick(() => radar.selectArea({ lat: s.lat, lng: s.lng }, { kind: 'saved', label: s.label }))}
            />
          ))}
        </Group>
      )}

      {!!profile?.watched_areas?.length && (
        <Group title="Watched areas">
          {profile.watched_areas.map((w) => (
            <AreaRow
              key={w.id}
              icon={Eye}
              label={w.name}
              detail={`${w.city} · ${w.radius_km} km`}
              active={radar.area.kind === 'watched' && radar.area.id === w.id}
              onClick={() => pick(() => radar.selectArea({ lat: w.lat, lng: w.lng }, { kind: 'watched', id: w.id, label: w.name }))}
            />
          ))}
        </Group>
      )}
    </Sheet>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <p className="eyebrow mb-2">{title}</p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function AreaRow({ icon: Icon, label, detail, active, onClick }: { icon: typeof MapPin; label: string; detail?: string; active: boolean; onClick(): void }) {
  return (
    <button
      onClick={onClick}
      className={cn('flex w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left', active ? 'border-primary-500 bg-primary-600/5' : 'border-line hover:bg-surface-2')}
    >
      <Icon className="h-4 w-4 text-ink-3" />
      <span className="flex-1 text-sm font-semibold text-ink">{label}</span>
      {detail && <span className="text-xs text-ink-3">{detail}</span>}
    </button>
  );
}

export function RadiusSheet({ open, onClose, countFor }: { open: boolean; onClose(): void; countFor?(km: number): number }) {
  const { radiusKm, setRadiusKm } = useRadar();
  const [v, setV] = useState(radiusKm);
  useEffect(() => {
    if (open) setV(radiusKm);
  }, [open, radiusKm]);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Radar radius"
      description="How far should your radar scan? Smaller is more hyperlocal."
      size="sm"
      footer={
        <button
          className="btn-primary w-full"
          onClick={() => {
            setRadiusKm(v);
            onClose();
          }}
        >
          Scan {v} km{countFor ? ` · ${countFor(v)} posts` : ''}
        </button>
      }
    >
      <div className="py-4">
        <div className="mb-6 text-center">
          <span className="text-5xl font-extrabold tracking-tight text-ink">{v}</span>
          <span className="ml-1 text-lg font-semibold text-ink-3">km</span>
        </div>
        <input
          type="range"
          min={1}
          max={5}
          step={1}
          value={v}
          onChange={(e) => setV(Number(e.target.value))}
          aria-label="Radius in kilometres"
          className="w-full accent-primary-600"
        />
        <div className="mt-2 grid grid-cols-5 text-center text-xs font-semibold text-ink-3">
          {[1, 2, 3, 4, 5].map((k) => (
            <button key={k} onClick={() => setV(k)} className={cn('py-1', k === v && 'text-primary-600')}>
              {k} km
              {countFor && <span className="block text-[10px] font-medium text-ink-3">{countFor(k)}</span>}
            </button>
          ))}
        </div>
      </div>
    </Sheet>
  );
}

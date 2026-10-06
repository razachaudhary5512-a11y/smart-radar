import { useEffect, useMemo, useState } from 'react';
import { Building2, Check, ChevronLeft, Globe2, Loader2, MapPin, Search } from 'lucide-react';
import { COUNTRIES, MAX_RADIUS_KM, MIN_RADIUS_KM, RADIUS_PRESETS, findCountry, type City, type Country } from '@/lib/places';
import { useDebounced } from '@/lib/hooks';
import { searchPlaces, type PlaceResult } from '@/services/maps';
import { cn } from '@/lib/format';

// ── Radius ──────────────────────────────────────────────────────────────────

/** Radius picker: 1–50 km slider with quick presets. */
export function RadiusPicker({ value, onChange, countFor, compact }: { value: number; onChange(km: number): void; countFor?(km: number): number; compact?: boolean }) {
  const pct = ((value - MIN_RADIUS_KM) / (MAX_RADIUS_KM - MIN_RADIUS_KM)) * 100;
  return (
    <div>
      {!compact && (
        <div className="mb-5 text-center">
          <span className="text-5xl font-extrabold tracking-tight text-ink">{value}</span>
          <span className="ml-1 text-lg font-semibold text-ink-3">km</span>
          {countFor && <p className="mt-1 text-sm text-ink-2">{countFor(value)} posts in range</p>}
        </div>
      )}
      <div className="flex items-center gap-3">
        <span className="w-9 text-right text-xs font-semibold text-ink-3">{MIN_RADIUS_KM} km</span>
        <input
          type="range"
          min={MIN_RADIUS_KM}
          max={MAX_RADIUS_KM}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label="Radius in kilometres"
          aria-valuetext={`${value} kilometres`}
          className="h-2 flex-1 cursor-pointer appearance-none rounded-full accent-primary-600"
          style={{ background: `linear-gradient(to right, #2549ea ${pct}%, rgb(var(--line)) ${pct}%)` }}
        />
        <span className="w-11 text-xs font-semibold text-ink-3">{MAX_RADIUS_KM} km</span>
      </div>
      <div className="mt-3 flex flex-wrap justify-center gap-1.5">
        {RADIUS_PRESETS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => onChange(k)}
            className={cn(
              'h-8 min-w-[3.25rem] rounded-full border px-3 text-xs font-bold transition',
              k === value ? 'border-primary-600 bg-primary-600 text-white' : 'border-line bg-surface text-ink-2 hover:border-ink-3'
            )}
          >
            {k} km
          </button>
        ))}
      </div>
      {compact && <p className="mt-2 text-center text-sm font-bold text-ink">{value} km selected</p>}
    </div>
  );
}

/** Compact dropdown for tight spaces (filters, settings rows). */
export const RADIUS_OPTIONS = [1, 2, 3, 5, 10, 15, 20, 25, 30, 40, 50];

export function RadiusSelect({ value, onChange, className }: { value: number; onChange(km: number): void; className?: string }) {
  const options = RADIUS_OPTIONS.includes(value) ? RADIUS_OPTIONS : [...RADIUS_OPTIONS, value].sort((a, b) => a - b);
  return (
    <select className={cn('input h-9 w-auto py-0 pl-3 text-[13px] font-semibold', className)} value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label="Radius">
      {options.map((k) => (
        <option key={k} value={k}>
          {k} km
        </option>
      ))}
    </select>
  );
}

// ── Country & city ──────────────────────────────────────────────────────────

export interface PickedPlace {
  label: string;
  city: string;
  country: string;
  countryCode: string;
  lat: number;
  lng: number;
}

/**
 * Two-step picker: choose a country, then a city (popular list + search for
 * any town in that country via OpenStreetMap).
 */
export function CityPicker({ initialCountry = 'pk', selected, onPick }: { initialCountry?: string; selected?: string; onPick(p: PickedPlace): void }) {
  const [country, setCountry] = useState<Country | null>(() => findCountry(initialCountry) ?? null);
  const [otherCountry, setOtherCountry] = useState(false);
  const [q, setQ] = useState('');
  const dq = useDebounced(q, 450);
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);

  // Search any place: inside the chosen country, or worldwide for "Other country".
  useEffect(() => {
    let alive = true;
    if (dq.trim().length < 3) {
      setResults([]);
      return;
    }
    setSearching(true);
    searchPlaces(dq, otherCountry ? null : country?.code ?? null).then((r) => {
      if (!alive) return;
      setResults(r);
      setSearching(false);
    });
    return () => {
      alive = false;
    };
  }, [dq, country?.code, otherCountry]);

  const cities = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (country?.cities ?? []).filter((c) => !term || c.name.toLowerCase().includes(term) || c.region?.toLowerCase().includes(term));
  }, [country, q]);

  const pickCity = (c: City) =>
    country && onPick({ label: `${c.name}, ${country.name}`, city: c.name, country: country.name, countryCode: country.code, lat: c.lat, lng: c.lng });

  const pickResult = (r: PlaceResult) => {
    const parts = r.detail.split(',').map((s) => s.trim()).filter(Boolean);
    const countryName = otherCountry ? parts[parts.length - 1] ?? '' : country?.name ?? '';
    onPick({ label: [r.label, countryName].filter(Boolean).join(', '), city: r.label, country: countryName, countryCode: otherCountry ? '' : country?.code ?? '', lat: r.lat, lng: r.lng });
  };

  // Step 1 — country
  if (!country && !otherCountry) {
    return (
      <div>
        <p className="eyebrow mb-2 flex items-center gap-1.5">
          <Globe2 className="h-3.5 w-3.5" /> Choose a country
        </p>
        <div className="grid grid-cols-2 gap-2">
          {COUNTRIES.map((c) => (
            <button
              key={c.code}
              type="button"
              onClick={() => {
                setCountry(c);
                setQ('');
              }}
              className="flex items-center gap-2.5 rounded-xl border border-line bg-surface px-3 py-2.5 text-left text-sm font-semibold text-ink transition hover:border-primary-500"
            >
              <span className="text-lg leading-none">{c.flag}</span>
              <span className="min-w-0 flex-1 truncate">{c.name}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setOtherCountry(true);
              setQ('');
            }}
            className="flex items-center gap-2.5 rounded-xl border border-dashed border-line px-3 py-2.5 text-left text-sm font-semibold text-ink-2 transition hover:border-primary-500"
          >
            <Globe2 className="h-4 w-4" /> Other country…
          </button>
        </div>
      </div>
    );
  }

  // Step 2 — city
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setCountry(null);
            setOtherCountry(false);
            setQ('');
          }}
          className="btn-ghost btn-sm -ml-2 px-2"
        >
          <ChevronLeft className="h-4 w-4" /> Countries
        </button>
        <span className="ml-auto flex items-center gap-1.5 text-sm font-bold text-ink">
          {country ? (
            <>
              <span className="text-lg leading-none">{country.flag}</span> {country.name}
            </>
          ) : (
            <>
              <Globe2 className="h-4 w-4" /> Anywhere in the world
            </>
          )}
        </span>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
        <input
          className="input pl-10"
          placeholder={country ? `Search a city or area in ${country.name}…` : 'Search a city, e.g. Berlin'}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {searching && <Loader2 className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-ink-3" />}
      </div>

      {cities.length > 0 && (
        <>
          <p className="eyebrow mb-2 mt-4 flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5" /> {q ? 'Matching cities' : 'Popular cities'}
          </p>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {cities.map((c) => {
              const on = selected === `${c.name}, ${country?.name}`;
              return (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => pickCity(c)}
                  className={cn(
                    'flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition',
                    on ? 'border-primary-500 bg-primary-600/5' : 'border-line hover:border-ink-3/50'
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">{c.name}</span>
                    {c.region && <span className="block truncate text-[11px] text-ink-3">{c.region}</span>}
                  </span>
                  {on && <Check className="h-4 w-4 shrink-0 text-primary-600" />}
                </button>
              );
            })}
          </div>
        </>
      )}

      {results.length > 0 && (
        <>
          <p className="eyebrow mb-2 mt-4 flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" /> Places found
          </p>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
            {results.map((r) => (
              <li key={`${r.lat},${r.lng}`}>
                <button type="button" onClick={() => pickResult(r)} className="flex w-full items-start gap-3 px-3.5 py-2.5 text-left hover:bg-surface-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink">{r.label}</span>
                    <span className="block truncate text-xs text-ink-3">{r.detail}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {q.trim().length >= 3 && !searching && !results.length && !cities.length && (
        <p className="mt-4 text-center text-sm text-ink-3">No places found. Try a different spelling.</p>
      )}
    </div>
  );
}

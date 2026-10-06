import { useEffect, useState } from 'react';
import { Bookmark, Building2, Crosshair, Eye, Loader2, MapPin, Radar } from 'lucide-react';
import { Segmented, Sheet } from '@/components/ui';
import { useRadar } from '@/lib/location-context';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/format';
import { CityPicker, RadiusPicker } from './Pickers';

/** Choose where the radar points (GPS, a city/country, saved places) and how far it scans. */
export function AreaSheet({ open, onClose }: { open: boolean; onClose(): void }) {
  const radar = useRadar();
  const { profile } = useAuth();
  const [tab, setTab] = useState<'area' | 'radius'>('area');
  const [radius, setRadius] = useState(radar.radiusKm);

  useEffect(() => {
    if (open) {
      setTab('area');
      setRadius(radar.radiusKm);
    }
  }, [open, radar.radiusKm]);

  const pick = (fn: () => void) => {
    fn();
    onClose();
  };

  const isGps = radar.area.kind === 'gps';

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Your radar"
      description="Pick a city or country and how far to scan — from 1 km to 50 km."
      footer={
        tab === 'radius' ? (
          <button
            className="btn-primary w-full"
            onClick={() => {
              radar.setRadiusKm(radius);
              onClose();
            }}
          >
            Scan {radius} km around {radar.areaLabel}
          </button>
        ) : undefined
      }
    >
      <Segmented
        className="mb-4 flex w-full"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'area', label: 'City / country', icon: Building2 },
          { value: 'radius', label: `Radius · ${radar.radiusKm} km`, icon: Radar },
        ]}
      />

      {tab === 'radius' ? (
        <div className="py-2">
          <RadiusPicker value={radius} onChange={setRadius} />
          <p className="mt-4 text-center text-xs text-ink-3">1–5 km for your neighbourhood · 10–25 km for your city · 50 km for the wider region</p>
        </div>
      ) : (
        <>
          <button
            onClick={() => pick(radar.selectGps)}
            className={cn('flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition', isGps ? 'border-primary-500 bg-primary-600/5' : 'border-line hover:bg-surface-2')}
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-600 text-white">
              {radar.gpsStatus === 'locating' ? <Loader2 className="h-5 w-5 animate-spin" /> : <Crosshair className="h-5 w-5" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-ink">Use my current location</p>
              <p className="truncate text-xs text-ink-3">
                {radar.gpsStatus === 'granted'
                  ? isGps
                    ? radar.areaLabel
                    : 'GPS available'
                  : radar.gpsStatus === 'denied'
                    ? radar.gpsError ?? 'Location blocked — enable it in settings'
                    : 'Tap to allow location access'}
              </p>
            </div>
          </button>

          {!isGps && (
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-surface-2 px-3.5 py-2.5 text-sm">
              <MapPin className="h-4 w-4 text-primary-600" />
              <span className="text-ink-2">Showing:</span>
              <span className="truncate font-semibold text-ink">{radar.areaLabel}</span>
            </div>
          )}

          <div className="mt-5">
            <CityPicker
              initialCountry={radar.area.kind === 'city' ? radar.area.countryCode : undefined}
              selected={radar.area.kind === 'city' ? radar.area.label : undefined}
              onPick={(p) =>
                pick(() =>
                  radar.selectArea(
                    { lat: p.lat, lng: p.lng },
                    { kind: 'city', label: p.label, city: p.city, country: p.country, countryCode: p.countryCode }
                  )
                )
              }
            />
          </div>

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
        </>
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
      description="How far should your radar scan? 1 km is your street, 50 km covers a whole city region."
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
        <RadiusPicker value={v} onChange={setV} countFor={countFor} />
      </div>
    </Sheet>
  );
}

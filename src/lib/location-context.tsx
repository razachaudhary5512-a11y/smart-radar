import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DEFAULT_COORDS, getBrowserLocation } from './location';
import { useAuth } from './auth';
import { useAppSettings } from './settings';
import { reverseGeocode } from '@/services/maps';
import { clampRadius } from './places';
import type { Coords } from './types';

/** Where the radar is currently centred. */
export type AreaSource =
  | { kind: 'gps' }
  | { kind: 'saved'; label: string }
  | { kind: 'watched'; id: string; label: string }
  | { kind: 'custom'; label: string; countryCode?: string }
  | { kind: 'city'; label: string; city: string; country: string; countryCode: string };

interface LocationContextValue {
  /** Centre of the radar (GPS or a chosen area). */
  coords: Coords;
  /** The device's own position (if known). */
  gpsCoords: Coords | null;
  gpsStatus: 'idle' | 'locating' | 'granted' | 'denied';
  gpsError: string | null;
  areaLabel: string;
  area: AreaSource;
  radiusKm: number;
  setRadiusKm(km: number): void;
  /** Country used to scope place search (ISO code, e.g. "pk"). */
  countryCode: string;
  requestLocation(): Promise<void>;
  selectArea(coords: Coords, area: AreaSource): void;
  selectGps(): void;
}

const LocationContext = createContext<LocationContextValue | undefined>(undefined);
const RADIUS_KEY = 'sr_radius_km';
const LAST_KEY = 'sr_last_coords';
const AREA_KEY = 'sr_area_v1';

type StoredArea = { area: Exclude<AreaSource, { kind: 'gps' }>; coords: Coords };

function readArea(): StoredArea | null {
  try {
    const raw = localStorage.getItem(AREA_KEY);
    return raw ? (JSON.parse(raw) as StoredArea) : null;
  } catch {
    return null;
  }
}

function writeArea(v: StoredArea | null) {
  try {
    if (v) localStorage.setItem(AREA_KEY, JSON.stringify(v));
    else localStorage.removeItem(AREA_KEY);
  } catch {
    /* ignore */
  }
}

function readNumber(key: string, fallback: number) {
  try {
    const n = Number(localStorage.getItem(key));
    return Number.isFinite(n) && n > 0 ? n : fallback;
  } catch {
    return fallback;
  }
}

function readLast(): Coords | null {
  try {
    const raw = localStorage.getItem(LAST_KEY);
    return raw ? (JSON.parse(raw) as Coords) : null;
  } catch {
    return null;
  }
}

export function LocationProvider({ children }: { children: ReactNode }) {
  const { profile, updateProfile } = useAuth();
  const [gpsCoords, setGpsCoords] = useState<Coords | null>(readLast);
  const [gpsStatus, setGpsStatus] = useState<LocationContextValue['gpsStatus']>('idle');
  const [gpsError, setGpsError] = useState<string | null>(null);
  // The chosen city/area is remembered between visits.
  const [area, setArea] = useState<AreaSource>(() => readArea()?.area ?? { kind: 'gps' });
  const [areaCoords, setAreaCoords] = useState<Coords | null>(() => readArea()?.coords ?? null);
  const [gpsLabel, setGpsLabel] = useState<string>('');
  const [radius, setRadius] = useState(() => clampRadius(readNumber(RADIUS_KEY, 3)));
  const [hasOwnRadius] = useState(() => {
    try {
      return localStorage.getItem(RADIUS_KEY) !== null;
    } catch {
      return false;
    }
  });
  const { default_radius_km } = useAppSettings();

  useEffect(() => {
    if (profile?.radius_km) setRadius(clampRadius(profile.radius_km));
    // New visitors start with the owner's default radius.
    else if (!hasOwnRadius) setRadius(clampRadius(default_radius_km));
  }, [profile?.radius_km, hasOwnRadius, default_radius_km]);

  const requestLocation = useCallback(async () => {
    setGpsStatus('locating');
    const res = await getBrowserLocation();
    if (res.granted) {
      setGpsCoords(res.coords);
      setGpsStatus('granted');
      setGpsError(null);
      try {
        localStorage.setItem(LAST_KEY, JSON.stringify(res.coords));
      } catch {
        /* ignore */
      }
    } else {
      setGpsStatus('denied');
      setGpsError(res.reason);
    }
  }, []);

  // Ask for location on start only if the browser already granted it (no surprise prompt).
  useEffect(() => {
    const perms = (navigator as Navigator & { permissions?: Permissions }).permissions;
    if (!perms?.query) return;
    perms
      .query({ name: 'geolocation' as PermissionName })
      .then((s) => {
        if (s.state === 'granted') requestLocation();
        else if (s.state === 'denied') setGpsStatus('denied');
      })
      .catch(() => {});
  }, [requestLocation]);

  const center = area.kind === 'gps' ? gpsCoords ?? DEFAULT_COORDS : areaCoords ?? gpsCoords ?? DEFAULT_COORDS;

  // Friendly neighbourhood name for the GPS position.
  useEffect(() => {
    if (!gpsCoords) return;
    let alive = true;
    reverseGeocode(gpsCoords).then((r) => alive && r && setGpsLabel(r.label));
    return () => {
      alive = false;
    };
  }, [gpsCoords]);

  const setRadiusKm = useCallback(
    (km: number) => {
      const v = clampRadius(km);
      setRadius(v);
      try {
        localStorage.setItem(RADIUS_KEY, String(v));
      } catch {
        /* ignore */
      }
      if (profile) updateProfile({ radius_km: v }).catch(() => {});
    },
    [profile, updateProfile]
  );

  const value = useMemo<LocationContextValue>(() => {
    const areaLabel =
      area.kind === 'gps'
        ? gpsCoords
          ? gpsLabel || 'Your location'
          : 'Karachi (default)'
        : area.label;
    const countryCode = area.kind === 'city' ? area.countryCode : area.kind === 'custom' && area.countryCode ? area.countryCode : 'pk';
    return {
      coords: center,
      gpsCoords,
      gpsStatus,
      gpsError,
      areaLabel,
      area,
      radiusKm: radius,
      setRadiusKm,
      countryCode,
      requestLocation,
      selectArea: (c, a) => {
        setAreaCoords(c);
        setArea(a);
        if (a.kind !== 'gps') writeArea({ area: a, coords: c });
      },
      selectGps: () => {
        setArea({ kind: 'gps' });
        setAreaCoords(null);
        writeArea(null);
        if (!gpsCoords) requestLocation();
      },
    };
  }, [center, gpsCoords, gpsStatus, gpsError, gpsLabel, area, radius, setRadiusKm, requestLocation]);

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

/** Radar centre, radius and GPS state. (Named to avoid clashing with react-router's useLocation.) */
export function useRadar() {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useRadar must be used within LocationProvider');
  return ctx;
}

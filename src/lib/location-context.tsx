import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
  /**
   * True once we know where to centre the radar: the device's current location, or an
   * area the user picked. Screens that show nearby content wait for this (see LocationGate).
   */
  located: boolean;
  /** Centre of the radar (GPS or a chosen area). Only meaningful when `located`. */
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
// Last area the user picked by hand. Used only as a fallback when GPS is unavailable;
// every visit starts from the device's current location.
const AREA_KEY = 'sr_area_v1';
// The area picked during this visit (cleared when the app/browser tab is closed).
const SESSION_AREA_KEY = 'sr_area_session';

type StoredArea = { area: Exclude<AreaSource, { kind: 'gps' }>; coords: Coords };

function readArea(storage: Storage = localStorage, key = AREA_KEY): StoredArea | null {
  try {
    const raw = storage.getItem(key);
    return raw ? (JSON.parse(raw) as StoredArea) : null;
  } catch {
    return null;
  }
}

function writeArea(v: StoredArea | null) {
  try {
    if (v) {
      sessionStorage.setItem(SESSION_AREA_KEY, JSON.stringify(v));
      localStorage.setItem(AREA_KEY, JSON.stringify(v));
    } else {
      sessionStorage.removeItem(SESSION_AREA_KEY);
    }
  } catch {
    /* ignore */
  }
}

const readSessionArea = () => {
  try {
    return readArea(sessionStorage, SESSION_AREA_KEY);
  } catch {
    return null;
  }
};

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
  // Each visit starts on the device's current location; a picked area lasts for this visit only.
  const [area, setArea] = useState<AreaSource>(() => readSessionArea()?.area ?? { kind: 'gps' });
  const [areaCoords, setAreaCoords] = useState<Coords | null>(() => readSessionArea()?.coords ?? null);
  const [gpsLabel, setGpsLabel] = useState<string>('');
  const [radius, setRadius] = useState(() => clampRadius(readNumber(RADIUS_KEY, 3)));
  // Read live (not once at start-up): onboarding saves the choice after the app has mounted.
  const hasOwnRadius = () => {
    try {
      return localStorage.getItem(RADIUS_KEY) !== null;
    } catch {
      return false;
    }
  };
  const { default_radius_km } = useAppSettings();

  // Signed in: follow the account's radius. Exception: a brand-new account keeps the
  // radius picked on this device (e.g. during onboarding) instead of the server default.
  const adoptedFor = useRef<string | null>(null);
  const profileId = profile?.id;
  const profileRadius = profile?.radius_km;
  const profileCreated = profile?.created_at;
  useEffect(() => {
    if (!profileId) {
      // New visitors start with the owner's default radius.
      if (!hasOwnRadius()) setRadius(clampRadius(default_radius_km));
      return;
    }
    if (adoptedFor.current !== profileId) {
      adoptedFor.current = profileId;
      const isNewAccount = profileCreated ? Date.now() - new Date(profileCreated).getTime() < 10 * 60 * 1000 : false;
      const local = hasOwnRadius() ? clampRadius(readNumber(RADIUS_KEY, profileRadius ?? 3)) : null;
      if (isNewAccount && local !== null && local !== profileRadius) {
        setRadius(local);
        updateProfile({ radius_km: local }).catch(() => {});
        return;
      }
    }
    if (profileRadius) setRadius(clampRadius(profileRadius));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hasOwnRadius reads storage directly
  }, [profileId, profileRadius, profileCreated, default_radius_km, updateProfile]);

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

  // Get the device's current location every time the app opens (asks permission if needed).
  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  // GPS unavailable/denied → the last area the user picked themselves, if any. Never a built-in city.
  const fallback = useMemo(() => (area.kind === 'gps' && !gpsCoords && gpsStatus === 'denied' ? readArea() : null), [area.kind, gpsCoords, gpsStatus]);
  const center: Coords | null = area.kind === 'gps' ? gpsCoords ?? fallback?.coords ?? null : areaCoords ?? gpsCoords;

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
          : fallback
            ? fallback.area.label
            : gpsStatus === 'denied'
              ? 'Location is off'
              : 'Finding your location…'
        : area.label;
    const countryCode = area.kind === 'city' ? area.countryCode : area.kind === 'custom' && area.countryCode ? area.countryCode : 'pk';
    return {
      located: center !== null,
      // Placeholder only while not located — screens wait for `located` before using it.
      coords: center ?? DEFAULT_COORDS,
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
  }, [center, fallback, gpsCoords, gpsStatus, gpsError, gpsLabel, area, radius, setRadiusKm, requestLocation]);

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

/** Radar centre, radius and GPS state. (Named to avoid clashing with react-router's useLocation.) */
export function useRadar() {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useRadar must be used within LocationProvider');
  return ctx;
}

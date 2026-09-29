import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Coords } from './location';
import { getBrowserLocation } from './location';
import { useAuth } from './auth';

const DEFAULT_COORDS: Coords = { lat: 24.8607, lng: 67.0011 };

interface LocationContextValue {
  coords: Coords;
  radiusKm: number;
  setRadiusKm: (km: number) => void;
  requestLocation: () => Promise<void>;
  locationGranted: boolean;
  setCustomCoords: (coords: Coords) => void;
}

const LocationContext = createContext<LocationContextValue | undefined>(undefined);

export function LocationProvider({ children }: { children: ReactNode }) {
  const { profile, updateProfile } = useAuth();
  const [coords, setCoords] = useState<Coords>(DEFAULT_COORDS);
  const [locationGranted, setLocationGranted] = useState(false);
  const [localRadius, setLocalRadius] = useState(3);

  const radiusKm = profile?.radius_km ?? localRadius;

  useEffect(() => {
    if (profile?.radius_km) {
      setLocalRadius(profile.radius_km);
    }
  }, [profile?.radius_km]);

  useEffect(() => {
    requestLocation();
  }, []);

  async function requestLocation() {
    try {
      const c = await getBrowserLocation();
      if (c) {
        setCoords(c);
        setLocationGranted(true);
      }
    } catch {
      setCoords(DEFAULT_COORDS);
    }
  }

  function setCustomCoords(newCoords: Coords) {
    setCoords(newCoords);
  }

  function setRadiusKm(km: number) {
    setLocalRadius(km);
    if (profile) updateProfile({ radius_km: km });
  }

  return (
    <LocationContext.Provider
      value={{
        coords,
        radiusKm,
        setRadiusKm,
        requestLocation,
        locationGranted,
        setCustomCoords,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useLocation must be used within LocationProvider');
  return ctx;
}

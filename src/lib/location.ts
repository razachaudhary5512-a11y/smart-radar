import type { Coords } from './types';
import { isNative, nativePosition } from './native';

export type { Coords };

/** Internal placeholder only — never shown or used to load content (see `located`). */
export const DEFAULT_COORDS: Coords = { lat: 24.8607, lng: 67.0011 };

export type GeoResult = { coords: Coords; granted: true } | { coords: Coords; granted: false; reason: string };

export async function getBrowserLocation(timeoutMs = 8000): Promise<GeoResult> {
  if (isNative) {
    const r = await nativePosition(timeoutMs);
    if ('coords' in r) return { coords: r.coords, granted: true };
    return {
      coords: DEFAULT_COORDS,
      granted: false,
      reason: r.error === 'denied' ? 'Location permission was denied. Enable it in Android Settings → Apps → Be Alert.' : 'Could not get your location.',
    };
  }
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) {
      resolve({ coords: DEFAULT_COORDS, granted: false, reason: 'Location is not supported on this device.' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ coords: { lat: pos.coords.latitude, lng: pos.coords.longitude }, granted: true }),
      (err) =>
        resolve({
          coords: DEFAULT_COORDS,
          granted: false,
          reason: err.code === err.PERMISSION_DENIED ? 'Location permission was denied.' : 'Could not get your location.',
        }),
      { timeout: timeoutMs, enableHighAccuracy: false, maximumAge: 5 * 60_000 }
    );
  });
}

export function haversineKm(a: Coords, b: Coords): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Lat/lng bounding box around a point — used to pre-filter DB queries. */
export function boundingBox(c: Coords, radiusKm: number) {
  const dLat = radiusKm / 111.32;
  const dLng = radiusKm / (111.32 * Math.cos((c.lat * Math.PI) / 180));
  return { minLat: c.lat - dLat, maxLat: c.lat + dLat, minLng: c.lng - dLng, maxLng: c.lng + dLng };
}

/** Random point within `radiusKm` of `c` (used for demo data). */
export function jitter(c: Coords, radiusKm: number, rand = Math.random): Coords {
  const r = radiusKm * Math.sqrt(rand());
  const t = rand() * 2 * Math.PI;
  return {
    lat: c.lat + (r / 111.32) * Math.cos(t),
    lng: c.lng + (r / (111.32 * Math.cos((c.lat * Math.PI) / 180))) * Math.sin(t),
  };
}

export function formatDistance(km: number | undefined): string {
  if (km === undefined || !Number.isFinite(km)) return '';
  if (km < 1) return `${Math.max(10, Math.round((km * 1000) / 10) * 10)} m`;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

export function isExpired(post: { expires_at: string | null; status: string }): boolean {
  if (post.status === 'expired') return true;
  if (!post.expires_at) return false;
  return new Date(post.expires_at).getTime() < Date.now();
}

export function googleMapsLink(c: Coords): string {
  return `https://www.google.com/maps/search/?api=1&query=${c.lat.toFixed(6)},${c.lng.toFixed(6)}`;
}

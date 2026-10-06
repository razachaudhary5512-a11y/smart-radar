/**
 * src/services/maps.ts
 * Geocoding helpers on top of OpenStreetMap Nominatim (no API key required).
 * Results are cached and requests are throttled to respect the usage policy
 * (max 1 request / second). For heavy production traffic, switch to a paid
 * geocoder or self-hosted Nominatim.
 */
import { ENV } from '@/config/env';
import type { Coords } from '@/lib/types';

export const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
export const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

export function isGoogleMapsAvailable(): boolean {
  return Boolean(ENV.googleMaps.apiKey);
}

const NOMINATIM = 'https://nominatim.openstreetmap.org';
const cache = new Map<string, unknown>();
let last = 0;

async function throttled<T>(key: string, url: string): Promise<T | null> {
  if (cache.has(key)) return cache.get(key) as T;
  const wait = Math.max(0, last + 1100 - Date.now());
  last = Date.now() + wait;
  if (wait) await new Promise((r) => setTimeout(r, wait));
  try {
    const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
    if (!res.ok) return null;
    const data = (await res.json()) as T;
    cache.set(key, data);
    return data;
  } catch {
    return null;
  }
}

interface NominatimReverse {
  address?: Record<string, string>;
  display_name?: string;
}

/** Short human label for a coordinate, e.g. "Block 5, Clifton". */
export async function reverseGeocode(c: Coords): Promise<{ label: string; city: string } | null> {
  const key = `r:${c.lat.toFixed(3)},${c.lng.toFixed(3)}`;
  const data = await throttled<NominatimReverse>(
    key,
    `${NOMINATIM}/reverse?format=jsonv2&zoom=16&lat=${c.lat}&lon=${c.lng}`
  );
  if (!data?.address) return null;
  const a = data.address;
  const area = a.neighbourhood || a.suburb || a.quarter || a.residential || a.city_district || a.road || a.village || a.town;
  const city = a.city || a.town || a.county || a.state || '';
  const label = [area, city && area !== city ? city : null].filter(Boolean).join(', ') || data.display_name?.split(',').slice(0, 2).join(',') || '';
  return label ? { label, city } : null;
}

export interface PlaceResult {
  label: string;
  detail: string;
  lat: number;
  lng: number;
}

interface NominatimSearch {
  display_name: string;
  lat: string;
  lon: string;
  name?: string;
}

/** Place search within one country (ISO code, default Pakistan); pass null to search worldwide. */
export async function searchPlaces(query: string, countryCode: string | null = 'pk'): Promise<PlaceResult[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const cc = countryCode ? `&countrycodes=${countryCode.toLowerCase()}` : '';
  const data = await throttled<NominatimSearch[]>(
    `s:${countryCode ?? '*'}:${q.toLowerCase()}`,
    `${NOMINATIM}/search?format=jsonv2&limit=6${cc}&q=${encodeURIComponent(q)}`
  );
  return (data ?? []).map((r) => {
    const parts = r.display_name.split(',').map((s) => s.trim());
    return { label: r.name || parts[0], detail: parts.slice(1, 4).join(', '), lat: Number(r.lat), lng: Number(r.lon) };
  });
}

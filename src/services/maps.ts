/**
 * src/services/maps.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Google Maps SDK wrapper.
 *
 * Currently the app uses Leaflet + OpenStreetMap (no key needed).
 * This service bridges to Google Maps if/when VITE_GOOGLE_MAPS_API_KEY is set.
 *
 * Usage:
 *   import { initGoogleMaps, isGoogleMapsAvailable } from '@/services/maps';
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { GOOGLE_MAPS_API_KEY } from '@/config/env';

/** True once the Google Maps JS API script has been injected and loaded. */
let _loaded = false;
let _loading: Promise<void> | null = null;

/**
 * Returns true if the Google Maps API key is configured.
 * The map will fall back to Leaflet/OSM when this is false.
 */
export function isGoogleMapsAvailable(): boolean {
  return !!GOOGLE_MAPS_API_KEY;
}

/**
 * Dynamically injects the Google Maps JavaScript API script.
 * Safe to call multiple times — resolves immediately if already loaded.
 *
 * @throws Error if VITE_GOOGLE_MAPS_API_KEY is not set.
 */
export function initGoogleMaps(): Promise<void> {
  if (_loaded) return Promise.resolve();
  if (_loading) return _loading;

  if (!GOOGLE_MAPS_API_KEY) {
    console.warn(
      '[Smart Radar / maps] VITE_GOOGLE_MAPS_API_KEY is not set. ' +
      'Google Maps will not be available — falling back to Leaflet/OSM.'
    );
    return Promise.resolve();
  }

  _loading = new Promise<void>((resolve, reject) => {
    const callbackName = '__smartRadarGMapsInit';

    (window as Record<string, unknown>)[callbackName] = () => {
      _loaded = true;
      _loading = null;
      delete (window as Record<string, unknown>)[callbackName];
      resolve();
    };

    const script = document.createElement('script');
    script.src =
      `https://maps.googleapis.com/maps/api/js` +
      `?key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}` +
      `&libraries=places,marker` +
      `&callback=${callbackName}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      _loading = null;
      reject(new Error('[Smart Radar / maps] Failed to load Google Maps API script.'));
    };

    document.head.appendChild(script);
  });

  return _loading;
}

// ── Pin / cluster helpers ─────────────────────────────────────────────────────

export interface MapPin {
  id: string;
  lat: number;
  lng: number;
  title: string;
  color?: string;
  /** Optional HTML content for the info-window. */
  infoHtml?: string;
}

/**
 * Renders an array of pins on an existing `google.maps.Map` instance.
 * Returns the created marker instances so the caller can clean them up.
 *
 * @throws Error if Google Maps has not been initialised yet.
 */
export function renderPins(
  map: google.maps.Map,
  pins: MapPin[]
): google.maps.marker.AdvancedMarkerElement[] {
  if (!_loaded) {
    throw new Error(
      '[Smart Radar / maps] renderPins() called before Google Maps was initialised. ' +
      'Call initGoogleMaps() and await it first.'
    );
  }

  return pins.map((pin) => {
    const el = document.createElement('div');
    el.style.cssText = `
      width: 32px; height: 32px; border-radius: 50%;
      background: ${pin.color ?? '#6366f1'};
      border: 3px solid #ffffff;
      box-shadow: 0 2px 8px rgba(0,0,0,0.35);
      display: flex; align-items: center; justify-content: center;
      cursor: pointer;
    `;

    const marker = new google.maps.marker.AdvancedMarkerElement({
      map,
      position: { lat: pin.lat, lng: pin.lng },
      title: pin.title,
      content: el,
    });

    if (pin.infoHtml) {
      const infoWindow = new google.maps.InfoWindow({ content: pin.infoHtml });
      marker.addListener('click', () => infoWindow.open({ map, anchor: marker }));
    }

    return marker;
  });
}

/**
 * Creates a Google Maps Map instance inside `container`.
 *
 * @throws Error if Google Maps has not been initialised yet.
 */
export function createMap(
  container: HTMLElement,
  options: google.maps.MapOptions = {}
): google.maps.Map {
  if (!_loaded) {
    throw new Error(
      '[Smart Radar / maps] createMap() called before Google Maps was initialised.'
    );
  }

  const defaults: google.maps.MapOptions = {
    center: { lat: 24.8607, lng: 67.0011 }, // Karachi default
    zoom: 13,
    mapId: 'smart-radar-map',
    disableDefaultUI: false,
    gestureHandling: 'cooperative',
  };

  return new google.maps.Map(container, { ...defaults, ...options });
}

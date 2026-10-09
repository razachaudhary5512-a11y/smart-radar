/**
 * src/config/validate-env.ts
 * Startup environment check — logs clear warnings, never throws.
 */
import { ENV, isSupabaseConfigured } from './env';

export function validateEnv(): void {
  const optional: [string, boolean][] = [
    ['Firebase push (VITE_FIREBASE_*)', Object.values(ENV.firebase).slice(0, 6).every(Boolean)],
    ['Google Maps (VITE_GOOGLE_MAPS_API_KEY)', Boolean(ENV.googleMaps.apiKey)],
  ];

  if (!isSupabaseConfigured) {
    console.warn(
      '%c[Be Alert] Supabase is not configured — running in demo mode with local sample data.',
      'color:#f59e0b;font-weight:bold'
    );
  }
  const off = optional.filter(([, on]) => !on).map(([name]) => name);
  if (off.length) console.info('[Be Alert] Optional integrations not configured:', off.join(', '));
  // Secret-leak detection runs at build time in vite.config.ts (reading
  // import.meta.env as a whole here would itself bundle every VITE_ value).
}

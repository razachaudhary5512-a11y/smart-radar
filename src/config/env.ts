/**
 * src/config/env.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for all environment variables.
 * The rest of the app must NEVER read `import.meta.env` directly.
 *
 * SECURITY: every `VITE_*` value is compiled into the public JavaScript bundle.
 * Only put PUBLIC values here (URLs, anon keys, feature flags). Server secrets
 * such as Twilio auth tokens or JazzCash passwords belong in Supabase Edge
 * Function secrets (`supabase secrets set ...`), never in this file.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const env = import.meta.env;

const str = (v: unknown): string | undefined => {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t.length ? t : undefined;
};

export type DataMode = 'auto' | 'demo' | 'live';

export const ENV = {
  /** 'auto' (default) uses Supabase when reachable, otherwise demo data. */
  dataMode: ((str(env.VITE_DATA_MODE) as DataMode | undefined) ?? 'auto') as DataMode,
  supabase: {
    url: str(env.VITE_SUPABASE_URL),
    anonKey: str(env.VITE_SUPABASE_ANON_KEY),
  },
  googleMaps: {
    apiKey: str(env.VITE_GOOGLE_MAPS_API_KEY),
  },
  firebase: {
    apiKey: str(env.VITE_FIREBASE_API_KEY),
    authDomain: str(env.VITE_FIREBASE_AUTH_DOMAIN),
    projectId: str(env.VITE_FIREBASE_PROJECT_ID),
    storageBucket: str(env.VITE_FIREBASE_STORAGE_BUCKET),
    messagingSenderId: str(env.VITE_FIREBASE_MESSAGING_SENDER_ID),
    appId: str(env.VITE_FIREBASE_APP_ID),
    vapidKey: str(env.VITE_FIREBASE_VAPID_KEY),
  },
  /** Cloudflare Turnstile site key (public). Set only after CAPTCHA is enabled in Supabase Auth. */
  turnstileSiteKey: str(env.VITE_TURNSTILE_SITE_KEY),
  features: {
    /** Phone (SMS) sign-in. Set VITE_ENABLE_PHONE_AUTH=false until an SMS provider is connected in Supabase. */
    phoneAuth: str(env.VITE_ENABLE_PHONE_AUTH) !== 'false',
    /** Custom SMS via the `send-sms` Edge Function (Twilio secrets live server-side). */
    customSms: str(env.VITE_ENABLE_CUSTOM_SMS) === 'true',
    /** JazzCash / EasyPaisa via the `process-payment` Edge Function. */
    payments: str(env.VITE_ENABLE_PAYMENTS) === 'true',
  },
} as const;

/** Path the app is served from: "/" normally, "/smart-radar/" on GitHub Pages. */
export const BASE_PATH = import.meta.env.BASE_URL;

/**
 * Absolute, shareable link to a page in the app. Uses VITE_PUBLIC_URL when set
 * (needed inside the Android app, whose own origin is https://localhost).
 */
export function appUrl(path = ''): string {
  const root = str(env.VITE_PUBLIC_URL) ?? `${window.location.origin}${BASE_PATH}`;
  return `${root.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}

export const isSupabaseConfigured = Boolean(
  ENV.supabase.url && ENV.supabase.anonKey && !/YOUR_PROJECT|YOUR_SUPABASE/i.test(ENV.supabase.url + ENV.supabase.anonKey)
);

export type AppEnv = typeof ENV;

/**
 * src/config/env.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for all environment variables.
 * The rest of the app should NEVER read `import.meta.env` directly —
 * always import from here instead.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Supabase ──────────────────────────────────────────────────────────────────
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// ── Google Maps ───────────────────────────────────────────────────────────────
export const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

// ── Firebase ──────────────────────────────────────────────────────────────────
export const FIREBASE_API_KEY = import.meta.env.VITE_FIREBASE_API_KEY as string | undefined;
export const FIREBASE_AUTH_DOMAIN = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined;
export const FIREBASE_PROJECT_ID = import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined;
export const FIREBASE_STORAGE_BUCKET = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined;
export const FIREBASE_MESSAGING_SENDER_ID = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined;
export const FIREBASE_APP_ID = import.meta.env.VITE_FIREBASE_APP_ID as string | undefined;

// ── Twilio (SMS/OTP) ──────────────────────────────────────────────────────────
// NOTE: Supabase's built-in phone auth is the preferred OTP method.
// These are only used if you switch to a custom Twilio flow.
export const TWILIO_ACCOUNT_SID = import.meta.env.VITE_TWILIO_ACCOUNT_SID as string | undefined;
export const TWILIO_AUTH_TOKEN = import.meta.env.VITE_TWILIO_AUTH_TOKEN as string | undefined;
export const TWILIO_PHONE_NUMBER = import.meta.env.VITE_TWILIO_PHONE_NUMBER as string | undefined;

// ── Payments — JazzCash / EasyPaisa ──────────────────────────────────────────
// Intentionally empty — payment keys are not activated yet.
export const JAZZCASH_MERCHANT_ID = import.meta.env.VITE_JAZZCASH_MERCHANT_ID as string | undefined;
export const JAZZCASH_PASSWORD = import.meta.env.VITE_JAZZCASH_PASSWORD as string | undefined;

// ── Typed config bundle ───────────────────────────────────────────────────────
/** Full typed config object — prefer this for service initialization. */
export const ENV = {
  supabase: {
    url: SUPABASE_URL,
    anonKey: SUPABASE_ANON_KEY,
  },
  googleMaps: {
    apiKey: GOOGLE_MAPS_API_KEY,
  },
  firebase: {
    apiKey: FIREBASE_API_KEY,
    authDomain: FIREBASE_AUTH_DOMAIN,
    projectId: FIREBASE_PROJECT_ID,
    storageBucket: FIREBASE_STORAGE_BUCKET,
    messagingSenderId: FIREBASE_MESSAGING_SENDER_ID,
    appId: FIREBASE_APP_ID,
  },
  twilio: {
    accountSid: TWILIO_ACCOUNT_SID,
    authToken: TWILIO_AUTH_TOKEN,
    phoneNumber: TWILIO_PHONE_NUMBER,
  },
  payments: {
    jazzCashMerchantId: JAZZCASH_MERCHANT_ID,
    jazzCashPassword: JAZZCASH_PASSWORD,
  },
} as const;

export type AppEnv = typeof ENV;

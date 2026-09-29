/**
 * src/config/validate-env.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Startup environment-variable validator.
 * Logs clear warnings for any missing keys — never throws / never crashes.
 * Import this once at the app entry-point (main.tsx).
 * ─────────────────────────────────────────────────────────────────────────────
 */

interface EnvRule {
  key: string;
  value: string | undefined;
  required: boolean;   // true = critical; false = optional / not yet activated
  service: string;
}

const rules: EnvRule[] = [
  // ── REQUIRED ──────────────────────────────────────────────────────────────
  { key: 'VITE_SUPABASE_URL',                value: import.meta.env.VITE_SUPABASE_URL,                required: true,  service: 'Supabase' },
  { key: 'VITE_SUPABASE_ANON_KEY',           value: import.meta.env.VITE_SUPABASE_ANON_KEY,           required: true,  service: 'Supabase' },

  // ── OPTIONAL / FUTURE ─────────────────────────────────────────────────────
  { key: 'VITE_GOOGLE_MAPS_API_KEY',         value: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,         required: false, service: 'Google Maps' },
  { key: 'VITE_FIREBASE_API_KEY',            value: import.meta.env.VITE_FIREBASE_API_KEY,            required: false, service: 'Firebase' },
  { key: 'VITE_FIREBASE_AUTH_DOMAIN',        value: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,        required: false, service: 'Firebase' },
  { key: 'VITE_FIREBASE_PROJECT_ID',         value: import.meta.env.VITE_FIREBASE_PROJECT_ID,         required: false, service: 'Firebase' },
  { key: 'VITE_FIREBASE_STORAGE_BUCKET',     value: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,     required: false, service: 'Firebase' },
  { key: 'VITE_FIREBASE_MESSAGING_SENDER_ID',value: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,required: false, service: 'Firebase' },
  { key: 'VITE_FIREBASE_APP_ID',             value: import.meta.env.VITE_FIREBASE_APP_ID,             required: false, service: 'Firebase' },
  { key: 'VITE_TWILIO_ACCOUNT_SID',          value: import.meta.env.VITE_TWILIO_ACCOUNT_SID,          required: false, service: 'Twilio SMS' },
  { key: 'VITE_TWILIO_AUTH_TOKEN',           value: import.meta.env.VITE_TWILIO_AUTH_TOKEN,           required: false, service: 'Twilio SMS' },
  { key: 'VITE_TWILIO_PHONE_NUMBER',         value: import.meta.env.VITE_TWILIO_PHONE_NUMBER,         required: false, service: 'Twilio SMS' },
  { key: 'VITE_JAZZCASH_MERCHANT_ID',        value: import.meta.env.VITE_JAZZCASH_MERCHANT_ID,        required: false, service: 'Payments (JazzCash)' },
  { key: 'VITE_JAZZCASH_PASSWORD',           value: import.meta.env.VITE_JAZZCASH_PASSWORD,           required: false, service: 'Payments (JazzCash)' },
];

export function validateEnv(): void {
  const missing = rules.filter(r => !r.value || r.value.trim() === '');

  if (missing.length === 0) {
    console.info('%c[Smart Radar] ✅ All environment variables are set.', 'color: #22c55e; font-weight: bold;');
    return;
  }

  // Group by service
  const grouped: Record<string, { key: string; required: boolean }[]> = {};
  for (const m of missing) {
    if (!grouped[m.service]) grouped[m.service] = [];
    grouped[m.service].push({ key: m.key, required: m.required });
  }

  const criticalMissing = missing.filter(r => r.required);
  const optionalMissing = missing.filter(r => !r.required);

  if (criticalMissing.length > 0) {
    console.error(
      '%c[Smart Radar] 🚨 CRITICAL: Missing required environment variables — the app may not work correctly:',
      'color: #ef4444; font-weight: bold; font-size: 13px;'
    );
    for (const { key, service } of criticalMissing) {
      console.error(`  ❌  ${key}  (${service})`);
    }
    console.error('  → Add these to your .env file and restart the dev server.');
  }

  if (optionalMissing.length > 0) {
    console.warn(
      '%c[Smart Radar] ⚠️  Some optional integrations are not configured yet:',
      'color: #f59e0b; font-weight: bold; font-size: 12px;'
    );
    for (const [service, vars] of Object.entries(grouped)) {
      const optVars = vars.filter(v => !v.required);
      if (optVars.length === 0) continue;
      console.warn(`  ⬜  ${service}:`);
      for (const { key } of optVars) {
        console.warn(`       ${key}`);
      }
    }
    console.warn('  → These features will be disabled until keys are added to .env.');
  }
}

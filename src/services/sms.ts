/**
 * src/services/sms.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * OTP sign-in lives in the data layer (src/data/*) — Supabase phone auth in
 * live mode, a local simulator in demo mode.
 *
 * This file covers CUSTOM SMS (branded alerts, e.g. blood requests to trusted
 * contacts). It calls the `send-sms` Supabase Edge Function, which holds the
 * Twilio credentials server-side:
 *
 *   supabase secrets set TWILIO_ACCOUNT_SID=... TWILIO_AUTH_TOKEN=... TWILIO_PHONE_NUMBER=...
 *   supabase functions deploy send-sms
 *
 * then set VITE_ENABLE_CUSTOM_SMS=true. Twilio secrets must never be VITE_ vars.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { ENV } from '@/config/env';
import { getSupabase } from '@/lib/supabase';

export function isCustomSmsEnabled(): boolean {
  return ENV.features.customSms && Boolean(getSupabase());
}

export async function sendCustomSms(to: string, message: string): Promise<{ success: boolean; error: string | null }> {
  const supabase = getSupabase();
  if (!isCustomSmsEnabled() || !supabase) {
    return { success: false, error: 'Custom SMS is not enabled.' };
  }
  const { error } = await supabase.functions.invoke('send-sms', { body: { to, message } });
  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}

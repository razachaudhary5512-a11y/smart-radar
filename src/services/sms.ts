/**
 * src/services/sms.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * SMS / OTP service — consistent import path for the rest of the app.
 *
 * STRATEGY:
 *  • Supabase's built-in phone auth is the PRIMARY OTP method.
 *    It is always available if VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
 *    are set — no extra credentials needed.
 *
 *  • Twilio is the FALLBACK for custom SMS flows (e.g., branded messages,
 *    non-OTP campaigns) and only activates when the VITE_TWILIO_* keys are set.
 *    NOTE: Twilio secrets must NEVER be called directly from the browser.
 *    The functions below call YOUR backend / Supabase Edge Function, which
 *    holds the real credentials server-side.
 *
 * Usage:
 *   import { sendOtp, verifyOtp, isTwilioConfigured } from '@/services/sms';
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { supabase } from '@/lib/supabase';
import { ENV } from '@/config/env';

// ── Supabase phone-auth re-exports (primary path) ─────────────────────────────

/**
 * Send an OTP to a phone number using Supabase's built-in phone auth.
 * @param phone  E.164 format, e.g. "+923001234567"
 */
export async function sendOtp(phone: string): Promise<{ error: Error | null }> {
  const { error } = await supabase.auth.signInWithOtp({ phone });
  return { error: error as Error | null };
}

/**
 * Verify the OTP that was sent via sendOtp().
 * @param phone  E.164 format, e.g. "+923001234567"
 * @param token  6-digit OTP received by the user
 */
export async function verifyOtp(
  phone: string,
  token: string
): Promise<{ data: unknown; error: Error | null }> {
  const { data, error } = await supabase.auth.verifyOtp({
    phone,
    token,
    type: 'sms',
  });
  return { data, error: error as Error | null };
}

/**
 * Sign out the current user via Supabase auth.
 */
export async function signOut(): Promise<{ error: Error | null }> {
  const { error } = await supabase.auth.signOut();
  return { error: error as Error | null };
}

/**
 * Get the current Supabase auth session.
 */
export async function getSession() {
  return supabase.auth.getSession();
}

// ── Twilio custom SMS (secondary / server-side proxy) ─────────────────────────

/** True if Twilio env vars are configured (enables custom SMS flows). */
export function isTwilioConfigured(): boolean {
  return !!(ENV.twilio.accountSid && ENV.twilio.authToken && ENV.twilio.phoneNumber);
}

/**
 * Send a custom branded SMS via your backend Supabase Edge Function.
 *
 * ⚠️  NEVER send Twilio credentials from the browser.
 *     This function calls a server-side Edge Function (e.g., `send-sms`)
 *     that proxies the request to Twilio using server-stored secrets.
 *
 * @param to       Destination phone in E.164 format
 * @param message  The SMS body text
 */
export async function sendCustomSms(
  to: string,
  message: string
): Promise<{ success: boolean; error: string | null }> {
  if (!isTwilioConfigured()) {
    console.warn(
      '[Smart Radar / sms] Twilio is not configured. ' +
      'Add VITE_TWILIO_* keys to .env and deploy the `send-sms` Edge Function.'
    );
    return { success: false, error: 'Twilio not configured' };
  }

  const { data, error } = await supabase.functions.invoke('send-sms', {
    body: { to, message },
  });

  if (error) {
    console.error('[Smart Radar / sms] Edge Function error:', error);
    return { success: false, error: error.message };
  }

  return { success: true, error: null, ...data };
}

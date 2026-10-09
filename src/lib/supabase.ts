import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { ENV, isSupabaseConfigured } from '@/config/env';

let client: SupabaseClient | null = null;

/**
 * Lazily-created Supabase client. It is only instantiated once live mode is
 * chosen, so demo mode never makes network calls (e.g. token refreshes) to an
 * unreachable project.
 */
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (!client) {
    client = createClient(ENV.supabase.url!, ENV.supabase.anonKey!, {
      // PKCE: a sign-in link only works in the app/browser that asked for it, so a
      // crafted link can't silently log someone into another person's account.
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
    });
  }
  return client;
}

export function requireSupabase(): SupabaseClient {
  const c = getSupabase();
  if (!c) throw new Error('Supabase is not configured.');
  return c;
}

/** Quick reachability probe so a dead/paused project falls back to demo mode instead of hanging. */
export async function pingSupabase(timeoutMs = 4500): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${ENV.supabase.url}/auth/v1/health`, {
      headers: { apikey: ENV.supabase.anonKey! },
      signal: ctrl.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

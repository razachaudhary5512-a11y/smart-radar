import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { Profile } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// OTP rate-limit constants  (item 4)
// Max 5 OTP requests per phone per 60-minute window
// ─────────────────────────────────────────────────────────────────────────────
const OTP_MAX_PER_HOUR = 5;
const OTP_WINDOW_MS = 60 * 60 * 1000; // 1 hour

const PROFILE_STORAGE_KEY = 'smart_radar_user_profile_v4';

function getInitialProfile(): Profile {
  try {
    const saved = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}

  const defaultUser: Profile = {
    id: `user-${Date.now()}`,
    phone: '',
    display_name: 'Radar Citizen',
    avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    is_business: false,
    is_admin: false,
    cnic_number: null,
    verification_status: 'approved',
    verification_date: new Date(Date.now() - 120 * 86400000).toISOString(),
    verification_expiry: new Date(Date.now() + 65 * 86400000).toISOString(),
    verification_history: [],
    trust_score: 100,
    radius_km: 3,
    saved_locations: [{ label: 'Home Area', lat: 24.8607, lng: 67.0011 }],
    watched_areas: [],
    pinned_categories: ['community_feed', 'home_services', 'jobs_internships', 'second_hand'],
    muted_categories: [],
    digest_categories: ['local_deals', 'local_event', 'jobs_internships', 'property_rent'],
    digest_enabled: true,
    digest_time: '20:00',
    blocked_users: [],
    theme: 'light',
    created_at: new Date().toISOString(),
  };

  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(defaultUser));
  } catch {}
  return defaultUser;
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth context interface
// ─────────────────────────────────────────────────────────────────────────────
interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  isAdmin: boolean;
  signInWithPhone: (phone: string) => Promise<{ error: string | null }>;
  verifyOtp: (phone: string, token: string) => Promise<{ error: string | null }>;
  /** Admin-specific: email + password sign-in (item 3) */
  signInAdminWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: (userId?: string) => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ─────────────────────────────────────────────────────────────────────────────
// OTP rate-limiting helpers  (item 4)
// ─────────────────────────────────────────────────────────────────────────────
async function checkAndIncrementOtpLimit(phone: string): Promise<{ allowed: boolean; remaining: number }> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - OTP_WINDOW_MS);

  // Fetch existing record for this phone in the current window
  const { data, error } = await supabase
    .from('otp_rate_limit')
    .select('id, attempts, window_start')
    .eq('phone', phone)
    .gte('window_start', windowStart.toISOString())
    .order('window_start', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    // On DB error, fail open (allow) to avoid locking users out
    console.warn('[OTP Rate Limit] DB error, failing open:', error.message);
    return { allowed: true, remaining: OTP_MAX_PER_HOUR };
  }

  if (!data) {
    // First request in this window — create a new record
    await supabase.from('otp_rate_limit').insert({ phone, attempts: 1, window_start: now.toISOString() });
    return { allowed: true, remaining: OTP_MAX_PER_HOUR - 1 };
  }

  if (data.attempts >= OTP_MAX_PER_HOUR) {
    return { allowed: false, remaining: 0 };
  }

  // Increment existing record
  await supabase
    .from('otp_rate_limit')
    .update({ attempts: data.attempts + 1 })
    .eq('id', data.id);

  return { allowed: true, remaining: OTP_MAX_PER_HOUR - (data.attempts + 1) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(getInitialProfile);
  const [loading, setLoading] = useState(false);

  // Derived convenience flag (item 3)
  const isAdmin = Boolean(profile?.is_admin);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setSession(data.session);
        refreshProfile(data.session.user.id);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        refreshProfile(newSession.user.id);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const refreshProfile = useCallback(async (userId?: string) => {
    const uid = userId || session?.user?.id;
    if (!uid) return;

    try {
      // Intentionally omit cnic_number from SELECT — regular clients never receive it (item 2)
      const { data, error } = await supabase
        .from('profiles')
        .select(
          'id, phone, display_name, avatar_url, is_business, is_admin, verification_status, ' +
          'verification_date, verification_expiry, verification_history, trust_score, radius_km, ' +
          'saved_locations, watched_areas, pinned_categories, muted_categories, digest_categories, ' +
          'digest_enabled, digest_time, blocked_users, theme, created_at'
        )
        .eq('id', uid)
        .maybeSingle();

      if (!error && data) {
        // Merge is_admin from DB, never trust localStorage for this
        const merged = { ...(data as object), cnic_number: null } as Profile;
        setProfile(merged);
        try {
          localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(merged));
        } catch {}
      }
    } catch {
      // Fallback to cached
    }
  }, [session?.user?.id]);

  async function updateProfile(updates: Partial<Profile>) {
    // Strip sensitive/privileged fields from client-side updates (item 3)
    const { is_admin: _ia, cnic_number: _cn, ...safeUpdates } = updates as any;

    setProfile((prev) => {
      const updated = prev
        ? { ...prev, ...safeUpdates }
        : ({ ...getInitialProfile(), ...safeUpdates } as Profile);
      try {
        localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });

    if (session?.user) {
      try {
        await supabase
          .from('profiles')
          .update(safeUpdates)
          .eq('id', session.user.id);
      } catch {}
    }
  }

  // ── Phone OTP (regular users) ──────────────────────────────────────────────
  async function signInWithPhone(phone: string): Promise<{ error: string | null }> {
    // App-level rate limit check (item 4)
    const { allowed, remaining } = await checkAndIncrementOtpLimit(phone);
    if (!allowed) {
      return {
        error: `Too many OTP requests. You have used all ${OTP_MAX_PER_HOUR} allowed attempts for this hour. Please try again later.`,
      };
    }

    try {
      const { error } = await supabase.auth.signInWithOtp({ phone });
      if (error) return { error: error.message };
      if (remaining === 1) {
        return { error: null }; // last one — warn handled by UI via remaining count
      }
      return { error: null };
    } catch (e: any) {
      return { error: e?.message ?? 'Sign in error' };
    }
  }

  async function verifyOtp(phone: string, token: string): Promise<{ error: string | null }> {
    try {
      const { error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' });
      return { error: error?.message ?? null };
    } catch (e: any) {
      return { error: e?.message ?? 'Verification error' };
    }
  }

  // ── Admin: email + password (item 3) ──────────────────────────────────────
  async function signInAdminWithEmail(email: string, password: string): Promise<{ error: string | null }> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: error.message };

      // Verify the account actually has admin flag in DB (backend enforcement)
      if (data.session?.user?.id) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', data.session.user.id)
          .maybeSingle();

        if (!profileData?.is_admin) {
          // Sign them back out — not an admin
          await supabase.auth.signOut();
          return { error: 'Access denied. This account does not have admin privileges.' };
        }
      }

      return { error: null };
    } catch (e: any) {
      return { error: e?.message ?? 'Admin sign in error' };
    }
  }

  async function signOut() {
    try {
      await supabase.auth.signOut();
    } catch {}
    setSession(null);
    setProfile(getInitialProfile());
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        profile: profile ?? getInitialProfile(),
        loading,
        isAdmin,
        signInWithPhone,
        verifyOtp,
        signInAdminWithEmail,
        signOut,
        refreshProfile,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

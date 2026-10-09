import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useApi, onDataChange, type SessionUser } from '@/data';
import type { Profile, ProfilePatch } from './types';

interface AuthContextValue {
  user: SessionUser | null;
  profile: Profile | null;
  /** True until the initial session check completes. */
  loading: boolean;
  /** Derived from the server-side profile only — never from local state. */
  isAdmin: boolean;
  /** App owner (super-admin). */
  isOwner: boolean;
  sendOtp(phoneE164: string, captchaToken?: string): Promise<{ error: string | null; devCode?: string }>;
  verifyOtp(phoneE164: string, code: string): Promise<{ error: string | null }>;
  sendEmailOtp(email: string, captchaToken?: string): Promise<{ error: string | null; devCode?: string }>;
  verifyEmailOtp(email: string, code: string): Promise<{ error: string | null }>;
  adminSignIn(email: string, password: string, captchaToken?: string): Promise<{ error: string | null }>;
  signOut(): Promise<void>;
  deleteMyAccount(): Promise<{ error: string | null }>;
  refreshProfile(): Promise<void>;
  updateProfile(patch: ProfilePatch): Promise<void>;
  /** Opens the sign-in sheet; resolves true once the user is signed in. */
  requireAuth(reason?: string): Promise<boolean>;
  authPrompt: { open: boolean; reason?: string };
  closeAuthPrompt(signedIn: boolean): void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const api = useApi();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authPrompt, setAuthPrompt] = useState<{ open: boolean; reason?: string }>({ open: false });
  const waiters = useRef<((ok: boolean) => void)[]>([]);

  const loadProfile = useCallback(
    async (u: SessionUser | null) => {
      if (!u) {
        setProfile(null);
        return;
      }
      try {
        setProfile(await api.auth.getProfile(u.id));
      } catch (e) {
        console.warn('[Be Alert] Could not load profile', e);
      }
    },
    [api]
  );

  useEffect(() => {
    let alive = true;
    api.auth.getSession().then(async (u) => {
      if (!alive) return;
      setUser(u);
      await loadProfile(u);
      if (alive) setLoading(false);
    });
    const off = api.auth.onChange((u) => {
      setUser(u);
      loadProfile(u);
    });
    return () => {
      alive = false;
      off();
    };
  }, [api, loadProfile]);

  // Keep profile fresh after verification submissions / admin reviews.
  useEffect(
    () =>
      onDataChange((scope) => {
        if (scope === 'profile' || scope === 'admin') loadProfile(user);
      }),
    [user, loadProfile]
  );

  const updateProfile = useCallback(
    async (patch: ProfilePatch) => {
      if (!user) return;
      setProfile((p) => (p ? { ...p, ...patch } : p)); // optimistic
      try {
        await api.auth.updateProfile(user.id, patch);
      } catch (e) {
        await loadProfile(user);
        throw e;
      }
    },
    [api, user, loadProfile]
  );

  const requireAuth = useCallback(
    (reason?: string) => {
      if (user) return Promise.resolve(true);
      setAuthPrompt({ open: true, reason });
      return new Promise<boolean>((resolve) => waiters.current.push(resolve));
    },
    [user]
  );

  const closeAuthPrompt = useCallback((signedIn: boolean) => {
    setAuthPrompt({ open: false });
    waiters.current.splice(0).forEach((w) => w(signedIn));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      loading,
      isAdmin: Boolean(user && (profile?.is_admin || profile?.is_owner)),
      isOwner: Boolean(user && profile?.is_owner),
      sendOtp: (p, t) => api.auth.sendOtp(p, t),
      verifyOtp: (p, c) => api.auth.verifyOtp(p, c),
      sendEmailOtp: (e, t) => api.auth.sendEmailOtp(e, t),
      verifyEmailOtp: (e, c) => api.auth.verifyEmailOtp(e, c),
      adminSignIn: (e, pw, t) => api.auth.adminSignIn(e, pw, t),
      signOut: async () => {
        await api.auth.signOut();
        setUser(null);
        setProfile(null);
      },
      deleteMyAccount: async () => {
        const res = await api.auth.deleteMyAccount();
        if (!res.error) {
          setUser(null);
          setProfile(null);
        }
        return res;
      },
      refreshProfile: () => loadProfile(user),
      updateProfile,
      requireAuth,
      authPrompt,
      closeAuthPrompt,
    }),
    [api, user, profile, loading, loadProfile, updateProfile, requireAuth, authPrompt, closeAuthPrompt]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

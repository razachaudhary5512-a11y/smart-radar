import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from './auth';
import { syncStatusBar } from './native';
import type { ThemePref } from './types';

interface ThemeContextValue {
  pref: ThemePref;
  resolved: 'light' | 'dark';
  setPref(p: ThemePref): void;
  toggle(): void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);
const KEY = 'sr_theme';

function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    /* ignore */
  }
  return 'system';
}

const media = () => window.matchMedia('(prefers-color-scheme: dark)');

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { profile, updateProfile } = useAuth();
  const [pref, setPrefState] = useState<ThemePref>(readPref);
  const [systemDark, setSystemDark] = useState(() => media().matches);

  // Adopt the signed-in user's saved preference.
  useEffect(() => {
    if (profile?.theme) setPrefState(profile.theme);
  }, [profile?.theme]);

  useEffect(() => {
    const m = media();
    const on = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);

  const resolved: 'light' | 'dark' = pref === 'system' ? (systemDark ? 'dark' : 'light') : pref;

  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolved === 'dark');
    syncStatusBar(resolved === 'dark');
    try {
      localStorage.setItem(KEY, pref);
    } catch {
      /* ignore */
    }
  }, [resolved, pref]);

  const setPref = useCallback(
    (p: ThemePref) => {
      setPrefState(p);
      if (profile) updateProfile({ theme: p }).catch(() => {});
    },
    [profile, updateProfile]
  );

  const toggle = useCallback(() => setPref(resolved === 'dark' ? 'light' : 'dark'), [resolved, setPref]);

  return <ThemeContext.Provider value={{ pref, resolved, setPref, toggle }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

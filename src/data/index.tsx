import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { DataApi } from './api';
import { demoApi } from './demo';
import { ENV, isSupabaseConfigured } from '@/config/env';
import { pingSupabase } from '@/lib/supabase';

export type { DataApi, BackendMode, SessionUser } from './api';
export { onChange as onDataChange } from './events';

interface BackendState {
  api: DataApi;
  /** Why demo mode is active, when it is. */
  demoReason: 'not-configured' | 'unreachable' | 'forced' | null;
}

const BackendContext = createContext<BackendState | null>(null);

async function resolveBackend(): Promise<BackendState> {
  if (ENV.dataMode === 'demo') return { api: demoApi, demoReason: 'forced' };
  if (!isSupabaseConfigured) return { api: demoApi, demoReason: 'not-configured' };
  const { liveApi } = await import('./live');
  if (ENV.dataMode === 'live') return { api: liveApi, demoReason: null };
  const reachable = await pingSupabase();
  if (!reachable) {
    console.warn('[Smart Radar] Supabase project is unreachable — falling back to demo mode.');
    return { api: demoApi, demoReason: 'unreachable' };
  }
  return { api: liveApi, demoReason: null };
}

// Resolved once per page load (StrictMode runs effects twice in development).
let pending: Promise<BackendState> | null = null;

export function BackendProvider({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const [state, setState] = useState<BackendState | null>(null);

  useEffect(() => {
    let alive = true;
    pending ??= resolveBackend();
    pending.then((s) => alive && setState(s));
    return () => {
      alive = false;
    };
  }, []);

  if (!state) return <>{fallback}</>;
  return <BackendContext.Provider value={state}>{children}</BackendContext.Provider>;
}

export function useBackend(): BackendState {
  const ctx = useContext(BackendContext);
  if (!ctx) throw new Error('useBackend must be used within BackendProvider');
  return ctx;
}

export function useApi(): DataApi {
  return useBackend().api;
}

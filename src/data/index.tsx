import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { DataApi } from './api';
import { ENV, isSupabaseConfigured } from '@/config/env';
import { pingSupabase } from '@/lib/supabase';
import { loadDemo } from './demo-loader';

export type { DataApi, BackendMode, SessionUser } from './api';
export { onChange as onDataChange } from './events';

interface BackendState {
  api: DataApi;
  /** Why demo mode is active, when it is. */
  demoReason: 'not-configured' | 'unreachable' | 'forced' | null;
}

const BackendContext = createContext<BackendState | null>(null);

/** Demo backend + sample data are a separate chunk, only downloaded in demo mode. */
async function demo(reason: NonNullable<BackendState['demoReason']>): Promise<BackendState> {
  const { demoApi } = await loadDemo();
  return { api: demoApi, demoReason: reason };
}

/** Remove sample data an older demo build may have left in this browser. */
function clearDemoLeftovers() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('sr_demo_'))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* storage unavailable */
  }
}

async function resolveBackend(): Promise<BackendState> {
  if (ENV.dataMode === 'demo') return demo('forced');
  if (!isSupabaseConfigured) return demo('not-configured');
  const { liveApi } = await import('./live');
  if (ENV.dataMode === 'live') {
    // Production: never fall back to sample data.
    clearDemoLeftovers();
    return { api: liveApi, demoReason: null };
  }
  const reachable = await pingSupabase();
  if (!reachable) {
    console.warn('[Smart Radar] Supabase project is unreachable — falling back to demo mode.');
    return demo('unreachable');
  }
  clearDemoLeftovers();
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

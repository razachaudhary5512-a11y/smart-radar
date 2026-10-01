import { useCallback, useEffect, useRef, useState } from 'react';
import { onDataChange } from '@/data';

interface QueryState<T> {
  data: T | undefined;
  error: string | null;
  loading: boolean;
  refetch(): Promise<void>;
  setData(updater: T | ((prev: T | undefined) => T)): void;
}

/**
 * Minimal data-fetching hook: runs `fn` when `deps` change and refetches
 * silently when a matching data-change event fires.
 */
export function useQuery<T>(fn: () => Promise<T>, deps: unknown[], opts: { scopes?: string[]; enabled?: boolean } = {}): QueryState<T> {
  const { scopes = ['posts'], enabled = true } = opts;
  const [data, setDataState] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(enabled);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const seq = useRef(0);

  const run = useCallback(async (silent: boolean) => {
    const id = ++seq.current;
    if (!silent) setLoading(true);
    try {
      const res = await fnRef.current();
      if (id === seq.current) {
        setDataState(res);
        setError(null);
      }
    } catch (e) {
      if (id === seq.current) setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    run(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, run, ...deps]);

  const scopeKey = scopes.join(',');
  useEffect(() => {
    if (!enabled) return;
    const list = scopeKey.split(',');
    return onDataChange((s) => {
      if (list.includes(s) || list.includes('*')) run(true);
    });
  }, [enabled, run, scopeKey]);

  const setData = useCallback((u: T | ((prev: T | undefined) => T)) => {
    setDataState((prev) => (typeof u === 'function' ? (u as (p: T | undefined) => T)(prev) : u));
  }, []);

  return { data, error, loading, refetch: () => run(false), setData };
}

export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function useMediaQuery(query: string): boolean {
  const [match, setMatch] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const m = window.matchMedia(query);
    const on = () => setMatch(m.matches);
    on();
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, [query]);
  return match;
}

export const useIsDesktop = () => useMediaQuery('(min-width: 1024px)');

/** Re-render every `ms` so relative times ("5m ago") stay fresh. */
export function useNow(ms = 60_000): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export function useLocalStorage<T>(key: string, initial: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  const set = useCallback(
    (nv: T) => {
      setV(nv);
      try {
        localStorage.setItem(key, JSON.stringify(nv));
      } catch {
        /* ignore */
      }
    },
    [key]
  );
  return [v, set];
}

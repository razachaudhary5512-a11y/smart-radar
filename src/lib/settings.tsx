import { createContext, useContext, type ReactNode } from 'react';
import { useApi } from '@/data';
import { useQuery } from './hooks';
import { DEFAULT_SETTINGS, type AppSettings } from './types';

const SettingsContext = createContext<AppSettings>(DEFAULT_SETTINGS);

/** Loads the owner-controlled app settings and keeps them fresh. */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const api = useApi();
  const { data } = useQuery(() => api.getSettings(), [api], { scopes: ['settings'] });
  return <SettingsContext.Provider value={data ?? DEFAULT_SETTINGS}>{children}</SettingsContext.Provider>;
}

export function useAppSettings(): AppSettings {
  return useContext(SettingsContext);
}

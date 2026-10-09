import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, Smartphone, WifiOff, X } from 'lucide-react';
import { ENV } from '@/config/env';
import { isNative } from '@/lib/native';

/**
 * Website extras (inert inside the Android app):
 *  - "New version available" bar when an update is deployed
 *  - offline indicator
 *  - "Get the Android app" link to the Google Play listing
 * The website itself is a normal site — it is intentionally not installable.
 */

interface PwaApi {
  /** Link to the Android app (Google Play), when configured and we're on the website. */
  androidAppUrl: string | null;
}

const PwaContext = createContext<PwaApi>({ androidAppUrl: null });

export function PwaProvider({ children }: { children: ReactNode }) {
  const value = useMemo<PwaApi>(() => ({ androidAppUrl: !isNative && ENV.androidAppUrl ? ENV.androidAppUrl : null }), []);
  return (
    <PwaContext.Provider value={value}>
      {children}
      {!isNative && (
        <>
          <UpdateBar />
          <OfflinePill />
        </>
      )}
    </PwaContext.Provider>
  );
}

export const usePwa = () => useContext(PwaContext);

/** Shows a bar when a new version has been deployed; one tap reloads into it. */
function UpdateBar() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // Check for a new version every hour while the app stays open.
      if (registration) setInterval(() => registration.update().catch(() => {}), 60 * 60 * 1000);
    },
  });

  if (!needRefresh) return null;
  return (
    <div role="status" className="fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[60] mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-sm text-bg shadow-lift lg:bottom-6">
      <RefreshCw className="h-4 w-4 shrink-0" />
      <span className="flex-1 font-semibold">A new version of Be Alert is ready.</span>
      <button className="rounded-xl bg-primary-600 px-3 py-1.5 font-bold text-white" onClick={() => updateServiceWorker(true)}>
        Update
      </button>
      <button aria-label="Later" className="opacity-70" onClick={() => setNeedRefresh(false)}>
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function OfflinePill() {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  if (online) return null;
  return (
    <div role="status" className="fixed left-1/2 top-[calc(0.75rem+env(safe-area-inset-top))] z-[60] flex -translate-x-1/2 items-center gap-2 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-bg shadow-lift">
      <WifiOff className="h-3.5 w-3.5" /> You’re offline — new posts will load when you reconnect
    </div>
  );
}

/** "Get the Android app" link for the website's menus; hidden inside the app itself. */
export function GetAndroidAppButton({ className }: { className?: string }) {
  const { androidAppUrl } = usePwa();
  if (!androidAppUrl) return null;
  return (
    <a href={androidAppUrl} target="_blank" rel="noopener noreferrer" className={className ?? 'btn-secondary w-full'}>
      <Smartphone className="h-4 w-4" /> Get the Android app
    </a>
  );
}

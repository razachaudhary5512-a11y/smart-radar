import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Download, RefreshCw, Share, SquarePlus, WifiOff, X } from 'lucide-react';
import { Sheet } from '@/components/ui';
import { isNative } from '@/lib/native';

/**
 * Web app (PWA) behaviour for the browser version:
 *  - "Install app" (Android/desktop Chrome & Edge prompt, iPhone instructions)
 *  - "New version available" bar when an update is deployed
 *  - offline indicator
 * Everything here is inert inside the Android app (Capacitor).
 */

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PwaApi {
  /** True when the app can be installed from this browser (or iOS instructions apply). */
  canInstall: boolean;
  /** Running as an installed app (home screen / desktop window). */
  installed: boolean;
  install(): void;
}

const PwaContext = createContext<PwaApi>({ canInstall: false, installed: false, install: () => {} });

const isIOS = () =>
  typeof navigator !== 'undefined' &&
  (/iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);

export function PwaProvider({ children }: { children: ReactNode }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalone);
  const [iosHelp, setIosHelp] = useState(false);

  useEffect(() => {
    if (isNative) return;
    const onPrompt = (e: Event) => {
      e.preventDefault(); // show our own button instead of the mini-infobar
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (deferred) {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === 'accepted') setInstalled(true);
      setDeferred(null);
    } else if (isIOS()) {
      setIosHelp(true);
    }
  }, [deferred]);

  const value = useMemo<PwaApi>(
    () => ({ canInstall: !isNative && !installed && (Boolean(deferred) || isIOS()), installed, install }),
    [deferred, installed, install]
  );

  return (
    <PwaContext.Provider value={value}>
      {children}
      {!isNative && (
        <>
          <UpdateBar />
          <OfflinePill />
          <IosInstallSheet open={iosHelp} onClose={() => setIosHelp(false)} />
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

function IosInstallSheet({ open, onClose }: { open: boolean; onClose(): void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Install Be Alert" description="Add it to your Home Screen — it opens full-screen like a normal app." size="sm">
      <ol className="space-y-3 text-sm text-ink">
        <li className="flex items-center gap-3 rounded-xl bg-surface-2 p-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-600/10 text-primary-600">
            <Share className="h-4 w-4" />
          </span>
          Tap the <b>Share</b> button at the bottom of Safari.
        </li>
        <li className="flex items-center gap-3 rounded-xl bg-surface-2 p-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-600/10 text-primary-600">
            <SquarePlus className="h-4 w-4" />
          </span>
          Choose <b>Add to Home Screen</b>, then tap <b>Add</b>.
        </li>
      </ol>
      <button className="btn-primary mt-5 w-full" onClick={onClose}>
        Got it
      </button>
    </Sheet>
  );
}

/** "Install app" button for menus; renders nothing when not installable. */
export function InstallAppButton({ className }: { className?: string }) {
  const { canInstall, install } = usePwa();
  if (!canInstall) return null;
  return (
    <button onClick={install} className={className ?? 'btn-secondary w-full'}>
      <Download className="h-4 w-4" /> Install app
    </button>
  );
}

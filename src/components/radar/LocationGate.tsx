import { useState, type ReactNode } from 'react';
import { LocateFixed, MapPin, MapPinOff } from 'lucide-react';
import { useRadar } from '@/lib/location-context';
import { isNative } from '@/lib/native';
import { Spinner } from '@/components/ui';
import { AreaSheet } from './AreaSheet';

/**
 * Shows nearby content only once we know where the user is — their current location,
 * or an area they picked. There is no built-in default city.
 */
export function LocationGate({ children, compact }: { children: ReactNode; compact?: boolean }) {
  const radar = useRadar();
  const [pick, setPick] = useState(false);
  if (radar.located) return <>{children}</>;

  const denied = radar.gpsStatus === 'denied';
  return (
    <div className={compact ? 'px-4 py-10' : 'flex min-h-[60dvh] items-center justify-center px-6 py-12'}>
      <div className="mx-auto max-w-sm text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-primary-600/10 text-primary-600">
          {denied ? <MapPinOff className="h-8 w-8" /> : <LocateFixed className="h-8 w-8 animate-pulse" />}
        </div>
        {denied ? (
          <>
            <h2 className="text-xl font-extrabold tracking-tight text-ink">Turn on location</h2>
            <p className="mt-2 text-sm text-ink-2">
              Be Alert shows what’s happening around <b>your current location</b>.{' '}
              {isNative
                ? 'Allow location for Be Alert in your phone’s Settings → Apps → Be Alert → Permissions.'
                : 'Allow location for this site (tap the lock or settings icon next to the address bar).'}
            </p>
            {radar.gpsError && <p className="mt-2 text-xs text-ink-3">{radar.gpsError}</p>}
            <div className="mt-6 flex flex-col gap-2.5">
              <button className="btn-primary" onClick={radar.requestLocation}>
                <LocateFixed className="h-4 w-4" /> Try again
              </button>
              <button className="btn-secondary" onClick={() => setPick(true)}>
                <MapPin className="h-4 w-4" /> Choose an area instead
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-xl font-extrabold tracking-tight text-ink">Finding your location…</h2>
            <p className="mt-2 text-sm text-ink-2">If your phone asks, tap <b>Allow</b> so we can show alerts and posts near you.</p>
            <div className="mt-6 flex justify-center">
              <Spinner className="h-6 w-6" />
            </div>
          </>
        )}
      </div>
      <AreaSheet open={pick} onClose={() => setPick(false)} />
    </div>
  );
}

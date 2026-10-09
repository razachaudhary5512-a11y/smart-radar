/**
 * Thin bridge to native features when running inside the Android app
 * (Capacitor). On the web every function falls back to browser APIs.
 * Plugins are imported lazily so the website bundle stays small.
 */
import { Capacitor } from '@capacitor/core';
import type { Coords } from './types';

export const isNative = Capacitor.isNativePlatform();

/** GPS position via the native plugin (handles the Android permission prompt). */
export async function nativePosition(timeoutMs: number): Promise<{ coords: Coords } | { error: 'denied' | 'unavailable' }> {
  const { Geolocation } = await import('@capacitor/geolocation');
  try {
    let perm = await Geolocation.checkPermissions();
    if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') perm = await Geolocation.requestPermissions();
    if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') return { error: 'denied' };
    const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 5 * 60_000 });
    return { coords: { lat: pos.coords.latitude, lng: pos.coords.longitude } };
  } catch {
    return { error: 'unavailable' };
  }
}

/** Native share sheet in the app; Web Share API or clipboard on the web. Returns how it was shared. */
export async function shareContent(data: { title: string; text: string; url?: string }): Promise<'shared' | 'copied' | 'cancelled'> {
  if (isNative) {
    const { Share } = await import('@capacitor/share');
    try {
      await Share.share({ title: data.title, text: data.text, url: data.url, dialogTitle: data.title });
      return 'shared';
    } catch {
      return 'cancelled';
    }
  }
  if (navigator.share) {
    try {
      await navigator.share(data);
      return 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled';
    }
  }
  await navigator.clipboard.writeText(data.url ? `${data.text} ${data.url}` : data.text);
  return 'copied';
}

/** Android hardware back button → in-app history, exit at the root. */
export async function registerBackButton(goBack: () => void, atRoot: () => boolean): Promise<() => void> {
  if (!isNative) return () => {};
  const { App } = await import('@capacitor/app');
  const handle = await App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack && !atRoot()) goBack();
    else App.exitApp();
  });
  return () => handle.remove();
}

/** Where sign-in emails send the user back to inside the Android app. */
export const APP_AUTH_CALLBACK = 'com.bealert.app://auth-callback';

/**
 * Calls `handler` with every deep link that opens the app (including the one
 * that launched it), e.g. the email sign-in link.
 */
export async function onDeepLink(handler: (url: string) => void): Promise<() => void> {
  if (!isNative) return () => {};
  const { App } = await import('@capacitor/app');
  const launch = await App.getLaunchUrl();
  if (launch?.url) handler(launch.url);
  const handle = await App.addListener('appUrlOpen', ({ url }) => handler(url));
  return () => handle.remove();
}

/** Match the Android status bar to the app theme. */
export async function syncStatusBar(dark: boolean) {
  if (!isNative) return;
  const { StatusBar, Style } = await import('@capacitor/status-bar');
  try {
    await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light });
    await StatusBar.setBackgroundColor({ color: dark ? '#080b13' : '#f6f7fb' });
  } catch {
    /* not supported on this Android version */
  }
}

/**
 * src/services/firebase.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Firebase initialisation + Cloud Messaging (push notifications).
 *
 * If the six VITE_FIREBASE_* environment variables are not set, every function
 * below becomes a no-op that logs a warning — the app continues normally.
 *
 * Usage:
 *   import { initFirebase, requestNotificationPermission } from '@/services/firebase';
 *
 *   // Call once at app startup (e.g., in main.tsx or App.tsx useEffect)
 *   initFirebase();
 *   const token = await requestNotificationPermission();
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { ENV } from '@/config/env';

// ── Internal state ────────────────────────────────────────────────────────────
let _app: import('firebase/app').FirebaseApp | null = null;
let _messaging: import('firebase/messaging').Messaging | null = null;

/** True if all required Firebase config keys are present in the environment. */
export function isFirebaseConfigured(): boolean {
  const f = ENV.firebase;
  return !!(f.apiKey && f.authDomain && f.projectId && f.storageBucket && f.messagingSenderId && f.appId);
}

/**
 * Initialises the Firebase app singleton.
 * Safe to call multiple times — returns the existing app if already initialised.
 * Returns null if Firebase is not configured.
 */
export async function initFirebase(): Promise<import('firebase/app').FirebaseApp | null> {
  if (_app) return _app;

  if (!isFirebaseConfigured()) {
    console.warn(
      '[Smart Radar / firebase] Firebase is not configured. ' +
      'Push notifications will be disabled. Add the VITE_FIREBASE_* keys to .env to enable.'
    );
    return null;
  }

  const { initializeApp, getApps } = await import('firebase/app');

  // Prevent duplicate initialisation during HMR
  if (getApps().length > 0) {
    _app = getApps()[0];
    return _app;
  }

  _app = initializeApp({
    apiKey:            ENV.firebase.apiKey!,
    authDomain:        ENV.firebase.authDomain!,
    projectId:         ENV.firebase.projectId!,
    storageBucket:     ENV.firebase.storageBucket!,
    messagingSenderId: ENV.firebase.messagingSenderId!,
    appId:             ENV.firebase.appId!,
  });

  console.info('[Smart Radar / firebase] ✅ Firebase initialised (project: ' + ENV.firebase.projectId + ')');
  return _app;
}

/**
 * Requests notification permission from the browser and registers the device
 * with Firebase Cloud Messaging.
 *
 * @param vapidKey  Your VAPID public key from the Firebase Console
 *                  (Project Settings → Cloud Messaging → Web Push certificates).
 *                  Add as VITE_FIREBASE_VAPID_KEY in .env when ready.
 *
 * @returns  The FCM registration token (store this on your backend / Supabase
 *           user profile to target push notifications), or null if unavailable.
 */
export async function requestNotificationPermission(vapidKey: string | undefined = ENV.firebase.vapidKey): Promise<string | null> {
  if (!isFirebaseConfigured()) {
    console.warn('[Smart Radar / firebase] requestNotificationPermission() skipped — Firebase not configured.');
    return null;
  }

  // Notifications are only available in secure contexts
  if (!('Notification' in window)) {
    console.warn('[Smart Radar / firebase] Notifications API is not available in this browser.');
    return null;
  }

  const app = await initFirebase();
  if (!app) return null;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.info('[Smart Radar / firebase] Notification permission denied by user.');
      return null;
    }

    const { getMessaging, getToken, isSupported } = await import('firebase/messaging');
    if (!(await isSupported())) {
      console.warn('[Smart Radar / firebase] Push messaging is not supported in this browser.');
      return null;
    }
    if (!vapidKey) {
      console.warn('[Smart Radar / firebase] VITE_FIREBASE_VAPID_KEY is missing — web push needs it (Firebase → Cloud Messaging → Web Push certificates).');
      return null;
    }

    if (!_messaging) {
      _messaging = getMessaging(app);
    }

    // Background notifications need the service worker; the public config goes in its URL.
    const f = ENV.firebase;
    const qs = new URLSearchParams({
      apiKey: f.apiKey!, authDomain: f.authDomain!, projectId: f.projectId!,
      storageBucket: f.storageBucket!, messagingSenderId: f.messagingSenderId!, appId: f.appId!,
    });
    const registration = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}firebase-messaging-sw.js?${qs}`);

    const token = await getToken(_messaging, { vapidKey, serviceWorkerRegistration: registration });
    console.info('[Smart Radar / firebase] ✅ FCM registration token obtained.');
    return token;
  } catch (err) {
    console.error('[Smart Radar / firebase] Failed to get FCM token:', err);
    return null;
  }
}

/**
 * Listens for foreground push messages and calls your handler.
 * Returns an unsubscribe function — call it on component unmount.
 *
 * @example
 *   const unsubscribe = onForegroundMessage((payload) => {
 *     showInAppToast(payload.notification?.title ?? 'New alert');
 *   });
 *   return () => unsubscribe();
 */
export async function onForegroundMessage(
  handler: (payload: import('firebase/messaging').MessagePayload) => void
): Promise<() => void> {
  if (!isFirebaseConfigured()) {
    return () => { /* no-op */ };
  }

  const app = await initFirebase();
  if (!app) return () => { /* no-op */ };

  const { getMessaging, onMessage } = await import('firebase/messaging');
  if (!_messaging) _messaging = getMessaging(app);

  const unsubscribe = onMessage(_messaging, handler);
  return unsubscribe;
}

/** Tiny change bus so open screens can refresh after any write. */
type Listener = (scope: string) => void;
const listeners = new Set<Listener>();

export function emitChange(scope = 'posts') {
  listeners.forEach((l) => l(scope));
}

export function onChange(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

/**
 * Keep every open screen in step with changes made on other devices — e.g. a post made in
 * the Android app shows up on the website (and vice versa) without a manual refresh.
 * Emits 'sync' when the app comes back to the foreground and once a minute while visible.
 */
let lastSync = Date.now();
function sync() {
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
  if (Date.now() - lastSync < 10_000) return;
  lastSync = Date.now();
  emitChange('sync');
}
if (typeof window !== 'undefined') {
  document.addEventListener('visibilitychange', sync);
  window.addEventListener('focus', sync);
  window.addEventListener('online', sync);
  setInterval(sync, 60_000);
}

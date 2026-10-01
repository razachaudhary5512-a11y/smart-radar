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

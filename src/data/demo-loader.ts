/**
 * Single entry point to the demo backend and its sample data.
 * In builds with VITE_DATA_MODE=live (the public website and the Android app)
 * DEMO_ENABLED is the constant `false`, so the bundler drops these imports and
 * no dummy data is shipped at all.
 */
export const DEMO_ENABLED = import.meta.env.VITE_DATA_MODE !== 'live';

const disabled = () => Promise.reject(new Error('Demo mode is not included in this build.'));

export const loadDemo = () => (DEMO_ENABLED ? import('./demo') : disabled());
export const loadDemoSeed = () => (DEMO_ENABLED ? import('./demo/seed') : disabled());

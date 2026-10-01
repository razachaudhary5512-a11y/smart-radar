import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

/** Refuse to build if a server secret is exposed through a VITE_ variable. */
function guardSecrets(mode: string): Plugin {
  return {
    name: 'smart-radar-guard-secrets',
    configResolved(config) {
      const env = loadEnv(mode, config.envDir || config.root, 'VITE_');
      const leaked = Object.entries(env)
        .filter(([k, v]) => /TWILIO_AUTH_TOKEN|TWILIO_ACCOUNT_SID|JAZZCASH_PASSWORD|SERVICE_ROLE|SECRET/i.test(k) && v.trim())
        .map(([k]) => k);
      if (leaked.length) {
        throw new Error(
          `[Smart Radar] ${leaked.join(', ')} would be shipped to every browser. ` +
            'Remove it from .env and store it as a Supabase Edge Function secret instead.'
        );
      }
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // GitHub Pages serves the site from /<repo-name>/; everything else from /.
  base: mode === 'pages' ? '/smart-radar/' : '/',
  plugins: [react(), guardSecrets(mode)],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
          leaflet: ['leaflet', 'react-leaflet'],
        },
      },
    },
  },
}));

import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
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

/**
 * Production builds get a strict Content Security Policy: scripts only from this
 * app (+ Cloudflare Turnstile), network calls only to our Supabase project and the
 * map/geocoding services. Blocks injected scripts and data exfiltration.
 */
function contentSecurityPolicy(mode: string): Plugin {
  let enabled = false;
  let supabase = '';
  return {
    name: 'smart-radar-csp',
    configResolved(config) {
      // Not for the Android build: Capacitor injects its own inline bridge script at runtime.
      enabled = config.command === 'build' && mode !== 'android';
      const env = loadEnv(mode, config.envDir || config.root, 'VITE_');
      supabase = (env.VITE_SUPABASE_URL ?? '').trim().replace(/\/$/, '');
    },
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        if (!enabled) return html;
        const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(
          (m) => `'sha256-${createHash('sha256').update(m[1].replace(/\r\n?/g, '\n')).digest('base64')}'`
        );
        const sb = supabase ? [supabase, supabase.replace(/^https:/, 'wss:')] : [];
        const policy = [
          "default-src 'self'",
          `script-src 'self' ${inline.join(' ')} https://challenges.cloudflare.com`,
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "font-src 'self' data: https://fonts.gstatic.com",
          `img-src 'self' data: blob: https://*.tile.openstreetmap.org ${supabase}`.trim(),
          `connect-src 'self' ${sb.join(' ')} https://nominatim.openstreetmap.org https://*.googleapis.com https://challenges.cloudflare.com`,
          'frame-src https://challenges.cloudflare.com',
          "worker-src 'self' blob:",
          "manifest-src 'self'",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'self'",
        ].join('; ');
        return html.replace('<head>', `<head>
    <meta http-equiv="Content-Security-Policy" content="${policy}" />
    <meta name="referrer" content="strict-origin-when-cross-origin" />`);
      },
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // GitHub Pages serves the site from /<repo-name>/; everything else from /.
  base: mode === 'pages' ? '/smart-radar/' : '/',
  plugins: [react(), guardSecrets(mode), contentSecurityPolicy(mode)],
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

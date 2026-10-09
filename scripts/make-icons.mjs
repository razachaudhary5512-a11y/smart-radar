// Generates every app icon / splash PNG from the Be Alert radar mark.
//   node scripts/make-icons.mjs        → assets/* (for @capacitor/assets) + public/icon-*.png
import { mkdirSync } from 'node:fs';
import sharp from 'sharp';

mkdirSync('assets', { recursive: true });

const radar = (cx, cy, s, sweepId) => `
  <circle cx="${cx}" cy="${cy}" r="${20 * s}" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="${2.5 * s}"/>
  <circle cx="${cx}" cy="${cy}" r="${11 * s}" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="${2.5 * s}"/>
  <path d="M${cx} ${cy} L${cx} ${cy - 20 * s} A${20 * s} ${20 * s} 0 0 1 ${cx + 18.5 * s} ${cy - 7.5 * s} Z" fill="url(#${sweepId})"/>
  <circle cx="${cx}" cy="${cy}" r="${3.5 * s}" fill="#fff"/>
  <circle cx="${cx + 12 * s}" cy="${cy - 11 * s}" r="${3 * s}" fill="#2ee6c5"/>`;

const defs = `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3b66f5"/><stop offset="1" stop-color="#1d38d7"/></linearGradient>
    <linearGradient id="sw" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2ee6c5" stop-opacity="0"/><stop offset="1" stop-color="#2ee6c5" stop-opacity=".9"/></linearGradient>
  </defs>`;

const svg = (w, h, body) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${defs}${body}</svg>`);

// Full-bleed square (launchers / maskable icons apply their own shape).
const full = svg(1024, 1024, `<rect width="1024" height="1024" fill="url(#bg)"/>${radar(512, 512, 17, 'sw')}`);
// Rounded square on transparent (browser tabs, install dialogs, desktop).
const rounded = svg(1024, 1024, `<rect width="1024" height="1024" rx="228" fill="url(#bg)"/>${radar(512, 512, 17, 'sw')}`);
// Maskable: full bleed, radar inside the 80% safe circle.
const maskable = svg(1024, 1024, `<rect width="1024" height="1024" fill="url(#bg)"/>${radar(512, 512, 13, 'sw')}`);
// Adaptive icon layers: radar kept inside the 66% safe zone.
const foreground = svg(1024, 1024, radar(512, 512, 12.5, 'sw'));
const background = svg(1024, 1024, `<rect width="1024" height="1024" fill="url(#bg)"/>`);
// Splash: brand mark on the app background colour.
const splash = (bg) =>
  svg(2732, 2732, `<rect width="2732" height="2732" fill="${bg}"/><rect x="1110" y="1110" width="512" height="512" rx="140" fill="url(#bg)"/>${radar(1366, 1366, 8.5, 'sw')}`);

await Promise.all([
  sharp(full).png().toFile('assets/icon-only.png'),
  sharp(foreground).png().toFile('assets/icon-foreground.png'),
  sharp(background).png().toFile('assets/icon-background.png'),
  sharp(splash('#f6f7fb')).png().toFile('assets/splash.png'),
  sharp(splash('#080b13')).png().toFile('assets/splash-dark.png'),
  sharp(full).resize(192, 192).png().toFile('public/icon-192.png'),
  sharp(full).resize(512, 512).png().toFile('public/icon-512.png'),
  // Web app (PWA): rounded "any" icons, full-bleed maskable icon, iOS home-screen icon.
  sharp(rounded).resize(192, 192).png().toFile('public/pwa-192.png'),
  sharp(rounded).resize(512, 512).png().toFile('public/pwa-512.png'),
  sharp(maskable).resize(512, 512).png().toFile('public/maskable-512.png'),
  sharp(full).resize(180, 180).flatten({ background: '#1d38d7' }).png().toFile('public/apple-touch-icon.png'),
  sharp(rounded).resize(64, 64).png().toFile('public/favicon-64.png'),
]);
console.log('✔ icons written to assets/ and public/');

// GitHub Pages has no SPA rewrites: serve index.html for unknown paths via 404.html,
// and disable Jekyll so files/folders starting with "_" are published.
import { copyFileSync, writeFileSync } from 'node:fs';

copyFileSync('dist/index.html', 'dist/404.html');
writeFileSync('dist/.nojekyll', '');
console.log('✔ dist/404.html + .nojekyll written for GitHub Pages');

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const publicDirectory = resolve('.output/public');
const manifestPath = resolve(publicDirectory, 'manifest.webmanifest');
const serviceWorkerPath = resolve(publicDirectory, 'sw.js');

if (!existsSync(manifestPath) || !existsSync(serviceWorkerPath)) {
  throw new Error('Run pnpm build before checking the PWA artifacts.');
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
  id?: string;
  start_url?: string;
  scope?: string;
  display?: string;
  icons?: Array<{ src?: string; sizes?: string; purpose?: string }>;
};
const serviceWorker = readFileSync(serviceWorkerPath, 'utf8');
const expectedIcons = [
  ['/pwa-192x192.png', '192x192', 'any'],
  ['/pwa-512x512.png', '512x512', 'any'],
  ['/pwa-maskable-512x512.png', '512x512', 'maskable'],
];

for (const [src, sizes, purpose] of expectedIcons) {
  const icon = manifest.icons?.find((candidate) => candidate.src === src);
  if (!icon || icon.sizes !== sizes || icon.purpose !== purpose) {
    throw new Error(`The web app manifest is missing ${src} (${sizes}, ${purpose}).`);
  }
  if (!existsSync(resolve(publicDirectory, src.slice(1)))) {
    throw new Error(`The generated application is missing ${src}.`);
  }
}

if (
  manifest.id !== '/' ||
  manifest.start_url !== '/' ||
  manifest.scope !== '/' ||
  manifest.display !== 'standalone'
) {
  throw new Error('The web app manifest has an invalid application identity or launch scope.');
}
if (!serviceWorker.includes('url:"/"') || !serviceWorker.includes('createHandlerBoundToURL("/")')) {
  throw new Error('The service worker does not precache and serve the application shell.');
}
if (!serviceWorker.includes('url:"_nuxt/')) {
  throw new Error('The service worker does not precache the Nuxt client assets.');
}
if (!serviceWorker.includes('denylist:[/^\\/api') || serviceWorker.includes('url:"api/')) {
  throw new Error('API routes must remain outside the service-worker cache.');
}
if (serviceWorker.includes('"use strict";self.skipWaiting(),')) {
  throw new Error('The service worker must wait for update confirmation before activation.');
}

console.log(`PWA artifacts verified with ${manifest.icons?.length ?? 0} manifest icons.`);

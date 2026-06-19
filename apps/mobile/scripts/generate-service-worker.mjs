import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import workboxBuild from 'workbox-build';

const { generateSW } = workboxBuild;
const distDir = path.resolve(process.cwd(), process.argv[2] ?? 'dist');
const indexPath = path.join(distDir, 'index.html');

if (!fs.existsSync(distDir)) {
  console.error(`Cannot generate service worker because ${distDir} does not exist.`);
  process.exit(1);
}

function injectPwaHeadTags() {
  if (!fs.existsSync(indexPath)) return;

  const html = fs.readFileSync(indexPath, 'utf8');
  if (html.includes('rel="manifest"')) return;

  const pwaHeadTags = [
    '<meta name="theme-color" content="#1B2B5E" />',
    '<meta name="background-color" content="#EEF2F9" />',
    '<meta name="mobile-web-app-capable" content="yes" />',
    '<meta name="apple-mobile-web-app-capable" content="yes" />',
    '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />',
    '<meta name="apple-mobile-web-app-title" content="Oasis" />',
    '<meta name="description" content="Staff, parent, and student mobile portal for Oasis Learning Centre." />',
    '<link rel="manifest" href="/manifest.json" />',
    '<link rel="icon" type="image/png" href="/favicon.png" />',
    '<link rel="apple-touch-icon" href="/apple-touch-icon.png" />',
  ].join('\n    ');

  fs.writeFileSync(indexPath, html.replace('</head>', `    ${pwaHeadTags}\n  </head>`));
}

injectPwaHeadTags();

const result = await generateSW({
  cleanupOutdatedCaches: true,
  clientsClaim: true,
  globDirectory: distDir,
  globIgnores: ['service-worker.js', 'workbox-*.js'],
  globPatterns: ['**/*.{css,html,ico,js,json,png,svg,woff,woff2}'],
  navigateFallback: '/offline.html',
  navigateFallbackDenylist: [/^\/api\//, /^\/api\/trpc/],
  runtimeCaching: [
    {
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'oasis-mobile-static',
        expiration: {
          maxAgeSeconds: 7 * 24 * 60 * 60,
          maxEntries: 80,
        },
      },
      urlPattern: ({ request, url }) =>
        request.method === 'GET' &&
        url.origin === self.location.origin &&
        !url.pathname.startsWith('/api/') &&
        /\.(?:css|html|ico|js|json|png|svg|woff2?)$/.test(url.pathname),
    },
  ],
  skipWaiting: true,
  swDest: path.join(distDir, 'service-worker.js'),
});

console.log(
  `Generated service-worker.js with ${String(result.count)} precached files (${String(
    result.size,
  )} bytes).`,
);

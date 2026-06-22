import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import workboxBuild from 'workbox-build';

const { generateSW } = workboxBuild;
const distDir = path.resolve(process.cwd(), process.argv[2] ?? 'dist');
const indexPath = path.join(distDir, 'index.html');
const serviceWorkerPath = path.join(distDir, 'service-worker.js');

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

function appendNotificationHandlers() {
  if (!fs.existsSync(serviceWorkerPath)) return;

  const serviceWorker = fs.readFileSync(serviceWorkerPath, 'utf8');
  if (serviceWorker.includes("addEventListener('push'")) return;

  const notificationHandlers = `

self.addEventListener('push', (event) => {
  const fallbackPayload = {
    badgeCount: undefined,
    body: 'Open Oasis to view the latest update.',
    route: '/',
    title: 'Oasis update',
  };

  let payload = fallbackPayload;
  try {
    payload = { ...fallbackPayload, ...(event.data?.json() ?? {}) };
  } catch {
    payload = fallbackPayload;
  }

  const route = typeof payload.route === 'string' && payload.route.startsWith('/')
    ? payload.route
    : '/';
  const title = typeof payload.title === 'string' && payload.title.trim()
    ? payload.title
    : fallbackPayload.title;
  const body = typeof payload.body === 'string' && payload.body.trim()
    ? payload.body
    : fallbackPayload.body;
  const badgeCount = Number.isFinite(payload.badgeCount) ? payload.badgeCount : undefined;

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, {
        badge: '/icons/icon-192.png',
        body,
        data: { route },
        icon: '/icons/icon-192.png',
        tag: 'oasis-update',
      }),
      badgeCount === undefined || !self.navigator?.setAppBadge
        ? Promise.resolve()
        : self.navigator.setAppBadge(badgeCount).catch(() => undefined),
    ]),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const route = typeof event.notification.data?.route === 'string' &&
    event.notification.data.route.startsWith('/')
    ? event.notification.data.route
    : '/';
  const targetUrl = new URL(route, self.location.origin).href;

  event.waitUntil(
    self.clients
      .matchAll({ includeUncontrolled: true, type: 'window' })
      .then((clients) => {
        for (const client of clients) {
          if (client.url.startsWith(self.location.origin) && 'navigate' in client) {
            return client.navigate(targetUrl).then((focusedClient) => focusedClient?.focus());
          }

          if (client.url.startsWith(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }

        return self.clients.openWindow(targetUrl);
      }),
  );
});
`;

  fs.appendFileSync(serviceWorkerPath, notificationHandlers);
}

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
  swDest: serviceWorkerPath,
});

appendNotificationHandlers();

console.log(
  `Generated service-worker.js with ${String(result.count)} precached files (${String(
    result.size,
  )} bytes).`,
);

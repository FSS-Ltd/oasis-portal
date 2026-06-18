import { copyFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(moduleDir, '..');
const defaultDistDir = path.join(mobileRoot, 'dist');
const defaultPublicDir = path.join(mobileRoot, 'public');

const HEAD_TAGS = [
  '<link rel="manifest" href="/manifest.webmanifest">',
  '<meta name="theme-color" content="#1B2B5E">',
  '<meta name="apple-mobile-web-app-capable" content="yes">',
  '<meta name="apple-mobile-web-app-title" content="Oasis">',
  '<meta name="apple-mobile-web-app-status-bar-style" content="default">',
  '<link rel="apple-touch-icon" href="/icons/oasis-icon-192.png">',
];

const SERVICE_WORKER_REGISTRATION = `<script>
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/service-worker.js').catch(function () {});
  });
}
</script>`;

function slashPath(value) {
  return `/${value.split(path.sep).join('/')}`;
}

async function listStaticAssets(dir, baseDir = dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const assets = [];

  for (const entry of entries) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      assets.push(...(await listStaticAssets(absolute, baseDir)));
      continue;
    }

    const relative = path.relative(baseDir, absolute);
    if (
      relative === 'service-worker.js' ||
      relative.endsWith('.map') ||
      relative.startsWith(`api${path.sep}`)
    ) {
      continue;
    }

    assets.push(slashPath(relative));
  }

  return assets.sort();
}

async function copyPublicFile(publicDir, distDir, filename) {
  await copyFile(path.join(publicDir, filename), path.join(distDir, filename));
}

async function copyPublicDirectory(publicDir, distDir, dirname) {
  const sourceDir = path.join(publicDir, dirname);
  const targetDir = path.join(distDir, dirname);
  await mkdir(targetDir, { recursive: true });

  const entries = await readdir(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      await copyPublicDirectory(sourceDir, targetDir, entry.name);
      continue;
    }

    await copyFile(sourcePath, targetPath);
  }
}

async function injectHeadMetadata(distDir) {
  const htmlPath = path.join(distDir, 'index.html');
  const html = await readFile(htmlPath, 'utf8');
  const withHead = HEAD_TAGS.reduce((current, tag) => {
    if (current.includes(tag)) return current;
    return current.replace('</head>', `  ${tag}\n</head>`);
  }, html);
  const withServiceWorker = withHead.includes(
    "navigator.serviceWorker.register('/service-worker.js')",
  )
    ? withHead
    : withHead.replace('</body>', `${SERVICE_WORKER_REGISTRATION}\n</body>`);

  await writeFile(htmlPath, withServiceWorker);
}

async function writeServiceWorker(distDir) {
  const assets = await listStaticAssets(distDir);
  const precache = Array.from(
    new Set(['/', '/index.html', '/manifest.webmanifest', '/offline.html', ...assets]),
  );
  const serviceWorker = `const CACHE_NAME = 'oasis-mobile-pwa-v1';
const PRECACHE_URLS = ${JSON.stringify(precache, null, 2)};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/offline.html')),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached ?? fetch(event.request)),
  );
});
`;

  await writeFile(path.join(distDir, 'service-worker.js'), serviceWorker);
}

export async function preparePwaExport({
  distDir = defaultDistDir,
  publicDir = defaultPublicDir,
} = {}) {
  const distStats = await stat(distDir);
  if (!distStats.isDirectory()) {
    throw new Error(`${distDir} is not a directory`);
  }

  await mkdir(distDir, { recursive: true });
  await copyPublicFile(publicDir, distDir, 'manifest.webmanifest');
  await copyPublicFile(publicDir, distDir, 'offline.html');
  await copyPublicDirectory(publicDir, distDir, 'icons');
  await injectHeadMetadata(distDir);
  await writeServiceWorker(distDir);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  preparePwaExport().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

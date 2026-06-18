import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const defaultDistDir = path.resolve(moduleDir, '..', 'dist');

async function readRequiredFile(distDir, filename) {
  const filePath = path.join(distDir, filename);
  try {
    return await readFile(filePath, 'utf8');
  } catch {
    throw new Error(`${filename} is missing from ${distDir}`);
  }
}

async function assertRequiredFile(distDir, filename) {
  const filePath = path.join(distDir, filename);
  try {
    const fileStats = await stat(filePath);
    if (!fileStats.isFile()) throw new Error();
  } catch {
    throw new Error(`${filename} is missing from ${distDir}`);
  }
}

async function assertManifestIconsExist(distDir, manifest) {
  if (!Array.isArray(manifest.icons) || manifest.icons.length === 0) {
    throw new Error('manifest.webmanifest must include install icons');
  }

  await Promise.all(
    manifest.icons.map((icon) => {
      if (!icon || typeof icon.src !== 'string' || !icon.src.startsWith('/')) {
        throw new Error('manifest.webmanifest includes an invalid icon source');
      }
      return assertRequiredFile(distDir, icon.src.slice(1));
    }),
  );
}

export async function checkPwaExport(distDir = defaultDistDir) {
  const distStats = await stat(distDir);
  if (!distStats.isDirectory()) {
    throw new Error(`${distDir} is not a directory`);
  }

  const [html, manifestText, offlineHtml, serviceWorker] = await Promise.all([
    readRequiredFile(distDir, 'index.html'),
    readRequiredFile(distDir, 'manifest.webmanifest'),
    readRequiredFile(distDir, 'offline.html'),
    readRequiredFile(distDir, 'service-worker.js'),
  ]);
  const manifest = JSON.parse(manifestText);

  const requiredHtml = [
    '<link rel="manifest" href="/manifest.webmanifest">',
    '<meta name="theme-color" content="#1B2B5E">',
    'apple-mobile-web-app-capable',
    "navigator.serviceWorker.register('/service-worker.js')",
  ];
  for (const snippet of requiredHtml) {
    if (!html.includes(snippet)) throw new Error(`index.html is missing ${snippet}`);
  }

  if (manifest.name !== 'Oasis Portal') throw new Error('manifest.webmanifest has the wrong name');
  if (manifest.display !== 'standalone')
    throw new Error('manifest.webmanifest must use standalone display');
  await assertManifestIconsExist(distDir, manifest);
  if (!offlineHtml.includes('Oasis Portal is offline')) {
    throw new Error('offline.html does not contain the offline fallback copy');
  }
  if (!serviceWorker.includes('/offline.html')) {
    throw new Error('service-worker.js does not include offline.html');
  }
  const precache = JSON.parse(
    serviceWorker.match(/const PRECACHE_URLS = (\[[\s\S]*?\]);/)?.[1] ?? '[]',
  );
  if (
    !Array.isArray(precache) ||
    precache.some(
      (entry) => typeof entry === 'string' && (/^\/api\//.test(entry) || /trpc/i.test(entry)),
    )
  ) {
    throw new Error('service-worker.js must not cache API or tRPC responses');
  }

  return {
    hasOfflineFallback: true,
    hasServiceWorker: true,
    manifest,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const distDir = process.argv[2] ? path.resolve(process.argv[2]) : defaultDistDir;
  checkPwaExport(distDir)
    .then(() => {
      console.log(`PWA export verified: ${distDir}`);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

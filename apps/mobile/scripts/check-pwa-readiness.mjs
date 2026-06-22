import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const projectRoot = process.cwd();
const manifestPath = path.join(projectRoot, 'public', 'manifest.json');
const appConfigPath = path.join(projectRoot, 'app.json');
const serviceWorkerScriptPath = path.join(projectRoot, 'scripts', 'generate-service-worker.mjs');
const htmlShellPath = path.join(projectRoot, 'app', '+html.tsx');
const installButtonPath = path.join(
  projectRoot,
  'src',
  'components',
  'pwa',
  'install-app-button.tsx',
);

const failures = [];
const expectedManifest = {
  background_color: '#EEF2F9',
  description: 'Staff, parent, and student mobile portal for Oasis Learning Centre.',
  display: 'standalone',
  id: '/',
  name: 'Oasis Learning Centre',
  orientation: 'portrait',
  scope: '/',
  short_name: 'Oasis',
  start_url: '/',
  theme_color: '#1B2B5E',
};

function fail(message) {
  failures.push(message);
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    fail(`${path.relative(projectRoot, filePath)} must be valid JSON: ${error.message}`);
    return null;
  }
}

function fileExists(filePath, description) {
  if (!fs.existsSync(filePath)) {
    fail(`${description} is missing at ${path.relative(projectRoot, filePath)}`);
    return false;
  }

  return true;
}

function checkAppConfig() {
  if (!fileExists(appConfigPath, 'Expo app config')) return;

  const appConfig = readJson(appConfigPath);
  const web = appConfig?.expo?.web;

  if (web?.bundler !== 'metro') fail('app.json expo.web.bundler must be "metro".');
  if (web?.output !== 'single') fail('app.json expo.web.output must be "single".');
  if (typeof web?.favicon !== 'string') fail('app.json expo.web.favicon must point to an icon.');
}

function checkManifest() {
  if (!fileExists(manifestPath, 'PWA manifest')) return;

  const manifest = readJson(manifestPath);
  if (!manifest) return;

  checkManifestMetadata(manifest, 'manifest.json');
}

function checkManifestMetadata(manifest, description) {
  for (const [field, expected] of Object.entries(expectedManifest)) {
    if (manifest[field] !== expected) {
      fail(`${description} ${field} must be "${expected}".`);
    }
  }

  const icons = Array.isArray(manifest.icons) ? manifest.icons : [];
  const hasIconSize = (size) => icons.some((icon) => icon.sizes === size && icon.src);
  const hasMaskable = icons.some(
    (icon) => typeof icon.purpose === 'string' && icon.purpose.includes('maskable'),
  );

  if (!hasIconSize('192x192')) fail(`${description} must include a 192x192 icon.`);
  if (!hasIconSize('512x512')) fail(`${description} must include a 512x512 icon.`);
  if (!hasMaskable) fail(`${description} must include at least one maskable icon.`);
}

function checkSourceFiles() {
  fileExists(serviceWorkerScriptPath, 'Workbox service-worker generation script');
  fileExists(htmlShellPath, 'Expo Router web HTML shell');
  fileExists(installButtonPath, 'Install app button component');
}

function checkServiceWorkerOutput(filePath) {
  const serviceWorker = fs.readFileSync(filePath, 'utf8');
  const hasOfflineNavigationFallback =
    serviceWorker.includes('NavigationRoute') &&
    serviceWorker.includes('createHandlerBoundToURL("/offline.html")');
  const hasApiNavigationDenylist =
    serviceWorker.includes('denylist') &&
    (/\/\^\\\/api\\\//.test(serviceWorker) || /\/api/.test(serviceWorker));
  const excludesApiRuntimeCaching =
    /!\w+\.pathname\.startsWith\(["']\/api\/["']\)/.test(serviceWorker) ||
    /!url\.pathname\.startsWith\(["']\/api\/["']\)/.test(serviceWorker);
  const explicitlyCachesApiRoute =
    /pathname\.startsWith\(["']\/api(?:\/trpc)?["']\)/.test(serviceWorker) &&
    !excludesApiRuntimeCaching;

  if (!hasOfflineNavigationFallback) {
    fail('Generated service worker must serve /offline.html as the navigation fallback.');
  }

  if (!hasApiNavigationDenylist || !excludesApiRuntimeCaching || explicitlyCachesApiRoute) {
    fail('Generated service worker must not cache API or tRPC routes.');
  }

  const notificationHandlerSnippets = [
    ["addEventListener('push'", 'listen for Web Push events'],
    ['showNotification', 'show browser notifications from push events'],
    ["addEventListener('notificationclick'", 'handle notification clicks'],
    ['clients.openWindow', 'open Oasis when a notification is clicked'],
  ];

  for (const [snippet, message] of notificationHandlerSnippets) {
    if (!serviceWorker.includes(snippet)) {
      fail(`Generated service worker must ${message}.`);
    }
  }
}

function checkOfflineFallback(filePath) {
  const html = fs.readFileSync(filePath, 'utf8');
  const privateOrRoleTerms = [
    'Parent Portal',
    'Student Portal',
    'Staff Portal',
    'Merit Wallet',
    'Joshua',
  ];

  if (privateOrRoleTerms.some((term) => html.includes(term))) {
    fail('Offline fallback must not include private or role-specific data.');
  }
}

function checkExportOutput() {
  const outputDir = process.argv[2];
  if (!outputDir) return;

  const absoluteOutputDir = path.resolve(projectRoot, outputDir);
  const outputIndexPath = path.join(absoluteOutputDir, 'index.html');
  const outputManifestPath = path.join(absoluteOutputDir, 'manifest.json');
  const outputServiceWorkerPath = path.join(absoluteOutputDir, 'service-worker.js');
  const outputOfflinePath = path.join(absoluteOutputDir, 'offline.html');

  if (fileExists(outputIndexPath, 'Exported web index')) {
    const html = fs.readFileSync(outputIndexPath, 'utf8');
    const expectedHtmlSnippets = [
      ['rel="manifest"', 'link the manifest'],
      ['href="/apple-touch-icon.png"', 'link the Apple touch icon'],
      ['href="/favicon.png"', 'link the favicon'],
      ['name="theme-color"', 'include theme-color'],
      ['content="#1B2B5E"', 'include the Oasis theme color'],
      ['name="apple-mobile-web-app-capable"', 'include iOS Home Screen capability tags'],
      ['name="apple-mobile-web-app-status-bar-style"', 'include iOS status bar metadata'],
      ['name="apple-mobile-web-app-title"', 'include iOS app title metadata'],
      [expectedManifest.description, 'include the app description'],
    ];

    for (const [snippet, message] of expectedHtmlSnippets) {
      if (!html.includes(snippet)) fail(`Exported index.html must ${message}.`);
    }
  }
  if (fileExists(outputManifestPath, 'Exported PWA manifest')) {
    const outputManifest = readJson(outputManifestPath);
    if (outputManifest) checkManifestMetadata(outputManifest, 'Exported manifest.json');
  }
  if (fileExists(outputServiceWorkerPath, 'Generated service worker')) {
    checkServiceWorkerOutput(outputServiceWorkerPath);
  }
  if (fileExists(outputOfflinePath, 'Offline fallback page')) {
    checkOfflineFallback(outputOfflinePath);
  }
}

checkAppConfig();
checkManifest();
checkSourceFiles();
checkExportOutput();

if (failures.length > 0) {
  console.error('PWA readiness check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('PWA readiness check passed.');

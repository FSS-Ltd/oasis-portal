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

  const requiredStringFields = [
    'name',
    'short_name',
    'start_url',
    'scope',
    'display',
    'background_color',
    'theme_color',
    'orientation',
  ];

  for (const field of requiredStringFields) {
    if (typeof manifest[field] !== 'string' || manifest[field].trim().length === 0) {
      fail(`manifest.json ${field} must be a non-empty string.`);
    }
  }

  if (manifest.display !== 'standalone') fail('manifest.json display must be "standalone".');
  if (manifest.orientation !== 'portrait') fail('manifest.json orientation must be "portrait".');

  const icons = Array.isArray(manifest.icons) ? manifest.icons : [];
  const hasIconSize = (size) => icons.some((icon) => icon.sizes === size && icon.src);
  const hasMaskable = icons.some(
    (icon) => typeof icon.purpose === 'string' && icon.purpose.includes('maskable'),
  );

  if (!hasIconSize('192x192')) fail('manifest.json must include a 192x192 icon.');
  if (!hasIconSize('512x512')) fail('manifest.json must include a 512x512 icon.');
  if (!hasMaskable) fail('manifest.json must include at least one maskable icon.');
}

function checkSourceFiles() {
  fileExists(serviceWorkerScriptPath, 'Workbox service-worker generation script');
  fileExists(htmlShellPath, 'Expo Router web HTML shell');
  fileExists(installButtonPath, 'Install app button component');
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
    if (!html.includes('rel="manifest"')) fail('Exported index.html must link the manifest.');
    if (!html.includes('apple-mobile-web-app-capable')) {
      fail('Exported index.html must include iOS Home Screen meta tags.');
    }
    if (!html.includes('theme-color')) fail('Exported index.html must include theme-color.');
  }
  fileExists(outputManifestPath, 'Exported PWA manifest');
  fileExists(outputServiceWorkerPath, 'Generated service worker');
  fileExists(outputOfflinePath, 'Offline fallback page');
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

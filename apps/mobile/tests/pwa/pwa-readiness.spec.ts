import { expect, test } from '@playwright/test';

test('serves a valid installable manifest', async ({ request }) => {
  const response = await request.get('/manifest.json');
  expect(response.ok()).toBe(true);

  const manifest = (await response.json()) as {
    display?: string;
    icons?: Array<{ purpose?: string; sizes?: string; src?: string }>;
    name?: string;
    start_url?: string;
  };

  expect(manifest.name).toBe('Oasis Learning Centre');
  expect(manifest.display).toBe('standalone');
  expect(manifest.start_url).toBe('/');
  expect(manifest.icons?.some((icon) => icon.sizes === '192x192' && icon.src)).toBe(true);
  expect(manifest.icons?.some((icon) => icon.sizes === '512x512' && icon.src)).toBe(true);
  expect(manifest.icons?.some((icon) => icon.purpose?.includes('maskable'))).toBe(true);
});

test('registers the generated service worker', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Staff and family mobile portal')).toBeVisible();

  const registered = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return false;

    const ready = await Promise.race([
      navigator.serviceWorker.ready.then(() => true),
      new Promise<boolean>((resolve) => {
        setTimeout(() => {
          resolve(false);
        }, 5000);
      }),
    ]);
    const registrations = await navigator.serviceWorker.getRegistrations();

    return (
      ready &&
      registrations.some((registration) =>
        [registration.active, registration.installing, registration.waiting].some((worker) =>
          worker?.scriptURL.endsWith('/service-worker.js'),
        ),
      )
    );
  });

  expect(registered).toBe(true);
});

test('shows Chromium install prompt UI only after beforeinstallprompt', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Staff and family mobile portal')).toBeVisible();
  await expect(page.getByText('Install Oasis', { exact: true })).toBeHidden();

  await page.evaluate(() => {
    const event = new Event('beforeinstallprompt') as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: 'accepted'; platform: string }>;
    };
    event.prompt = () => Promise.resolve();
    event.userChoice = Promise.resolve({ outcome: 'accepted', platform: 'web' });
    window.dispatchEvent(event);
  });

  await expect(page.getByText('Install Oasis', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Install app' }).click();
  await expect(page.getByText('Install Oasis', { exact: true })).toBeHidden();
});

test('hides install prompt in standalone display mode', async ({ page }) => {
  await page.addInitScript(() => {
    const nativeMatchMedia = window.matchMedia.bind(window);

    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: (query: string) => {
        if (query === '(display-mode: standalone)') {
          return {
            addEventListener: () => undefined,
            addListener: () => undefined,
            dispatchEvent: () => false,
            matches: true,
            media: query,
            onchange: null,
            removeEventListener: () => undefined,
            removeListener: () => undefined,
          };
        }

        return nativeMatchMedia(query);
      },
    });
  });

  await page.goto('/');
  await page.evaluate(() => {
    const event = new Event('beforeinstallprompt') as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: 'accepted'; platform: string }>;
    };
    event.prompt = () => Promise.resolve();
    event.userChoice = Promise.resolve({ outcome: 'accepted', platform: 'web' });
    window.dispatchEvent(event);
  });

  await expect(page.getByText('Install Oasis', { exact: true })).toBeHidden();
});

test('serves an offline fallback without private user data', async ({ request }) => {
  const response = await request.get('/offline.html');
  expect(response.ok()).toBe(true);

  const html = await response.text();
  expect(html).toContain('Oasis needs an internet connection');
  expect(html).not.toContain('Joshua');
  expect(html).not.toContain('Merit Wallet');
  expect(html).not.toContain('Parent');
});

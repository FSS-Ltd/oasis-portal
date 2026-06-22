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

test('serves an offline fallback without private user data', async ({ request }) => {
  const response = await request.get('/offline.html');
  expect(response.ok()).toBe(true);

  const html = await response.text();
  expect(html).toContain('Oasis needs an internet connection');
  expect(html).not.toContain('Joshua');
  expect(html).not.toContain('Merit Wallet');
  expect(html).not.toContain('Parent');
});

test('serves the offline shell for navigation requests while offline', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Staff and family mobile portal')).toBeVisible();

  const registered = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return false;

    await navigator.serviceWorker.ready;
    return true;
  });
  expect(registered).toBe(true);

  await page.context().setOffline(true);
  try {
    await page.goto('/offline-navigation-check');
    await expect(page.getByText('Oasis needs an internet connection')).toBeVisible();
  } finally {
    await page.context().setOffline(false);
  }
});

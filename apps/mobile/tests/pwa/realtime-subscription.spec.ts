import { expect, test } from '@playwright/test';

// Point this saved Clerk browser session at a dedicated test environment. No data is mutated.
const storageState = process.env.OASIS_REALTIME_TEST_STORAGE_STATE;
if (storageState) test.use({ storageState });

test('authenticated PWA stays idle and catches up after a transport reconnect', async ({
  page,
}) => {
  test.skip(
    !storageState,
    'Requires a saved Clerk session for the dedicated realtime test environment.',
  );
  test.setTimeout(150_000);
  let joins = 0;
  let applicationReads = 0;
  page.on('websocket', (socket) => {
    if (!socket.url().includes('/realtime/v1/websocket')) return;
    socket.on('framesent', ({ payload }) => {
      const frame = String(payload);
      if (frame.includes('phx_join') && frame.includes('oasis:user:')) joins += 1;
    });
  });
  page.on('request', (request) => {
    if (request.method() === 'GET' && request.url().includes('/trpc/')) applicationReads += 1;
  });
  await page.goto('/');
  await expect.poll(() => joins).toBeGreaterThan(0);
  await expect(page.getByText('Connecting live updates…')).toBeHidden();
  await expect(
    page.getByText('Live updates unavailable. Information may be out of date.'),
  ).toBeHidden();
  // Exceeds the removed 30-second report interval. Transport heartbeats do not count as reads.
  const idleReads = applicationReads;
  await page.waitForTimeout(35_000);
  expect(applicationReads).toBe(idleReads);
  const initialJoins = joins;
  await page.context().setOffline(true);
  await expect(
    page.getByText('Live updates unavailable. Information may be out of date.'),
  ).toBeVisible({ timeout: 65_000 });
  await page.context().setOffline(false);
  await expect.poll(() => joins, { timeout: 40_000 }).toBeGreaterThan(initialJoins);
  await expect.poll(() => applicationReads, { timeout: 15_000 }).toBeGreaterThan(idleReads);
  await expect(
    page.getByText('Live updates unavailable. Information may be out of date.'),
  ).toBeHidden();
});

import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { signIn } from './helpers/auth';

const enabled = process.env.E2E_REALTIME === '1';
const headEmail = process.env.E2E_HEAD_EMAIL;
const headPassword = process.env.E2E_HEAD_PASSWORD;

// This suite creates and deletes real data. Require an explicitly isolated local
// app backed by the exact dedicated database selected by the test operator.
function assertDedicatedEnvironment(): void {
  const dedicatedUrl = process.env.E2E_REALTIME_TEST_DATABASE_URL;
  if (!dedicatedUrl || dedicatedUrl !== process.env.DATABASE_URL) {
    throw new Error(
      'E2E_REALTIME_TEST_DATABASE_URL must match DATABASE_URL for the dedicated test app.',
    );
  }
  const app = new URL(process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000');
  if (!['localhost', '127.0.0.1', '[::1]'].includes(app.hostname)) {
    throw new Error(
      'Realtime mutation tests require a local app connected to the dedicated test database.',
    );
  }
}

test.describe('real committed realtime delivery', () => {
  test.skip(
    !enabled || !headEmail || !headPassword,
    'Requires E2E_REALTIME=1, dedicated database configuration, and E2E_HEAD credentials.',
  );
  test.setTimeout(150_000);

  test('two clients receive create/update/delete, reconnect catchup, preserve drafts, and stay idle', async ({
    page: writer,
    browser,
  }) => {
    assertDedicatedEnvironment();
    const { prisma } = await import('@oasis/db');
    const title = `Realtime verification ${randomUUID()}`;
    let taskId: string | undefined;
    let ownerId: string | undefined;
    await signIn(writer, headEmail ?? '', headPassword ?? '');
    await writer.goto('/admin/tasks');
    await expect(writer.getByRole('heading', { name: 'My tasks', exact: true })).toBeVisible();
    const readerContext = await browser.newContext({
      storageState: await writer.context().storageState(),
    });
    const reader = await readerContext.newPage();
    try {
      const subscribed = reader.waitForEvent('websocket').then((socket) =>
        socket.waitForEvent('framereceived', {
          predicate: ({ payload }) => {
            const message = payload.toString();
            return (
              message.includes('oasis:user:') &&
              message.includes('phx_reply') &&
              message.includes('"ok"')
            );
          },
        }),
      );
      await reader.goto('/admin/tasks');
      await subscribed;
      await expect(reader.getByRole('heading', { name: 'My tasks', exact: true })).toBeVisible();
      const draft = reader.getByPlaceholder('e.g. Prepare materials for afternoon group');
      await draft.fill('Keep this unsaved draft');
      await writer.getByPlaceholder('e.g. Prepare materials for afternoon group').fill(title);
      await writer.getByRole('button', { name: 'Add task', exact: true }).click();
      await expect(reader.getByRole('heading', { name: title, exact: true })).toBeVisible();
      await expect(draft).toHaveValue('Keep this unsaved draft');
      const saved = await prisma.personalTask.findFirstOrThrow({
        where: { title },
        select: { id: true, ownerId: true },
      });
      taskId = saved.id;
      ownerId = saved.ownerId;

      await writer.getByRole('button', { name: `Mark ${title} as complete`, exact: true }).click();
      await expect(
        reader.getByRole('button', { name: `Mark ${title} as incomplete`, exact: true }),
      ).toHaveAttribute('aria-pressed', 'true');
      await readerContext.setOffline(true);
      await writer
        .getByRole('button', { name: `Mark ${title} as incomplete`, exact: true })
        .click();
      await expect(
        writer.getByRole('button', { name: `Mark ${title} as complete`, exact: true }),
      ).toHaveAttribute('aria-pressed', 'false');
      await readerContext.setOffline(false);
      await expect(
        reader.getByRole('button', { name: `Mark ${title} as complete`, exact: true }),
      ).toHaveAttribute('aria-pressed', 'false');
      await expect(draft).toHaveValue('Keep this unsaved draft');

      // Exercise a committed administrative deletion, not a mocked browser event.
      await prisma.personalTask.deleteMany({ where: { id: taskId, ownerId, title } });
      taskId = undefined;
      await expect(reader.getByRole('heading', { name: title, exact: true })).toHaveCount(0);
      await expect(draft).toHaveValue('Keep this unsaved draft');
      await reader.waitForLoadState('networkidle');
      let idleDataReads = 0;
      reader.on('request', (request) => {
        if (request.method() === 'GET' && request.url().includes('/api/trpc/')) idleDataReads++;
      });
      // Deliberate observation window exceeds the removed report polling interval.
      await reader.waitForTimeout(32_000);
      expect(idleDataReads).toBe(0);
    } finally {
      await readerContext.close();
      if (taskId && ownerId)
        await prisma.personalTask.deleteMany({ where: { id: taskId, ownerId, title } });
      await prisma.$disconnect();
    }
  });
});

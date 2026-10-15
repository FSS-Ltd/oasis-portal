import { expect, test, type Page, type Route } from '@playwright/test';

const headEmail = process.env.E2E_HEAD_EMAIL;
const headPassword = process.env.E2E_HEAD_PASSWORD;

test.use(
  process.env.E2E_CHROME_EXECUTABLE
    ? { launchOptions: { executablePath: process.env.E2E_CHROME_EXECUTABLE } }
    : {},
);

async function signInHead(page: Page): Promise<void> {
  await page.goto('/sign-in');
  await page.getByLabel(/email/i).fill(headEmail ?? '');
  await page.getByRole('textbox', { name: 'Password' }).fill(headPassword ?? '');
  await page.getByRole('button', { name: /^continue$/i }).click();
  await page.waitForURL(
    /admin|supervisor|parent|registration|children-check|dashboard|2fa|not-ready|factor-two/,
    { timeout: 30_000 },
  );
  test.skip(page.url().includes('/factor-two'), 'Head test account requires interactive 2FA');
}

test.describe('PACE Inventory bulk order actions', () => {
  test.skip(!headEmail || !headPassword, 'Set E2E_HEAD_EMAIL and E2E_HEAD_PASSWORD to run');

  for (const viewport of [
    { name: 'desktop', width: 1280, height: 900 },
    { name: 'phone', width: 390, height: 844 },
  ]) {
    test(`moves selected eligible orders through transit and delivery on ${viewport.name}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await signInHead(page);

      const statuses = new Map([
        ['bulk_1', 'Ordered'],
        ['bulk_2', 'Ordered'],
        ['bulk_3', 'InTransit'],
      ]);
      const submitted: Array<{ action: string; ids: string[] }> = [];
      const orders = () =>
        [...statuses].map(([id, status], index) => ({
          id,
          status,
          studentId: 'student_1',
          subjectId: 'subject_1',
          paceNumber: 1013 + index,
          orderedAt: '2026-10-13T09:00:00.000Z',
          createdAt: '2026-10-13T09:00:00.000Z',
          updatedAt: '2026-10-13T09:00:00.000Z',
        }));
      const fulfill = async (route: Route, value: unknown) => {
        await route.fulfill({ json: [{ result: { data: { json: value } } }] });
      };

      await page.route('**/api/trpc/academicInventory.summary*', async (route) => {
        const rows = orders();
        await fulfill(route, {
          alerts: [],
          diagnostics: [],
          supply: [],
          orders: rows,
          students: [
            {
              id: 'student_1',
              fullName: 'Ada Learner',
              yearGroup: 'Year 6',
              subjects: [
                {
                  id: 'assignment_1',
                  studentId: 'student_1',
                  subjectId: 'subject_1',
                  currentPaceNumber: 1011,
                  subject: { id: 'subject_1', code: 'MA', name: 'Maths', active: true },
                },
              ],
            },
          ],
          orderCountsByStudent: ['Ordered', 'InTransit', 'Delivered'].map((status) => ({
            studentId: 'student_1',
            status,
            _count: { _all: rows.filter((row) => row.status === status).length },
          })),
        });
      });
      await page.route('**/api/trpc/academicInventory.ordersForStudent*', async (route) => {
        const rows = orders().filter((order) => order.status !== 'Delivered');
        await fulfill(route, {
          rows,
          totalRows: rows.length,
          page: 1,
          pageSize: 10,
          totalPages: 1,
        });
      });
      for (const [procedure, nextStatus] of [
        ['markOrdersInTransit', 'InTransit'],
        ['markOrdersDelivered', 'Delivered'],
      ] as const) {
        await page.route(`**/api/trpc/academicInventory.${procedure}*`, async (route) => {
          const body = route.request().postData() ?? '';
          const ids = [...statuses.keys()].filter((id) => body.includes(id));
          submitted.push({ action: procedure, ids });
          for (const id of ids) statuses.set(id, nextStatus);
          await fulfill(route, { count: ids.length });
        });
      }

      await page.goto('/admin/pace/inventory');
      await page.getByRole('tab', { name: /^Orders$/ }).click();
      await expect(page.getByRole('button', { name: /Ada Learner/ })).toBeVisible();
      await page.getByRole('button', { name: /Ada Learner/ }).click();
      await page.getByRole('checkbox', { name: 'Select all 3 matching orders' }).check();
      await expect(page.getByRole('button', { name: 'Mark 2 in transit' })).toBeEnabled();
      await expect(page.getByRole('button', { name: 'Mark 1 delivered' })).toBeEnabled();
      await page.getByRole('button', { name: 'Mark 2 in transit' }).click();
      await expect
        .poll(() => submitted[0])
        .toEqual({
          action: 'markOrdersInTransit',
          ids: ['bulk_1', 'bulk_2'],
        });
      await page.getByRole('button', { name: 'Mark 1 delivered' }).click();
      await expect
        .poll(() => submitted[1])
        .toEqual({
          action: 'markOrdersDelivered',
          ids: ['bulk_3'],
        });
    });
  }
});

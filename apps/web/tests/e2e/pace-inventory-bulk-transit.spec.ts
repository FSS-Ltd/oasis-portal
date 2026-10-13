import { expect, test, type Page } from '@playwright/test';

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
    {
      timeout: 30_000,
    },
  );
  test.skip(page.url().includes('/factor-two'), 'Head test account requires interactive 2FA');
}

test.describe('PACE Inventory bulk transit', () => {
  test.skip(!headEmail || !headPassword, 'Set E2E_HEAD_EMAIL and E2E_HEAD_PASSWORD to run');

  for (const viewport of [
    { name: 'desktop', width: 1280, height: 900 },
    { name: 'phone', width: 390, height: 844 },
  ]) {
    test(`selects all eligible orders and marks them in transit on ${viewport.name}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await signInHead(page);

      let marked = false;
      let submittedOrderIds: string[] = [];
      const orders = [
        { id: 'bulk_1', paceNumber: 1013, status: 'Ordered' },
        { id: 'bulk_2', paceNumber: 1014, status: 'Ordered' },
        { id: 'bulk_3', paceNumber: 1015, status: 'InTransit' },
      ];
      await page.route('**/api/trpc/academicInventory.summary*', async (route) => {
        await route.fulfill({
          json: [
            {
              result: {
                data: {
                  json: {
                    alerts: [],
                    diagnostics: [],
                    students: [],
                    supply: [],
                    orders: orders.map((order) => ({
                      ...order,
                      studentId: 'student_1',
                      subjectId: 'subject_1',
                      orderedAt: '2026-10-13T09:00:00.000Z',
                      status: marked && order.status === 'Ordered' ? 'InTransit' : order.status,
                    })),
                  },
                },
              },
            },
          ],
        });
      });
      await page.route('**/api/trpc/academicInventory.markOrdersInTransit*', async (route) => {
        const body = route.request().postData() ?? '';
        submittedOrderIds = orders
          .filter((order) => body.includes(order.id))
          .map((order) => order.id);
        marked = true;
        await route.fulfill({ json: [{ result: { data: { json: { count: 2 } } } }] });
      });

      await page.goto('/admin/pace/inventory');
      const selectAll = page.getByRole('checkbox', { name: 'Select all' });
      await expect(selectAll).toBeVisible();
      await page.getByRole('checkbox', { name: /Select PACE #1013/ }).check();
      await expect(page.getByText('1 order selected')).toBeVisible();
      await expect(selectAll).toHaveJSProperty('indeterminate', true);
      await page.getByRole('button', { name: 'Clear selection' }).click();
      await expect(page.getByText('0 orders selected')).toBeVisible();
      await selectAll.check();
      await expect(page.getByText('2 orders selected')).toBeVisible();
      await expect(page.getByRole('checkbox', { name: /Select PACE #1013/ })).toBeChecked();
      await expect(page.getByRole('checkbox', { name: /Select PACE #1014/ })).toBeChecked();
      await expect(page.getByRole('checkbox', { name: /Select PACE #1015/ })).toHaveCount(0);
      await page.getByRole('button', { name: 'Mark selected in transit' }).click();
      await expect.poll(() => submittedOrderIds).toEqual(['bulk_1', 'bulk_2']);
      await expect(page.getByText('0 orders selected')).toBeVisible();
      await expect(selectAll).toBeDisabled();
    });
  }
});

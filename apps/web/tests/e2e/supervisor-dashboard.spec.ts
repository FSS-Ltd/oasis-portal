import { expect, test } from '@playwright/test';

const headEmail = process.env.E2E_HEAD_EMAIL;
const headPassword = process.env.E2E_HEAD_PASSWORD;
const parentEmail = process.env.E2E_PARENT_EMAIL;
const parentPassword = process.env.E2E_PARENT_PASSWORD;
const supervisorEmail = process.env.E2E_SUPERVISOR_EMAIL;
const supervisorPassword = process.env.E2E_SUPERVISOR_PASSWORD;
const exporterEmail = process.env.E2E_EXPORTER_EMAIL;
const exporterPassword = process.env.E2E_EXPORTER_PASSWORD;

async function signIn(page: import('@playwright/test').Page, email: string, password: string) {
  await page.goto('/sign-in');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /continue|sign in/i }).click();
  await page.waitForURL(/admin|supervisor|dashboard|2fa|not-ready/, { timeout: 30_000 });
}

test.describe('Supervisor dashboard shell', () => {
  const headTest = headEmail && headPassword ? test : test.skip;
  const supervisorTest = supervisorEmail && supervisorPassword ? test : test.skip;
  const parentTest = parentEmail && parentPassword ? test : test.skip;

  headTest('full-admin can load the supervisor shell', async ({ page }) => {
    await signIn(page, headEmail!, headPassword!);
    await expect(page).toHaveURL(/admin/);
    await page.goto('/supervisor');
    await expect(page.getByRole('heading', { name: /daily dashboard/i })).toBeVisible();
    await expect(page.getByText(/attendance capture/i)).toBeVisible();
    await expect(page.getByText(/weekly availability/i)).toBeVisible();
    await expect(page.getByText(/request shift swap/i)).toBeVisible();
  });

  supervisorTest('Supervisor can mark attendance, filter bands, and submit availability', async ({ page }) => {
    await signIn(page, supervisorEmail!, supervisorPassword!);
    await expect(page).toHaveURL(/supervisor/);
    await expect(page).not.toHaveURL(/admin/);
    await expect(page.getByRole('heading', { name: /daily dashboard/i })).toBeVisible();
    await expect(page.getByText(/attendance capture/i)).toBeVisible();
    await expect(page.getByText(/your rota/i)).toBeVisible();
    await expect(page.getByText(/weekly availability/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /export csv/i })).toHaveCount(0);

    await page.getByLabel('Year-group band filter').selectOption('all');
    await page.getByLabel('Year-group band filter').selectOption('__unbanded');
    await page.getByLabel('Year-group band filter').selectOption('all');

    const firstAttendanceRow = page.locator('.attendance-table tbody tr').first();
    if ((await firstAttendanceRow.count()) > 0) {
      await firstAttendanceRow.getByRole('button', { name: 'Present' }).click();
      await expect(firstAttendanceRow.getByText('Present').first()).toBeVisible();
    }

    await page.getByRole('button', { name: /add/i }).click();
    await page.getByLabel('Availability day').last().selectOption('1');
    await page.getByLabel('Availability start time').last().fill('09:00');
    await page.getByLabel('Availability end time').last().fill('12:00');
    await page.getByRole('button', { name: /save availability/i }).click();
    await expect(page.getByText(/availability saved/i)).toBeVisible();
  });

  headTest('staff shells expose logout and return to sign-in', async ({ page }) => {
    await signIn(page, headEmail!, headPassword!);
    await page.goto('/admin');
    await expect(page.getByRole('button', { name: /log out/i }).first()).toBeVisible();
    await page.getByRole('button', { name: /log out/i }).first().click();
    await page.waitForURL(/sign-in/, { timeout: 30_000 });
  });

  const exporterTest = exporterEmail && exporterPassword ? test : test.skip;

  exporterTest('attendance-exporter users can see the daily CSV export', async ({ page }) => {
    await signIn(page, exporterEmail!, exporterPassword!);
    await expect(page).toHaveURL(/supervisor/);
    await expect(page.getByRole('button', { name: /export csv/i })).toBeVisible();
  });

  parentTest('non-staff users cannot access the supervisor shell', async ({ page }) => {
    await signIn(page, parentEmail!, parentPassword!);
    await expect(page).toHaveURL(/not-ready/);
    await page.goto('/supervisor');
    await expect(page.getByRole('heading', { name: /daily dashboard/i })).toHaveCount(0);
  });

  test('unauthenticated supervisor access requires sign-in', async ({ page }) => {
    await page.goto('/supervisor');
    await page.waitForURL(/sign-in/, { timeout: 30_000 });
  });
});

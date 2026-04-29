import { expect, test } from '@playwright/test';

const headEmail = process.env.E2E_HEAD_EMAIL;
const headPassword = process.env.E2E_HEAD_PASSWORD;
const parentEmail = process.env.E2E_PARENT_EMAIL;
const parentPassword = process.env.E2E_PARENT_PASSWORD;
const supervisorEmail = process.env.E2E_SUPERVISOR_EMAIL;
const supervisorPassword = process.env.E2E_SUPERVISOR_PASSWORD;

async function signIn(page: import('@playwright/test').Page, email: string, password: string) {
  await page.goto('/sign-in');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /continue|sign in/i }).click();
  await page.waitForURL(/admin|supervisor|dashboard|2fa/, { timeout: 30_000 });
}

test.describe('Supervisor dashboard shell', () => {
  const headTest = headEmail && headPassword ? test : test.skip;
  const supervisorTest = supervisorEmail && supervisorPassword ? test : test.skip;
  const parentTest = parentEmail && parentPassword ? test : test.skip;

  headTest('full-admin can load the supervisor shell', async ({ page }) => {
    await signIn(page, headEmail!, headPassword!);
    await page.goto('/supervisor');
    await expect(page.getByRole('heading', { name: /daily dashboard/i })).toBeVisible();
    await expect(page.getByText(/today's students/i)).toBeVisible();
    await expect(page.getByText(/weekly availability/i)).toBeVisible();
    await expect(page.getByText(/request shift swap/i)).toBeVisible();
  });

  supervisorTest('Supervisor can load daily workflow sections and submit availability', async ({ page }) => {
    await signIn(page, supervisorEmail!, supervisorPassword!);
    await page.goto('/supervisor');
    await expect(page.getByRole('heading', { name: /daily dashboard/i })).toBeVisible();
    await expect(page.getByText(/today's students/i)).toBeVisible();
    await expect(page.getByText(/your rota/i)).toBeVisible();
    await expect(page.getByText(/weekly availability/i)).toBeVisible();
    await page.getByRole('button', { name: /add/i }).click();
    await page.getByLabel('Availability day').last().selectOption('1');
    await page.getByLabel('Availability start time').last().fill('09:00');
    await page.getByLabel('Availability end time').last().fill('12:00');
    await page.getByRole('button', { name: /save availability/i }).click();
    await expect(page.getByText(/availability saved/i)).toBeVisible();
  });

  parentTest('non-staff users cannot access the supervisor shell', async ({ page }) => {
    await signIn(page, parentEmail!, parentPassword!);
    await page.goto('/supervisor');
    await expect(page.getByRole('heading', { name: /daily dashboard/i })).toHaveCount(0);
  });
});

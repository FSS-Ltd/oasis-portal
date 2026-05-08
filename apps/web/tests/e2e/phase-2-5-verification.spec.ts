import { expect, test } from '@playwright/test';
import { signIn } from './helpers/auth';

const headEmail = process.env.E2E_HEAD_EMAIL;
const headPassword = process.env.E2E_HEAD_PASSWORD;
const supervisorEmail = process.env.E2E_SUPERVISOR_EMAIL;
const supervisorPassword = process.env.E2E_SUPERVISOR_PASSWORD;
const exporterEmail = process.env.E2E_EXPORTER_EMAIL;
const exporterPassword = process.env.E2E_EXPORTER_PASSWORD;

test.describe('Phase 2.5 access and export verification', () => {
  const headTest = headEmail && headPassword ? test : test.skip;
  const supervisorTest = supervisorEmail && supervisorPassword ? test : test.skip;
  const exporterTest = exporterEmail && exporterPassword ? test : test.skip;

  headTest('Head verifies People & Profiles attendance boundaries', async ({ page }) => {
    await signIn(page, headEmail!, headPassword!);

    await page.goto('/admin/staff');
    await expect(page.getByRole('heading', { name: /people & profiles/i })).toBeVisible();
    await expect(page.getByLabel(/people directory/i)).toBeVisible();

    const detail = page.locator('.people-profiles__detail');

    await page.getByRole('tab', { name: 'Students' }).click();
    const studentRows = page.locator('.people-directory-row');
    if ((await studentRows.count()) > 0) {
      await studentRows.first().click();
      await expect(detail.getByRole('tab', { name: 'Attendance' })).toBeVisible();
    }

    await page.getByRole('tab', { name: 'Supervisors' }).click();
    const supervisorRows = page.locator('.people-directory-row');
    if ((await supervisorRows.count()) > 0) {
      await supervisorRows.first().click();
      await expect(detail.getByRole('tab', { name: 'Attendance' })).toBeVisible();
    }

    await page.getByRole('tab', { name: 'Parents' }).click();
    const parentRows = page.locator('.people-directory-row');
    if ((await parentRows.count()) > 0) {
      await parentRows.first().click();
      await expect(detail.getByRole('tab', { name: 'Attendance' })).toHaveCount(0);
      await expect(detail.getByRole('button', { name: /export csv/i })).toHaveCount(0);
    }
  });

  supervisorTest('Supervisor cannot load People & Profiles', async ({ page }) => {
    await signIn(page, supervisorEmail!, supervisorPassword!);

    await page.goto('/admin/staff');
    await expect(page.getByRole('heading', { name: /people & profiles/i })).toHaveCount(0);
  });

  supervisorTest('ordinary Supervisor cannot load attendance export controls', async ({ page }) => {
    await signIn(page, supervisorEmail!, supervisorPassword!);

    await page.goto('/admin/attendance');
    await expect(page.getByRole('heading', { name: /export centre/i })).toHaveCount(0);
  });

  exporterTest('attendance-exporter can load attendance export controls', async ({ page }) => {
    await signIn(page, exporterEmail!, exporterPassword!);

    await page.goto('/admin/attendance');
    await expect(page.getByRole('heading', { name: /export centre/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /export csv/i })).toBeVisible();
  });
});

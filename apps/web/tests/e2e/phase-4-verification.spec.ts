import { expect, test } from '@playwright/test';
import { signIn } from './helpers/auth';

const headEmail = process.env.E2E_HEAD_EMAIL;
const headPassword = process.env.E2E_HEAD_PASSWORD;
const shopkeeperEmail = process.env.E2E_SHOPKEEPER_EMAIL;
const shopkeeperPassword = process.env.E2E_SHOPKEEPER_PASSWORD;
const parentEmail = process.env.E2E_PARENT_EMAIL;
const parentPassword = process.env.E2E_PARENT_PASSWORD;
const allowReportSend = process.env.E2E_ALLOW_REPORT_SEND === '1';

test.describe('Phase 4 verification suite', () => {
  const headTest = headEmail && headPassword ? test : test.skip;
  const shopkeeperTest = shopkeeperEmail && shopkeeperPassword ? test : test.skip;
  const parentTest = parentEmail && parentPassword ? test : test.skip;

  headTest('Head can reach shop controls and the report workspace', async ({ page }) => {
    await signIn(page, headEmail!, headPassword!);

    await page.goto('/admin/shop');
    await expect(page.getByRole('heading', { name: /^merit shop$/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /add item/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /record purchase/i })).toBeVisible();

    await page.goto('/admin/reports');
    await expect(page.getByRole('heading', { name: /^student reports$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /generate draft/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /^reports$/i })).toBeVisible();
  });

  headTest('Head can configure, draft, and review a student report', async ({ page }) => {
    test.skip(
      !allowReportSend,
      'Set E2E_ALLOW_REPORT_SEND=1 to run the mutating report draft/review/send smoke.',
    );

    await signIn(page, headEmail!, headPassword!);

    await page.goto('/admin/reports');
    await expect(page.getByRole('heading', { name: /^student reports$/i })).toBeVisible();

    const firstStudent = page.locator('.report-student-row').first();
    test.skip((await firstStudent.count()) === 0, 'No active student fixture exists.');

    await firstStudent.click();
    await page.getByLabel('Report Type').selectOption('Custom');
    await page.getByLabel('From').fill('2026-05-01');
    await page.getByLabel('To').fill('2026-05-31');
    await page.getByRole('checkbox', { name: 'General Notes' }).check();
    await page.getByRole('checkbox', { name: 'Behaviour Notes' }).uncheck();
    await page.getByRole('checkbox', { name: 'PACE Progress' }).uncheck();
    await expect(page.getByRole('checkbox', { name: 'PACE Status' })).toBeDisabled();
    await page.getByRole('checkbox', { name: 'PACE Progress' }).check();
    await page.getByRole('checkbox', { name: 'PACE Status' }).check();

    await page.getByRole('button', { name: /generate draft/i }).click();
    await expect(page.getByText('Draft generated.')).toBeVisible();
    await page.getByRole('button', { name: /add general note/i }).click();
    await page
      .locator('section[aria-labelledby="report-notes-title"] textarea')
      .last()
      .fill(`Phase 4 E2E general note ${String(Date.now())}`);
    await page
      .getByLabel('Progress Comment')
      .fill(`Phase 4 E2E progress comment ${String(Date.now())}`);
    await page.getByRole('button', { name: /save and review/i }).click();
    await expect(page.getByText('Report reviewed.')).toBeVisible();
    await expect(page.getByRole('link', { name: /download pdf/i })).toHaveAttribute(
      'href',
      /\/api\/reports\/[^/]+\/pdf$/u,
    );

    await page.getByRole('button', { name: /^send$/i }).click();
    await expect(page.getByText('Report sent.')).toBeVisible();
    await expect(page.getByText(/^sent$/i).first()).toBeVisible();
  });

  shopkeeperTest('Shopkeeper can reach purchase flow without item-management controls', async ({
    page,
  }) => {
    await signIn(page, shopkeeperEmail!, shopkeeperPassword!);

    await page.goto('/admin/shop');
    await expect(page.getByRole('heading', { name: /^merit shop$/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /record purchase/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /add item/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /confirm purchase/i })).toBeVisible();
  });

  parentTest('Parent can reach sent reports without draft or send controls', async ({ page }) => {
    await signIn(page, parentEmail!, parentPassword!);

    await page.goto('/parent/reports');
    await expect(page.getByRole('heading', { name: /^student reports$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /generate draft/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /save and review/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^send$/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /add (general|behaviour) note/i })).toHaveCount(0);

    const reportListItem = page.locator('.report-list__item').first();
    if ((await reportListItem.count()) === 0) {
      await expect(page.getByText(/No reports found|No linked children found/i).first()).toBeVisible();
      return;
    }

    await reportListItem.click();
    await expect(page.getByRole('link', { name: /download pdf/i })).toBeVisible();
  });
});

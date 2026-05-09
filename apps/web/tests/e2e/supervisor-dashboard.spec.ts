import { expect, test } from '@playwright/test';
import { signIn } from './helpers/auth';

const headEmail = process.env.E2E_HEAD_EMAIL;
const headPassword = process.env.E2E_HEAD_PASSWORD;
const parentEmail = process.env.E2E_PARENT_EMAIL;
const parentPassword = process.env.E2E_PARENT_PASSWORD;
const supervisorEmail = process.env.E2E_SUPERVISOR_EMAIL;
const supervisorPassword = process.env.E2E_SUPERVISOR_PASSWORD;
const exporterEmail = process.env.E2E_EXPORTER_EMAIL;
const exporterPassword = process.env.E2E_EXPORTER_PASSWORD;

test.describe('Supervisor dashboard shell', () => {
  const headTest = headEmail && headPassword ? test : test.skip;
  const supervisorTest = supervisorEmail && supervisorPassword ? test : test.skip;
  const parentTest = parentEmail && parentPassword ? test : test.skip;

  headTest('full-admin can load the supervisor shell', async ({ page }) => {
    await signIn(page, headEmail!, headPassword!);
    await expect(page).toHaveURL(/admin/);
    await page.goto('/supervisor');
    await expect(page.getByRole('heading', { name: /daily dashboard/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /this week/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /pending/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /notices/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /attendance/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /behaviour/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /PACE/i })).toBeVisible();
    await expect(page.getByText(/students marked today/i)).toHaveCount(0);
  });

  headTest('full-admin can compose and publish a staff notice', async ({ page }) => {
    await signIn(page, headEmail!, headPassword!);
    await expect(page).toHaveURL(/admin/);
    await page.goto('/admin/noticeboard');
    await expect(page.getByRole('heading', { name: /staff noticeboard/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /post a notice/i })).toBeVisible();

    const noticeTitle = `E2E staff notice ${Date.now()}`;
    await page.getByLabel('Notice title').fill(noticeTitle);
    await page.getByLabel('Notice body').fill('Staff noticeboard E2E verification.');
    await page.getByRole('button', { name: /post to noticeboard/i }).click();

    await expect(page.getByText(/notice posted/i)).toBeVisible();
    await expect(page.getByText(noticeTitle)).toBeVisible();
  });

  supervisorTest(
    'Supervisor can use focused attendance, behaviour, PACE, and rota pages',
    async ({ page }) => {
      await signIn(page, supervisorEmail!, supervisorPassword!);
      await expect(page).toHaveURL(/supervisor/);
      await expect(page).not.toHaveURL(/admin/);
      await expect(page.getByRole('heading', { name: /daily dashboard/i })).toBeVisible();
      await expect(page.getByRole('heading', { name: /this week/i })).toBeVisible();
      await expect(page.locator('.supervisor-day-card.is-today')).toHaveCount(1);
      await expect(page.getByText(/No shift scheduled/i).first()).toBeVisible();
      await expect(page.getByRole('heading', { name: /pending/i })).toBeVisible();
      await expect(page.getByRole('heading', { name: /notices/i })).toBeVisible();

      await page.goto('/supervisor/noticeboard');
      await expect(page.getByRole('heading', { name: /staff noticeboard/i })).toBeVisible();
      await expect(page.getByRole('heading', { name: /staff notices/i })).toBeVisible();
      const markReadButton = page.getByRole('button', { name: /mark .* as read/i }).first();
      if ((await markReadButton.count()) > 0) {
        await markReadButton.click();
        await expect(page.getByText(/^read$/i).first()).toBeVisible();
        await page.reload();
        await expect(page.getByText(/^read$/i).first()).toBeVisible();
      }

      await page.goto('/supervisor/attendance');
      await expect(page.getByRole('heading', { name: /attendance/i })).toBeVisible();
      await expect(page.getByText(/attendance capture/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /export csv/i })).toHaveCount(0);

      await page.getByLabel('Year-group band filter').selectOption('all');
      await page.getByLabel('Year-group band filter').selectOption('__unbanded');
      await page.getByLabel('Year-group band filter').selectOption('all');

      const firstAttendanceRow = page.locator('.attendance-table tbody tr').first();
      if ((await firstAttendanceRow.count()) > 0) {
        await firstAttendanceRow.getByRole('button', { name: 'Present' }).click();
        await expect(firstAttendanceRow.getByText('Present').first()).toBeVisible();
      }

      await page.goto('/supervisor/behaviour');
      await expect(page.getByRole('heading', { name: /behaviour/i })).toBeVisible();
      const selectedStudent = page.getByLabel('Selected student for behaviour');
      const selectedStudentOptions = await selectedStudent.locator('option').count();
      if (selectedStudentOptions > 1) {
        await selectedStudent.selectOption({ index: 1 });

        const generalCategory = `General conduct ${Date.now()}`;
        await page.getByLabel('Behaviour type').selectOption('Merit');
        await page.getByLabel('Behaviour visibility').selectOption('General');
        await page.getByLabel('Behaviour category').fill(generalCategory);
        await page.getByLabel('Merit amount').fill('2');
        await page.getByLabel('Behaviour note').fill('Helped another student settle into work.');
        await page.getByRole('button', { name: /save behaviour/i }).click();
        await expect(page.getByText(/behaviour saved/i)).toBeVisible();
        await expect(page.getByText(generalCategory)).toBeVisible();

        const sensitiveCategory = `Sensitive conduct ${Date.now()}`;
        await page.getByLabel('Behaviour visibility').selectOption('Sensitive');
        await page.getByLabel('Behaviour category').fill(sensitiveCategory);
        await page.getByLabel('Merit amount').fill('1');
        await page
          .getByLabel('Behaviour note')
          .fill('Sensitive note should not render for Supervisor.');
        await page.getByRole('button', { name: /save behaviour/i }).click();
        await expect(page.getByText(/Sensitive behaviour saved/i)).toBeVisible();
        await expect(page.getByText(sensitiveCategory)).toHaveCount(0);

        await page.goto('/supervisor/pace');
        await expect(page.getByRole('heading', { name: /PACE Progress/i })).toBeVisible();
        await expect(page.getByLabel('PACE student')).toBeVisible();
        const recordButton = page.getByRole('button', { name: /record new score/i });
        if (!(await recordButton.isDisabled())) {
          await recordButton.click();
          const subjectSelect = page.getByLabel('PACE subject');
          const subjectOptions = await subjectSelect.locator('option').count();
          if (subjectOptions > 0) {
            await subjectSelect.selectOption({ index: 0 });
            await page.getByRole('button', { name: /PACE Test/i }).click();
            await page.getByLabel('PACE score').fill('100');
            await page.getByRole('button', { name: /save score/i }).click();
            await expect(page.getByText(/PACE recorded|PACE score saved/i)).toBeVisible();
          }
        }
      }

      await page.goto('/supervisor/rota');
      await expect(page.getByRole('heading', { name: /rota/i })).toBeVisible();
      await expect(page.getByText(/weekly availability/i)).toBeVisible();
      await expect(page.getByText(/request shift swap/i)).toBeVisible();
      await page.getByRole('button', { name: /add/i }).click();
      await page.getByLabel('Availability day').last().selectOption('1');
      await page.getByLabel('Availability start time').last().fill('09:00');
      await page.getByLabel('Availability end time').last().fill('12:00');
      await page.getByRole('button', { name: /save availability/i }).click();
      await expect(page.getByText(/availability saved/i)).toBeVisible();
    },
  );

  headTest('staff shells expose logout and return to sign-in', async ({ page }) => {
    await signIn(page, headEmail!, headPassword!);
    await page.goto('/admin');
    await expect(page.getByRole('button', { name: /log out/i }).first()).toBeVisible();
    await page
      .getByRole('button', { name: /log out/i })
      .first()
      .click();
    await page.waitForURL(/sign-in/, { timeout: 30_000 });
  });

  const exporterTest = exporterEmail && exporterPassword ? test : test.skip;

  exporterTest('attendance-exporter users can see the daily CSV export', async ({ page }) => {
    await signIn(page, exporterEmail!, exporterPassword!);
    await expect(page).toHaveURL(/supervisor/);
    await page.goto('/supervisor/attendance');
    await expect(page.getByRole('button', { name: /export csv/i })).toBeVisible();
  });

  parentTest('non-staff users cannot access the supervisor shell', async ({ page }) => {
    await signIn(page, parentEmail!, parentPassword!);
    await expect(page).toHaveURL(/parent/);
    await page.goto('/supervisor');
    await expect(page.getByRole('heading', { name: /daily dashboard/i })).toHaveCount(0);
    await page.goto('/supervisor/noticeboard');
    await expect(page.getByRole('heading', { name: /staff noticeboard/i })).toHaveCount(0);
    await page.goto('/admin/noticeboard');
    await expect(page.getByRole('heading', { name: /staff noticeboard/i })).toHaveCount(0);
  });

  test('unauthenticated supervisor access requires sign-in', async ({ page }) => {
    await page.goto('/supervisor');
    await page.waitForURL(/sign-in/, { timeout: 30_000 });
  });

  test('unauthenticated post-sign-in handoff requires sign-in', async ({ page }) => {
    await page.goto('/post-sign-in');
    await page.waitForURL(/sign-in/, { timeout: 30_000 });
  });
});

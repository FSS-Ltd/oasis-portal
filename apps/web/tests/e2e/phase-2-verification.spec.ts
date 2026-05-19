import { expect, test } from '@playwright/test';
import { signIn } from './helpers/auth';

const headEmail = process.env.E2E_HEAD_EMAIL;
const headPassword = process.env.E2E_HEAD_PASSWORD;
const supervisorEmail = process.env.E2E_SUPERVISOR_EMAIL;
const supervisorPassword = process.env.E2E_SUPERVISOR_PASSWORD;

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

test.describe('Phase 2 verification suite', () => {
  const headTest = headEmail && headPassword ? test : test.skip;
  const workflowTest =
    headEmail && headPassword && supervisorEmail && supervisorPassword ? test : test.skip;

  headTest('Head verifies academic configuration and rota scheduling', async ({ page }) => {
    const unique = Date.now().toString(36);
    const bandName = `E2E Verify Band ${unique}`;
    const subjectCode = `V${unique}`.slice(0, 12).toUpperCase();
    const subjectName = `Verification Subject ${unique}`;
    const rotaNote = `Phase 2 verification shift ${unique}`;

    await signIn(page, headEmail!, headPassword!);

    await page.goto('/admin/academic');
    await expect(page.getByRole('heading', { name: /academic settings/i })).toBeVisible();

    await page.getByLabel('Band name').fill(bandName);
    await page.getByLabel('Band colour').fill('#166534');
    await page.getByLabel('Sort order').fill('98');
    await page.getByRole('checkbox', { name: 'Year 8' }).check();
    await page.getByRole('button', { name: /create band/i }).click();
    const bandRow = page.locator('.academic-row').filter({ hasText: bandName });
    await expect(bandRow).toContainText('#166534');

    await page.getByLabel('Subject code').fill(subjectCode);
    await page.getByLabel('Subject name').fill(subjectName);
    await page.getByRole('button', { name: /create subject/i }).click();
    await expect(page.locator('.academic-row').filter({ hasText: subjectCode })).toContainText(
      subjectName,
    );

    await page.getByLabel('Daily test limit').check();
    await page.getByLabel('Maximum tests per student per day').fill('20');
    await page.getByLabel('Same-day self/final block').uncheck();
    await page.getByLabel('Pass threshold').fill('80');
    await page.getByRole('button', { name: /save PACE policy/i }).click();
    await expect(page.getByText(/PACE policy saved/i)).toBeVisible();

    await page.goto('/admin/rota');
    await expect(page.getByRole('heading', { name: /^rota$/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /week rota/i })).toBeVisible();

    const supervisorSelect = page.getByLabel('Supervisor');
    const supervisorOptionCount = await supervisorSelect.locator('option').count();
    test.skip(supervisorOptionCount < 2, 'At least one staff user is required for rota scheduling');

    await supervisorSelect.selectOption({ index: 1 });
    await page.getByLabel('Year-group band').selectOption({ label: bandName });
    await page.getByLabel('Date').fill(todayKey());
    await page.getByLabel('Start time').fill('09:00');
    await page.getByLabel('End time').fill('12:00');
    await page.getByLabel('Notes').fill(rotaNote);
    await page.getByRole('button', { name: /create shift/i }).click();
    await expect(page.getByText(/shift saved/i)).toBeVisible();
    await expect(page.getByText(rotaNote)).toBeVisible();
  });

  workflowTest(
    'Supervisor daily workflow writes are visible to the audit viewer',
    async ({ page }) => {
      const unique = Date.now().toString(36);
      const behaviourCategory = `E2E General conduct ${unique}`;

      await signIn(page, supervisorEmail!, supervisorPassword!);
      await expect(page).toHaveURL(/supervisor/);

      await page.goto('/supervisor/rota');
      await expect(page.getByRole('heading', { name: /rota/i })).toBeVisible();
      await expect(page.getByText(/weekly availability/i)).toBeVisible();
      await expect(page.getByText(/request shift swap/i)).toBeVisible();

      await page.goto('/supervisor/attendance');
      await expect(page.getByRole('heading', { name: /attendance/i })).toBeVisible();
      const firstAttendanceRow = page.locator('.attendance-table tbody tr').first();
      test.skip(
        (await firstAttendanceRow.count()) === 0,
        'At least one active student is required for attendance verification',
      );

      await page.goto('/supervisor/behaviour');
      await expect(page.getByRole('heading', { name: /behaviour/i })).toBeVisible();
      const selectedStudent = page.getByRole('button', { name: /students selector/i });
      await selectedStudent.click();
      const selectedStudentOptions = page.locator('.behaviour-student-option input');
      test.skip(
        (await selectedStudentOptions.count()) === 0,
        'At least one active student is required for behaviour verification',
      );

      await page.goto('/supervisor/pace');
      await expect(page.getByRole('heading', { name: /PACE Progress/i })).toBeVisible();
      await expect(page.getByLabel('PACE student')).toBeVisible();
      const recordButton = page.getByRole('button', { name: /record new score/i });
      await expect(recordButton).toBeVisible();
      test.skip(
        await recordButton.isDisabled(),
        'At least one PACE student with an active subject is required for PACE verification',
      );

      await page.goto('/supervisor/attendance');
      await firstAttendanceRow.getByRole('button', { name: 'Present' }).click();
      await expect(firstAttendanceRow.getByText('Present').first()).toBeVisible();

      await page.goto('/supervisor/behaviour');
      await page.getByRole('button', { name: /students selector/i }).click();
      await page.locator('.behaviour-student-option input').first().check();
      await page.getByLabel('Behaviour type').selectOption('Merit');
      await page.getByLabel('Behaviour visibility').selectOption('General');
      await page.getByLabel('Behaviour category').fill(behaviourCategory);
      await page.getByLabel('Merit amount').fill('2');
      await page.getByLabel('Behaviour note').fill('Phase 2 verification behaviour entry.');
      await page.getByRole('button', { name: /save behaviour/i }).click();
      await expect(page.getByText(/behaviour saved/i)).toBeVisible();
      await expect(page.getByText(behaviourCategory)).toBeVisible();

      await page.goto('/supervisor/pace');
      await recordButton.click();
      await page.getByRole('button', { name: /self-test/i }).click();
      await page.getByLabel('PACE score').fill('99');
      await page.getByRole('button', { name: /save score/i }).click();
      await expect(
        page.getByText(/PACE recorded|PACE score saved|daily test limit|same PACE number/i),
      ).toBeVisible();

      await page
        .getByRole('button', { name: /log out/i })
        .first()
        .click();
      await page.waitForURL(/sign-in/, { timeout: 30_000 });

      await signIn(page, headEmail!, headPassword!);
      await page.goto('/admin/audit');
      await expect(page.getByRole('heading', { name: /audit log/i })).toBeVisible();
      await expect(page.getByText('Attendance').first()).toBeVisible();
      await expect(page.getByText('BehaviourEntry').first()).toBeVisible();
      await expect(page.getByText('PaceRecord').first()).toBeVisible();
    },
  );
});

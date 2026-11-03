import { expect, test } from '@playwright/test';
import { signIn } from './helpers/auth';

const headEmail = process.env.E2E_HEAD_EMAIL;
const headPassword = process.env.E2E_HEAD_PASSWORD;
const schoolDate = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  year: 'numeric',
  month: 'numeric',
}).formatToParts(new Date());
const schoolYear = Number(schoolDate.find((part) => part.type === 'year')?.value);
const schoolMonth = Number(schoolDate.find((part) => part.type === 'month')?.value);
const schoolYearStart = schoolYear - (schoolMonth < 9 ? 1 : 0);
const level8Dob = `${String(schoolYearStart - 13)}-04-10`;
const level9Dob = `${String(schoolYearStart - 14)}-04-10`;

test.describe('Head admin onboarding', () => {
  test.skip(!headEmail || !headPassword, 'Set E2E_HEAD_EMAIL and E2E_HEAD_PASSWORD to run');

  test('Head creates student, assigns Maths, invites parent, and links guardian', async ({
    page,
  }) => {
    const unique = Date.now().toString(36);
    const studentName = `E2E Student ${unique}`;
    const parentEmail = `parent.${unique}@example.com`;

    await signIn(page, headEmail!, headPassword!);

    await page.goto('/admin/students/new');
    await page.getByLabel('Full name').fill(studentName);
    await page.getByLabel('Email', { exact: true }).fill(`student.${unique}@example.com`);
    await page.getByLabel('Date of birth').fill(level8Dob);
    await expect(page.getByLabel('Level', { exact: true })).toHaveValue('Level 8');
    await page.getByLabel('Oasis start date').fill('2026-04-27');
    await page.getByRole('button', { name: /create student/i }).click();
    await expect(page.getByRole('heading', { name: studentName })).toBeVisible();

    await page.getByLabel('Assign subject').selectOption({ label: 'MATH - Mathematics' });
    await page.getByRole('button', { name: /assign subject/i }).click();
    await expect(page.getByText(/subject assignment updated/i)).toBeVisible();

    await page.goto('/admin/staff');
    await page.getByLabel('Email').fill(parentEmail);
    await page.getByLabel('Role').selectOption('Parent');
    await page.getByRole('button', { name: /send invitation/i }).click();
    await expect(page.getByText(/invitation sent/i)).toBeVisible();

    await page.goto('/admin/students');
    await page.getByLabel(/search students/i).fill(studentName);
    await page.getByRole('button', { name: /search/i }).click();
    await page.getByRole('link', { name: /open/i }).first().click();
    await page.getByLabel('Parent email').fill(parentEmail);
    await page.getByRole('button', { name: /search parent/i }).click();
    await page.getByLabel('Matched parent').selectOption({ index: 1 });
    await page.getByRole('button', { name: /link guardian/i }).click();
    await expect(page.getByText(/guardian linked|guardian already linked/i)).toBeVisible();
  });

  test('Head configures academic settings and current PACE', async ({ page }) => {
    const unique = Date.now().toString(36);
    const bandName = `E2E Band ${unique}`;
    const subjectCode = `E2E${unique}`.slice(0, 12).toUpperCase();
    const subjectName = `E2E Subject ${unique}`;
    const inactiveCode = `OLD${unique}`.slice(0, 12).toUpperCase();
    const studentName = `E2E Academic ${unique}`;

    await signIn(page, headEmail!, headPassword!);

    await page.goto('/admin/academic');
    await expect(page.getByRole('heading', { name: /academic settings/i })).toBeVisible();

    await page.getByLabel('Band name').fill(bandName);
    await page.getByLabel('Band colour').fill('#166534');
    await page.getByLabel('Sort order').fill('99');
    await page.getByRole('checkbox', { name: 'Level 8' }).check();
    await page.getByRole('button', { name: /create band/i }).click();
    const bandRow = page.locator('.academic-row').filter({ hasText: bandName });
    await expect(bandRow).toContainText('#166534');

    await bandRow.getByRole('button', { name: /edit/i }).click();
    await bandRow.getByLabel('Band colour').fill('#7D1C2C');
    await bandRow.getByRole('button', { name: /save band/i }).click();
    await expect(bandRow).toContainText('#7D1C2C');
    await bandRow.getByRole('button', { name: /deactivate/i }).click();
    await expect(bandRow.getByText(/inactive/i)).toBeVisible();

    await page.getByLabel('Subject code').fill(subjectCode);
    await page.getByLabel('Subject name').fill(subjectName);
    await page.getByRole('button', { name: /create subject/i }).click();
    const subjectRow = page.locator('.academic-row').filter({ hasText: subjectCode });
    await expect(subjectRow).toContainText(subjectName);

    await subjectRow.getByRole('button', { name: /edit/i }).click();
    await subjectRow.getByLabel(`${subjectCode} subject name`).fill(`${subjectName} Updated`);
    await subjectRow.getByRole('button', { name: /^save$/i }).click();
    await expect(subjectRow).toContainText(`${subjectName} Updated`);

    await page.getByLabel('Subject code').fill(inactiveCode);
    await page.getByLabel('Subject name').fill(`Inactive ${unique}`);
    await page.getByRole('button', { name: /create subject/i }).click();
    const inactiveSubjectRow = page.locator('.academic-row').filter({ hasText: inactiveCode });
    await inactiveSubjectRow.getByRole('button', { name: /deactivate/i }).click();
    await expect(inactiveSubjectRow.getByText(/inactive/i)).toBeVisible();

    await page.getByLabel('Daily test limit').check();
    await page.getByLabel('Maximum tests per student per day').fill('3');
    await page.getByLabel('Same-day self/final block').check();
    await page.getByLabel('Pass threshold').fill('85');
    await page.getByRole('button', { name: /save PACE policy/i }).click();
    await expect(page.getByText(/PACE policy saved/i)).toBeVisible();

    await page.goto('/admin/students/new');
    await page.getByLabel('Full name').fill(studentName);
    await page.getByLabel('Email', { exact: true }).fill(`student.${unique}@example.com`);
    await page.getByLabel('Date of birth').fill(level8Dob);
    await expect(page.getByLabel('Level', { exact: true })).toHaveValue('Level 8');
    await expect(page.getByLabel('Level', { exact: true })).toHaveJSProperty('readOnly', true);
    await page.getByLabel('Level mode').selectOption('manual');
    await page.getByLabel('Level', { exact: true }).selectOption('Year 3');
    await page.getByLabel('Date of birth').fill(level9Dob);
    await expect(page.getByLabel('Level', { exact: true })).toHaveValue('Year 3');
    await page.getByLabel('Level mode').selectOption('automatic');
    await expect(page.getByLabel('Level', { exact: true })).toHaveValue('Level 9');
    await page.getByLabel('Level mode').selectOption('manual');
    await page.getByLabel('Level', { exact: true }).selectOption('Year 3');
    await page.getByLabel('Oasis start date').fill('2026-04-27');
    await page.getByRole('button', { name: /create student/i }).click();
    await expect(page.getByRole('heading', { name: studentName })).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('Level mode')).toHaveValue('manual');
    await expect(page.getByLabel('Level', { exact: true })).toHaveValue('Year 3');

    await page
      .getByLabel('Assign subject')
      .selectOption({ label: `${subjectCode} - ${subjectName} Updated` });
    await page.getByLabel('Current PACE number').fill('1004');
    await page.getByRole('button', { name: /assign subject/i }).click();
    await expect(page.getByText(/subject assignment updated/i)).toBeVisible();

    await page.getByLabel(`${subjectCode} current PACE`).fill('1005');
    await page.getByRole('button', { name: /update PACE/i }).click();
    await expect(page.getByText(/current PACE updated/i)).toBeVisible();
  });
});

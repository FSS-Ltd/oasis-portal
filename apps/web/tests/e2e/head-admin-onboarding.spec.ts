import { expect, test } from '@playwright/test';

const headEmail = process.env.E2E_HEAD_EMAIL;
const headPassword = process.env.E2E_HEAD_PASSWORD;

test.describe('Head admin onboarding', () => {
  test.skip(!headEmail || !headPassword, 'Set E2E_HEAD_EMAIL and E2E_HEAD_PASSWORD to run');

  test('Head creates student, assigns Maths, invites parent, and links guardian', async ({
    page,
  }) => {
    const unique = Date.now().toString(36);
    const studentName = `E2E Student ${unique}`;
    const parentEmail = `parent.${unique}@example.com`;

    await page.goto('/sign-in');
    await page.getByLabel(/email/i).fill(headEmail ?? '');
    await page.getByLabel(/password/i).fill(headPassword ?? '');
    await page.getByRole('button', { name: /continue|sign in/i }).click();
    await page.waitForURL(/admin|dashboard|2fa/, { timeout: 30_000 });

    await page.goto('/admin/students/new');
    await page.getByLabel('Full name').fill(studentName);
    await page.getByLabel('Year group').fill('Year 8');
    await page.getByLabel('Date of birth').fill('2013-04-10');
    await page.getByLabel('Enrolment date').fill('2026-04-27');
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
});

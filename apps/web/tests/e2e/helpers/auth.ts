import type { Page } from '@playwright/test';

export async function signIn(page: Page, email: string, password: string) {
  await page.goto('/sign-in');
  await page.getByLabel(/email/i).fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.getByRole('button', { name: /^continue$/i }).click();
  await page.waitForURL(/admin|supervisor|parent|dashboard|2fa|not-ready/, { timeout: 30_000 });
}

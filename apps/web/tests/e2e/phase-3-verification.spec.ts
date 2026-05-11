import { expect, type Page, test } from '@playwright/test';

const headEmail = process.env.E2E_HEAD_EMAIL;
const headPassword = process.env.E2E_HEAD_PASSWORD;
const parentEmail = process.env.E2E_PARENT_EMAIL;
const parentPassword = process.env.E2E_PARENT_PASSWORD;

async function signInForPhase3(page: Page, email: string, password: string) {
  await page.goto('/sign-in');
  await page.getByLabel(/email/i).fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.getByRole('button', { name: /^continue$/i }).click();
  await page.waitForURL(/admin|supervisor|parent|registration|children-check|2fa|not-ready/, {
    timeout: 30_000,
  });
}

async function signOut(page: Page) {
  const logOutButton = page.getByRole('button', { name: /log out/i }).first();
  if ((await logOutButton.count()) === 0) {
    await page.goto('/sign-in');
    return;
  }

  await logOutButton.click();
  await page.waitForURL(/sign-in/, { timeout: 30_000 });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test.describe('Phase 3 verification suite', () => {
  const parentTest = parentEmail && parentPassword ? test : test.skip;
  const headAndParentTest =
    headEmail && headPassword && parentEmail && parentPassword ? test : test.skip;

  parentTest('Parent can reach the dashboard or registration state', async ({ page }) => {
    await signInForPhase3(page, parentEmail!, parentPassword!);

    if (new URL(page.url()).pathname.startsWith('/registration')) {
      await expect(page.getByRole('heading', { name: /child registration/i })).toBeVisible();
      await expect(page.getByLabel('Home address')).toBeVisible();
      return;
    }

    await page.goto('/parent');
    await expect(
      page
        .getByText(
          /Parent portal|Child registration needed|Registration submitted|No linked children found/,
        )
        .first(),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: /People & Profiles|Audit Log|User Access/i }),
    ).toHaveCount(0);

    const childDashboard = page.locator('.parent-child-dashboard').first();
    if ((await childDashboard.count()) > 0) {
      await expect(childDashboard).toBeVisible();
      await expect(page.getByText('Recent Attendance')).toBeVisible();
      await expect(page.getByText('PACE Progress')).toBeVisible();
      await expect(page.getByText('Recent Behaviour')).toBeVisible();
      await expect(page.getByText('Visible Notes')).toBeVisible();
      await expect(page.getByRole('link', { name: /open child view/i })).toBeVisible();
    }
  });

  parentTest(
    'Parent registration routes render safe states without duplicate submission',
    async ({ page }) => {
      await signInForPhase3(page, parentEmail!, parentPassword!);

      await page.goto('/registration');
      if (new URL(page.url()).pathname.startsWith('/registration')) {
        await expect(page.getByRole('heading', { name: /child registration/i })).toBeVisible();
        await expect(page.getByLabel('Home address')).toBeVisible();
      } else {
        await expect(page).toHaveURL(/parent/);
      }

      await page.goto('/parent/registration');
      await expect(page.getByRole('heading', { name: /registration details/i })).toBeVisible();

      const homeAddress = page.getByLabel('Home address');
      if ((await homeAddress.count()) > 0) {
        await expect(homeAddress).toBeVisible();
        await expect(page.getByRole('button', { name: /save registration/i })).toBeVisible();
        return;
      }

      await expect(page.getByText(/No submitted registration was found/i)).toBeVisible();
    },
  );

  headAndParentTest(
    'Head can publish a parent notice and Parent can mark it read',
    async ({ page }) => {
      const noticeTitle = `Phase 3 E2E parent notice ${Date.now()}`;

      await signInForPhase3(page, headEmail!, headPassword!);
      await page.goto('/admin/noticeboard');
      await expect(page.getByRole('heading', { name: /^noticeboard$/i })).toBeVisible();
      await expect(page.getByRole('heading', { name: /post a notice/i })).toBeVisible();

      await page.getByLabel('Notice title').fill(noticeTitle);
      await page.getByLabel('Notice body').fill('Phase 3 parent notice verification.');
      await page.getByLabel('Notice audience').selectOption('Parents');
      await page.getByRole('button', { name: /post to noticeboard/i }).click();

      await expect(page.getByText(/notice posted/i)).toBeVisible();
      await expect(page.getByText(noticeTitle)).toBeVisible();
      await signOut(page);

      await signInForPhase3(page, parentEmail!, parentPassword!);
      await page.goto('/parent/noticeboard');
      await expect(page.getByRole('heading', { name: /^noticeboard$/i })).toBeVisible();
      await expect(page.getByRole('heading', { name: /parent notices/i })).toBeVisible();
      await expect(page.getByRole('heading', { name: /post a notice/i })).toHaveCount(0);
      await expect(page.getByText(noticeTitle)).toBeVisible();

      const markReadButton = page
        .getByRole('button', { name: new RegExp(`Mark ${escapeRegExp(noticeTitle)} as read`, 'i') })
        .first();
      if ((await markReadButton.count()) > 0) {
        await markReadButton.click();
      }

      await expect(page.getByText(/^read$/i).first()).toBeVisible();
      await page.reload();
      await expect(page.getByText(/^read$/i).first()).toBeVisible();

      await page.goto('/admin/noticeboard');
      await expect(page.getByRole('heading', { name: /post a notice/i })).toHaveCount(0);
    },
  );

  headAndParentTest('Parent and Head can exchange a message thread', async ({ page }) => {
    const unique = Date.now();
    const subject = `Phase 3 E2E message ${unique}`;
    const parentMessage = `Parent verification message ${unique}`;
    const headReply = `Head verification reply ${unique}`;

    await signInForPhase3(page, parentEmail!, parentPassword!);
    await page.goto('/parent/messages');
    await expect(page.getByRole('heading', { name: /^messages$/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /new message/i })).toBeVisible();

    const recipientSelect = page.getByLabel('Message recipient');
    const noRecipients = page.getByText(/No message recipients are currently available/i);
    await expect(recipientSelect.or(noRecipients).first()).toBeVisible();
    if ((await noRecipients.count()) > 0) {
      test.skip(true, 'No parent message recipients are configured.');
    }

    const recipientCount = await recipientSelect.locator('option').count();
    test.skip(recipientCount === 0, 'No parent message recipients are configured.');

    await recipientSelect.selectOption({ index: 0 });
    await page.getByPlaceholder('What is this about?').fill(subject);
    await page.getByPlaceholder('Write your message...').fill(parentMessage);
    await page.getByRole('button', { name: /start thread/i }).click();
    await expect(page.getByText(subject)).toBeVisible();
    await expect(page.getByText(parentMessage)).toBeVisible();
    await signOut(page);

    await signInForPhase3(page, headEmail!, headPassword!);
    await page.goto('/admin/messages');
    await expect(page.getByRole('heading', { name: /^messages$/i })).toBeVisible();
    const adminThread = page.locator('.message-thread-row').filter({ hasText: subject }).first();
    await expect(adminThread).toBeVisible();
    await adminThread.click();
    await expect(page.getByText(parentMessage)).toBeVisible();
    await page.getByLabel('Message reply').fill(headReply);
    await page.getByRole('button', { name: /^send$/i }).click();
    await expect(page.getByText(headReply)).toBeVisible();
    await signOut(page);

    await signInForPhase3(page, parentEmail!, parentPassword!);
    await page.goto('/parent/messages');
    const parentThread = page.locator('.message-thread-row').filter({ hasText: subject }).first();
    await expect(parentThread).toBeVisible();
    await parentThread.click();
    await expect(page.getByText(parentMessage)).toBeVisible();
    await expect(page.getByText(headReply)).toBeVisible();
  });
});

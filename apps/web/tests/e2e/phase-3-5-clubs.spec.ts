import { expect, type Page, test } from '@playwright/test';
import { signIn } from './helpers/auth';

const headEmail = process.env.E2E_HEAD_EMAIL;
const headPassword = process.env.E2E_HEAD_PASSWORD;
const clubsAdminEmail = process.env.E2E_CLUBS_ADMIN_EMAIL;
const clubsAdminPassword = process.env.E2E_CLUBS_ADMIN_PASSWORD;
const supervisorEmail = process.env.E2E_SUPERVISOR_EMAIL;
const supervisorPassword = process.env.E2E_SUPERVISOR_PASSWORD;
const parentEmail = process.env.E2E_PARENT_EMAIL;
const parentPassword = process.env.E2E_PARENT_PASSWORD;

async function expectNoClubManagement(page: Page) {
  await expect(page.getByRole('heading', { name: /^clubs$/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /create club/i })).toHaveCount(0);
}

test.describe('Phase 3.5 ClubsAdmin club management', () => {
  const headTest = headEmail && headPassword ? test : test.skip;
  const clubsAdminTest = clubsAdminEmail && clubsAdminPassword ? test : test.skip;
  const supervisorTest = supervisorEmail && supervisorPassword ? test : test.skip;
  const parentTest = parentEmail && parentPassword ? test : test.skip;

  headTest('Head can create, update, deactivate, and view a club roster', async ({ page }) => {
    const unique = Date.now();
    const clubName = `E2E Club ${unique}`;
    const updatedClubName = `${clubName} Updated`;

    await signIn(page, headEmail!, headPassword!);
    await page.goto('/admin/clubs');
    await expect(page.getByRole('heading', { name: /^clubs$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /create club/i }).first()).toBeVisible();

    await page
      .getByRole('button', { name: /create club/i })
      .first()
      .click();
    await page.getByLabel('Club name').fill(clubName);
    await page.getByLabel('Description').fill('E2E club management verification.');
    await page.getByLabel('First club date').fill('2026-05-15');
    await page.getByLabel('Start time').fill('15:30');
    await page.getByLabel('End time').fill('16:30');
    await page.getByLabel('Capacity').fill('12');
    await page
      .locator('.admin-club-form-modal')
      .getByRole('button', { name: /create club/i })
      .click();

    await expect(page.getByText('Club created.')).toBeVisible();
    await expect(page.getByRole('heading', { name: clubName })).toBeVisible();
    await expect(page.getByText(/0 \/ 12 members/i)).toBeVisible();

    await page.getByRole('button', { name: /edit club/i }).click();
    await page.getByLabel('Club name').fill(updatedClubName);
    await page
      .locator('.admin-club-form-modal')
      .getByRole('button', { name: /^save club$/i })
      .click();
    await expect(page.getByText('Club updated.')).toBeVisible();

    await expect(page.getByRole('heading', { name: updatedClubName })).toBeVisible();
    await page.getByRole('button', { name: /^deactivate$/i }).click();
    await expect(page.getByText('Club deactivated.')).toBeVisible();
    await expect(page.getByText('Inactive')).toBeVisible();
  });

  clubsAdminTest(
    'ClubsAdmin lands on clubs, sends an empty-recipient notification, and keeps non-supervisor admin navigation hidden',
    async ({ page }) => {
      const unique = Date.now();
      const clubName = `Notification Club ${unique}`;
      const notificationTitle = `No recipient update ${unique}`;

      await signIn(page, clubsAdminEmail!, clubsAdminPassword!);
      await expect(page).toHaveURL(/\/admin\/clubs/);
      await expect(page.getByRole('heading', { name: /^clubs$/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /^clubs$/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /^supervisor$/i })).toBeVisible();
      if ((await page.getByRole('link', { name: /my children/i }).count()) > 0) {
        await expect(page.getByRole('link', { name: /my clubs/i })).toBeVisible();
      }
      await expect(
        page.getByRole('link', {
          name: /Attendance|Behaviour|PACE|Noticeboard|User Access|People & Profiles/i,
        }),
      ).toHaveCount(0);

      await page
        .getByRole('button', { name: /create club/i })
        .first()
        .click();
      await page.getByLabel('Club name').fill(clubName);
      await page.getByLabel('Description').fill('E2E club notification verification.');
      await page
        .locator('.admin-club-form-modal')
        .getByRole('button', { name: /create club/i })
        .click();
      await expect(page.getByText('Club created.')).toBeVisible();
      await expect(page.getByRole('heading', { name: clubName })).toBeVisible();
      await page.getByRole('tab', { name: /^notices$/i }).click();
      await expect(page.getByText(/0 recipients/i)).toBeVisible();
      await expect(page.getByText(/No active signups yet/i)).toBeVisible();
      await expect(page.getByText(/No notices/i)).toBeVisible();

      await page.getByLabel('Notice title').fill(notificationTitle);
      await page.getByLabel('Message').fill('This notification should save without recipients.');
      await page.getByRole('button', { name: /post notice/i }).click();

      await expect(
        page.getByText('Notice saved. No active signup guardians were found.'),
      ).toBeVisible();
      await expect(page.getByText(notificationTitle)).toBeVisible();
    },
  );

  supervisorTest('Supervisor cannot load club management', async ({ page }) => {
    await signIn(page, supervisorEmail!, supervisorPassword!);
    await page.goto('/admin/clubs');
    await expectNoClubManagement(page);
  });

  parentTest('Parent cannot load club management', async ({ page }) => {
    await signIn(page, parentEmail!, parentPassword!);
    await page.goto('/admin/clubs');
    await expectNoClubManagement(page);
  });

  parentTest('Parent can load club signup without management controls', async ({ page }) => {
    await signIn(page, parentEmail!, parentPassword!);
    await page.goto('/parent/clubs');
    await expect(page.getByRole('heading', { name: /^clubs$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /create club/i })).toHaveCount(0);
  });

  parentTest(
    'Parent can sign up for and withdraw from an available linked-child club',
    async ({ page }) => {
      await signIn(page, parentEmail!, parentPassword!);
      await page.goto('/parent/clubs');
      await expect(page.getByRole('heading', { name: /^clubs$/i })).toBeVisible();

      const noLinkedChildren = page.getByText(/No linked children found/i);
      test.skip((await noLinkedChildren.count()) > 0, 'Parent account has no linked children.');

      const signupCard = page
        .locator('.linked-club-card')
        .filter({ has: page.getByRole('button', { name: /^sign up$/i }) })
        .first();
      const signedUpCard = page
        .locator('.linked-club-card')
        .filter({ has: page.getByRole('button', { name: /^withdraw$/i }) })
        .first();

      if ((await signupCard.count()) > 0) {
        await signupCard.getByRole('button', { name: /^sign up$/i }).click();
        await expect(page.getByText(/signed up for/i)).toBeVisible();
        await expect(signupCard.getByRole('button', { name: /^withdraw$/i })).toBeVisible();

        await signupCard.getByRole('button', { name: /^withdraw$/i }).click();
        await expect(page.getByText(/withdrawn from/i)).toBeVisible();
        await expect(signupCard.getByRole('button', { name: /^sign up$/i })).toBeVisible();
        return;
      }

      test.skip(
        (await signedUpCard.count()) === 0,
        'No available or signed-up club fixture exists.',
      );

      await signedUpCard.getByRole('button', { name: /^withdraw$/i }).click();
      await expect(page.getByText(/withdrawn from/i)).toBeVisible();
      await expect(signedUpCard.getByRole('button', { name: /^sign up$/i })).toBeVisible();

      await signedUpCard.getByRole('button', { name: /^sign up$/i }).click();
      await expect(page.getByText(/signed up for/i)).toBeVisible();
      await expect(signedUpCard.getByRole('button', { name: /^withdraw$/i })).toBeVisible();
    },
  );
});

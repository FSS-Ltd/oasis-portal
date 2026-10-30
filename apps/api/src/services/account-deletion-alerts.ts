import { createElement } from 'react';
import type { AppContext } from '../context.js';
import { OasisEmailShell, paragraphStyle, Text } from '../emails/_components/oasis-email-shell.js';
import { buildEmailLogoUrl, type EmailClient } from '../lib/email.js';
import { logOperationalEvent, operationalErrorMessage } from '../lib/observability.js';
import { sendPushToUsers } from './push-notifications.js';

/** The public support inbox (see the web /support page). */
export const TECHNICAL_SUPPORT_EMAIL = 'support@faithfulsoftware.dev';
export const DELETION_REQUEST_EMAIL_SUBJECT = 'Oasis Portal account deletion request';
const ALERT_ROLES = ['Head', 'TechnicalSupport'] as const;
// Review sandbox and client demo rows use synthetic addresses here that cannot receive mail.
const SYNTHETIC_EMAIL_SUFFIX = '.demo.oasisportal.space';

type AlertContext = Pick<AppContext, 'db'> & { requestId?: string };

export interface DeletionRequestSubject {
  userId: string;
  fullName: string;
  role: string;
}

function buildEmail(to: string, subject: DeletionRequestSubject) {
  const who = `${subject.fullName} (${subject.role})`;
  const text = [
    `${who} has asked for their Oasis Portal account to be deleted.`,
    'Open Oasis, go to User Access and approve or decline the request. Approving blocks sign-in and keeps attendance, safeguarding and audit records.',
  ];
  const logoUrl = buildEmailLogoUrl();
  return {
    to,
    subject: DELETION_REQUEST_EMAIL_SUBJECT,
    text: text.join('\n\n'),
    react: createElement(OasisEmailShell, {
      eyebrow: 'Oasis Learning Centre',
      preview: 'An account deletion request is waiting for review.',
      title: 'Account deletion request',
      ...(logoUrl ? { logoUrl } : {}),
      children: text.map((line) => createElement(Text, { key: line, style: paragraphStyle }, line)),
    }),
  };
}

/**
 * Tells every Head and Technical Support account, plus the support inbox, that a deletion request
 * is waiting: a push that opens the person's profile, and an email. The in-app notice is the
 * pending request itself, shown on staff home and User Access.
 * Never throws: the request is already saved, so a failed alert must not fail it.
 */
export async function notifyDeletionRequest(
  ctx: AlertContext,
  subject: DeletionRequestSubject,
  getEmailClient: () => EmailClient,
): Promise<void> {
  try {
    const admins = await ctx.db.user.findMany({
      where: { role: { in: [...ALERT_ROLES] }, active: true, deletedAt: null },
      select: { id: true, emailEnc: true },
    });

    await sendPushToUsers(
      ctx,
      admins.map((admin) => admin.id),
      {
        title: 'Account deletion request',
        body: 'An account deletion request is waiting for your review.',
        data: { area: 'account-deletion', userId: subject.userId },
      },
    );

    const addresses = new Set([TECHNICAL_SUPPORT_EMAIL]);
    for (const admin of admins) {
      const email = ctx.db.$enc.decrypt(admin.emailEnc)?.trim().toLowerCase();
      if (email && !email.endsWith(SYNTHETIC_EMAIL_SUFFIX)) addresses.add(email);
    }
    const client = getEmailClient();
    // One email each, so admins do not see each other's addresses.
    for (const address of addresses) {
      await client.send(buildEmail(address, subject));
    }
  } catch (err) {
    logOperationalEvent({
      event: 'account_deletion.alert_failed',
      level: 'error',
      message: 'Account deletion request alert could not be delivered',
      meta: { error: operationalErrorMessage(err) },
      ...(ctx.requestId ? { requestId: ctx.requestId } : {}),
    });
  }
}

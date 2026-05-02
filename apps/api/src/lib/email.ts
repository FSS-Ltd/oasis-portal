import { Resend, type CreateEmailOptions } from 'resend';
import type { Role } from '@oasis/domain';

export const DEFAULT_RESEND_FROM = 'onboarding@resend.dev';
export const HELLO_WORLD_EMAIL_TO = 'jntagengwa@gmail.com';
export const HELLO_WORLD_EMAIL_SUBJECT = 'Hello World';
export const HELLO_WORLD_EMAIL_HTML =
  '<p>Congrats on sending your <strong>first email</strong>!</p>';
export const USER_INVITE_EMAIL_SUBJECT = 'Your Oasis Portal invitation';

export interface EmailEnv {
  [key: string]: string | undefined;
  RESEND_API_KEY?: string;
  RESEND_FROM?: string;
}

export interface EmailConfig {
  apiKey: string;
  defaultFrom: string;
}

export interface SendEmailInput {
  from?: string;
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

export interface SendEmailResult {
  id: string | null;
}

export interface EmailClient {
  send(input: SendEmailInput): Promise<SendEmailResult>;
}

export function readEmailConfig(env: EmailEnv = process.env): EmailConfig {
  const apiKey = env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is required to send email');
  }

  return {
    apiKey,
    defaultFrom: env.RESEND_FROM?.trim() || DEFAULT_RESEND_FROM,
  };
}

function toResendPayload(input: SendEmailInput, defaultFrom: string): CreateEmailOptions {
  const payload: CreateEmailOptions = {
    from: input.from?.trim() || defaultFrom,
    to: input.to,
    subject: input.subject,
    html: input.html,
  };
  if (input.text !== undefined) payload.text = input.text;
  return payload;
}

export function createResendEmailClient(config: EmailConfig = readEmailConfig()): EmailClient {
  const resend = new Resend(config.apiKey);

  return {
    async send(input) {
      const { data, error } = await resend.emails.send(toResendPayload(input, config.defaultFrom));
      if (error) {
        throw new Error(error.message || 'Resend email send failed');
      }

      return { id: data.id };
    },
  };
}

export function buildHelloWorldEmail(to: string = HELLO_WORLD_EMAIL_TO): SendEmailInput {
  return {
    to,
    subject: HELLO_WORLD_EMAIL_SUBJECT,
    html: HELLO_WORLD_EMAIL_HTML,
  };
}

const ROLE_LABELS = {
  Head: 'Head',
  Principal: 'Principal',
  Pastor: 'Pastor',
  HeadOfDiscipline: 'Head of Discipline',
  TechnicalSupport: 'Technical Support',
  ClubsAdmin: 'Clubs Admin',
  Supervisor: 'Supervisor',
  Parent: 'Parent / Guardian',
  Student: 'Student',
} as const satisfies Record<Role, string>;

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export interface UserInviteEmailInput {
  inviteUrl: string;
  role: Role;
  to: string;
}

export function buildUserInviteEmail(input: UserInviteEmailInput): SendEmailInput {
  const roleLabel = ROLE_LABELS[input.role];
  const inviteUrl = escapeHtml(input.inviteUrl);

  return {
    to: input.to,
    subject: USER_INVITE_EMAIL_SUBJECT,
    html: `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f3f6fb;font-family:Arial,sans-serif;color:#17224a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f6fb;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #d9e2f1;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="background:#17245a;padding:24px 28px;color:#ffffff;">
                <p style="margin:0;font-size:13px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;">Oasis Learning Centre</p>
                <h1 style="margin:8px 0 0;font-size:24px;line-height:1.2;">You have been invited to Oasis Portal</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#3f4f73;">Your Oasis Portal account has been prepared with the role <strong>${escapeHtml(roleLabel)}</strong>.</p>
                <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#3f4f73;">Use the button below to accept the invitation and create your Clerk account.</p>
                <p style="margin:0 0 24px;">
                  <a href="${inviteUrl}" style="display:inline-block;background:#17245a;color:#ffffff;text-decoration:none;border-radius:8px;padding:12px 18px;font-size:14px;font-weight:700;">Accept invitation</a>
                </p>
                <p style="margin:0;font-size:12px;line-height:1.5;color:#6c7892;">If the button does not work, copy and paste this link into your browser:<br><a href="${inviteUrl}" style="color:#2f6fb2;word-break:break-all;">${inviteUrl}</a></p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`,
    text: `You have been invited to Oasis Portal as ${roleLabel}. Accept the invitation and create your account: ${input.inviteUrl}`,
  };
}

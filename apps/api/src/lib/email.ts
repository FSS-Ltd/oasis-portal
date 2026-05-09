import { createElement, type ReactNode } from 'react';
import { Resend, type CreateEmailOptions } from 'resend';
import type { Role } from '@oasis/domain';
import {
  buildMessageNotificationEmailText,
  MessageNotificationEmail,
} from '../emails/message-notification-email.js';
import { buildSmokeTestEmailText, SmokeTestEmail } from '../emails/smoke-test-email.js';
import { buildUserInviteEmailText, UserInviteEmail } from '../emails/user-invite-email.js';

export const DEFAULT_RESEND_FROM = 'onboarding@resend.dev';
export const PRODUCTION_RESEND_FROM = 'Oasis Portal <no-reply@oasisportal.space>';
export const EMAIL_LOGO_PATH = '/oasis-logo-email.png';
export const SMOKE_TEST_EMAIL_TO = 'jntagengwa@gmail.com';
export const SMOKE_TEST_EMAIL_SUBJECT = 'Oasis Portal email deliverability check';
export const SMOKE_TEST_EMAIL_TEXT = buildSmokeTestEmailText();
export const HELLO_WORLD_EMAIL_TO = SMOKE_TEST_EMAIL_TO;
export const HELLO_WORLD_EMAIL_SUBJECT = SMOKE_TEST_EMAIL_SUBJECT;
export const USER_INVITE_EMAIL_SUBJECT = 'Your Oasis Portal invitation';
export const MESSAGE_NOTIFICATION_EMAIL_SUBJECT = 'New Oasis Portal message';

export interface EmailEnv {
  [key: string]: string | undefined;
  APP_URL?: string;
  NODE_ENV?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM?: string;
  VERCEL_ENV?: string;
}

export interface EmailConfig {
  apiKey: string;
  appUrl?: string;
  defaultFrom: string;
}

interface SendEmailBaseInput {
  from?: string;
  to: string | string[];
  subject: string;
  text?: string;
}

export type SendEmailInput =
  | (SendEmailBaseInput & { html: string; react?: never })
  | (SendEmailBaseInput & { html?: never; react: ReactNode });

export interface SendEmailResult {
  id: string | null;
}

export interface EmailClient {
  send(input: SendEmailInput): Promise<SendEmailResult>;
}

function isProductionEmailEnvironment(env: EmailEnv): boolean {
  return env.VERCEL_ENV === 'production' || env.NODE_ENV === 'production';
}

function stripWrappingQuotes(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length < 2) return trimmed;

  const first = trimmed[0];
  const last = trimmed[trimmed.length - 1];
  if ((first === '"' || first === "'") && first === last) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
}

function normaliseSender(value: string): string {
  const sender = stripWrappingQuotes(value);
  return sender === 'no-reply@oasisportal.space' ? PRODUCTION_RESEND_FROM : sender;
}

function normaliseAppUrl(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;

  try {
    return new URL(trimmed).toString().replace(/\/$/, '');
  } catch {
    return undefined;
  }
}

export function buildEmailLogoUrl(
  appUrl: string | undefined = process.env.APP_URL,
): string | undefined {
  const normalisedAppUrl = normaliseAppUrl(appUrl);
  if (!normalisedAppUrl) return undefined;
  return new URL(EMAIL_LOGO_PATH, normalisedAppUrl).toString();
}

export function readEmailConfig(env: EmailEnv = process.env): EmailConfig {
  const apiKey = env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is required to send email');
  }

  const from = env.RESEND_FROM?.trim();
  if (isProductionEmailEnvironment(env) && !from) {
    throw new Error('RESEND_FROM is required to send email in production');
  }

  const config: EmailConfig = {
    apiKey,
    defaultFrom: from ? normaliseSender(from) : DEFAULT_RESEND_FROM,
  };
  const appUrl = normaliseAppUrl(env.APP_URL);
  if (appUrl) config.appUrl = appUrl;
  return config;
}

function toResendPayload(input: SendEmailInput, defaultFrom: string): CreateEmailOptions {
  const basePayload = {
    from: input.from?.trim() || defaultFrom,
    to: input.to,
    subject: input.subject,
  };
  const textPayload = input.text === undefined ? {} : { text: input.text };
  if ('react' in input) {
    return {
      ...basePayload,
      ...textPayload,
      react: input.react,
    };
  }
  return {
    ...basePayload,
    ...textPayload,
    html: input.html,
  };
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

function logoProps(logoUrl?: string): { logoUrl?: string } {
  return logoUrl ? { logoUrl } : {};
}

export function buildSmokeTestEmail(to: string = SMOKE_TEST_EMAIL_TO): SendEmailInput {
  const logoUrl = buildEmailLogoUrl();
  return {
    to,
    subject: SMOKE_TEST_EMAIL_SUBJECT,
    react: createElement(SmokeTestEmail, logoProps(logoUrl)),
    text: SMOKE_TEST_EMAIL_TEXT,
  };
}

export function buildHelloWorldEmail(to: string = HELLO_WORLD_EMAIL_TO): SendEmailInput {
  return buildSmokeTestEmail(to);
}

export interface UserInviteEmailInput {
  inviteUrl: string;
  logoUrl?: string;
  role: Role;
  to: string;
}

export function buildUserInviteEmail(input: UserInviteEmailInput): SendEmailInput {
  const logoUrl = input.logoUrl ?? buildEmailLogoUrl();

  return {
    to: input.to,
    subject: USER_INVITE_EMAIL_SUBJECT,
    react: createElement(UserInviteEmail, {
      inviteUrl: input.inviteUrl,
      role: input.role,
      ...logoProps(logoUrl),
    }),
    text: buildUserInviteEmailText({ inviteUrl: input.inviteUrl, role: input.role }),
  };
}

export interface MessageNotificationEmailInput {
  logoUrl?: string;
  messagePath?: string;
  recipientName?: string;
  senderName: string;
  threadSubject: string;
  to: string;
}

function buildMessageUrl(messagePath: string | undefined, appUrl = process.env.APP_URL) {
  const normalisedAppUrl = normaliseAppUrl(appUrl);
  if (!normalisedAppUrl || !messagePath) return undefined;
  return new URL(messagePath, normalisedAppUrl).toString();
}

export function buildMessageNotificationEmail(
  input: MessageNotificationEmailInput,
): SendEmailInput {
  const logoUrl = input.logoUrl ?? buildEmailLogoUrl();
  const messageUrl = buildMessageUrl(input.messagePath);
  const messageUrlProps = messageUrl ? { messageUrl } : {};
  const recipientNameProps = input.recipientName ? { recipientName: input.recipientName } : {};
  const commonProps = {
    senderName: input.senderName,
    threadSubject: input.threadSubject,
    ...messageUrlProps,
    ...recipientNameProps,
  };

  return {
    to: input.to,
    subject: MESSAGE_NOTIFICATION_EMAIL_SUBJECT,
    react: createElement(MessageNotificationEmail, {
      ...commonProps,
      ...logoProps(logoUrl),
    }),
    text: buildMessageNotificationEmailText(commonProps),
  };
}

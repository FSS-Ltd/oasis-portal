import { Resend, type CreateEmailOptions } from 'resend';

export const DEFAULT_RESEND_FROM = 'onboarding@resend.dev';
export const HELLO_WORLD_EMAIL_TO = 'jntagengwa@gmail.com';
export const HELLO_WORLD_EMAIL_SUBJECT = 'Hello World';
export const HELLO_WORLD_EMAIL_HTML =
  '<p>Congrats on sending your <strong>first email</strong>!</p>';

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
  return {
    from: input.from?.trim() || defaultFrom,
    to: input.to,
    subject: input.subject,
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

export function buildHelloWorldEmail(to: string = HELLO_WORLD_EMAIL_TO): SendEmailInput {
  return {
    to,
    subject: HELLO_WORLD_EMAIL_SUBJECT,
    html: HELLO_WORLD_EMAIL_HTML,
  };
}

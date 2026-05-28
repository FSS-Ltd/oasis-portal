import * as Sentry from '@sentry/nextjs';
import { scrubSentryEvent } from './sentry-shared';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  beforeSend: scrubSentryEvent,
  dsn,
  environment: process.env.NODE_ENV,
  sendDefaultPii: false,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.05 : 1,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

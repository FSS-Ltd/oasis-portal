import * as Sentry from '@sentry/nextjs';
import { scrubSentryEvent, sentryDsn, sentryEnvironment } from './sentry-shared';

Sentry.init({
  beforeSend: scrubSentryEvent,
  dsn: sentryDsn(),
  environment: sentryEnvironment(),
  sendDefaultPii: false,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.05 : 1,
});

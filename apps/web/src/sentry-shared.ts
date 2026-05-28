interface SentrySanitizableEvent {
  request?: {
    cookies?: unknown;
    data?: unknown;
    headers?: unknown;
    query_string?: unknown;
  };
  user?: {
    email?: unknown;
    ip_address?: unknown;
    username?: unknown;
  };
}

export function sentryDsn(): string | undefined {
  return process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN || undefined;
}

export function sentryEnvironment(): string | undefined {
  return process.env.VERCEL_ENV ?? process.env.NODE_ENV;
}

export function scrubSentryEvent<TEvent extends SentrySanitizableEvent>(event: TEvent): TEvent {
  if (event.request) {
    delete event.request.cookies;
    delete event.request.data;
    delete event.request.headers;
    delete event.request.query_string;
  }
  if (event.user) {
    delete event.user.email;
    delete event.user.ip_address;
    delete event.user.username;
  }
  return event;
}

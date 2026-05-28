export type OperationalLogLevel = 'info' | 'warn' | 'error';

export type OperationalLogMetaValue =
  | string
  | number
  | boolean
  | null
  | OperationalLogMetaValue[]
  | { readonly [key: string]: OperationalLogMetaValue };

export type OperationalLogMeta = Record<string, unknown>;

export interface OperationalLogInput {
  event: string;
  level: OperationalLogLevel;
  message: string;
  meta?: OperationalLogMeta;
  requestId?: string;
  userId?: string;
}

export interface OperationalLogEntry {
  event: string;
  level: OperationalLogLevel;
  message: string;
  meta?: Record<string, OperationalLogMetaValue>;
  requestId?: string;
  service: 'oasis-portal';
  timestamp: string;
  userId?: string;
}

interface OperationalLogSink {
  error: (message: string) => void;
  info: (message: string) => void;
  warn: (message: string) => void;
}

interface OperationalLogOptions {
  now?: () => Date;
  sink?: OperationalLogSink;
}

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const SENSITIVE_KEY_PATTERN = /(?:authorization|cookie|email|password|secret|token|api[-_]?key)/i;

function sanitizeOperationalValue(key: string, value: unknown): OperationalLogMetaValue {
  if (SENSITIVE_KEY_PATTERN.test(key)) return '[redacted]';

  if (value === null) return null;
  if (typeof value === 'string') {
    return value.replace(EMAIL_PATTERN, '[redacted-email]');
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeOperationalValue(key, item));
  }
  if (typeof value === 'object') {
    return sanitizeOperationalMeta(value as Record<string, unknown>);
  }
  return '[unsupported]';
}

export function sanitizeOperationalMeta(
  meta: OperationalLogMeta,
): Record<string, OperationalLogMetaValue> {
  return Object.fromEntries(
    Object.entries(meta).map(([key, value]) => [key, sanitizeOperationalValue(key, value)]),
  );
}

export function operationalErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'unknown error';
}

export function buildOperationalLogEntry(
  input: OperationalLogInput,
  now = new Date(),
): OperationalLogEntry {
  return {
    event: input.event,
    level: input.level,
    message: input.message,
    ...(input.meta ? { meta: sanitizeOperationalMeta(input.meta) } : {}),
    ...(input.requestId ? { requestId: input.requestId } : {}),
    service: 'oasis-portal',
    timestamp: now.toISOString(),
    ...(input.userId ? { userId: input.userId } : {}),
  };
}

export function logOperationalEvent(
  input: OperationalLogInput,
  options: OperationalLogOptions = {},
): void {
  const entry = buildOperationalLogEntry(input, options.now?.() ?? new Date());
  const sink = options.sink ?? console;
  sink[input.level](JSON.stringify(entry));
}

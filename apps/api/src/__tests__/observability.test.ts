import { describe, expect, it, vi } from 'vitest';
import {
  buildOperationalLogEntry,
  logOperationalEvent,
  operationalErrorMessage,
} from '../lib/observability.js';

describe('operationalErrorMessage', () => {
  it('returns a safe message without exposing non-Error values', () => {
    expect(operationalErrorMessage(new Error('resend rejected'))).toBe('resend rejected');
    expect(operationalErrorMessage('raw secret string')).toBe('unknown error');
  });
});

describe('buildOperationalLogEntry', () => {
  it('redacts sensitive metadata before creating a log entry', () => {
    const entry = buildOperationalLogEntry(
      {
        event: 'email.delivery_failed',
        level: 'error',
        message: 'Invitation email delivery failed',
        meta: {
          authorization: 'Bearer token',
          nested: { parentEmail: 'parent@example.com', role: 'Parent' },
          recipient: 'parent@example.com',
          resendToken: 'secret-token',
          role: 'Parent',
        },
        requestId: 'req_test',
        userId: 'user_1',
      },
      new Date('2026-05-28T10:00:00.000Z'),
    );

    expect(entry).toEqual({
      event: 'email.delivery_failed',
      level: 'error',
      message: 'Invitation email delivery failed',
      meta: {
        authorization: '[redacted]',
        nested: { parentEmail: '[redacted]', role: 'Parent' },
        recipient: '[redacted-email]',
        resendToken: '[redacted]',
        role: 'Parent',
      },
      requestId: 'req_test',
      service: 'oasis-portal',
      timestamp: '2026-05-28T10:00:00.000Z',
      userId: 'user_1',
    });
  });
});

describe('logOperationalEvent', () => {
  it('writes one structured log line to the selected sink level', () => {
    const sink = { error: vi.fn(), info: vi.fn(), warn: vi.fn() };

    logOperationalEvent(
      {
        event: 'auth.handoff_failed',
        level: 'warn',
        message: 'Clerk auth handoff failed',
        requestId: 'req_test',
      },
      { now: () => new Date('2026-05-28T11:00:00.000Z'), sink },
    );

    expect(sink.warn).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(sink.warn.mock.calls[0]?.[0]))).toMatchObject({
      event: 'auth.handoff_failed',
      level: 'warn',
      message: 'Clerk auth handoff failed',
      requestId: 'req_test',
      timestamp: '2026-05-28T11:00:00.000Z',
    });
    expect(sink.error).not.toHaveBeenCalled();
    expect(sink.info).not.toHaveBeenCalled();
  });
});

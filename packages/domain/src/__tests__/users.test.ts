import { describe, expect, it, vi } from 'vitest';
import {
  inviteUserInput,
  linkGuardianInput,
  resolveInviteMetadata,
} from '../users.js';

describe('inviteUserInput', () => {
  it('accepts a valid payload and defaults tags to []', () => {
    const parsed = inviteUserInput.parse({
      email: 'jane@example.com',
      role: 'Supervisor',
    });
    expect(parsed.email).toBe('jane@example.com');
    expect(parsed.role).toBe('Supervisor');
    expect(parsed.tags).toEqual([]);
  });

  it('lower-cases and trims email', () => {
    const parsed = inviteUserInput.parse({
      email: '  Jane@Example.COM ',
      role: 'Parent',
    });
    expect(parsed.email).toBe('jane@example.com');
  });

  it('accepts a known permission tag', () => {
    const parsed = inviteUserInput.parse({
      email: 'sk@example.com',
      role: 'Supervisor',
      tags: ['shopkeeper'],
    });
    expect(parsed.tags).toEqual(['shopkeeper']);
  });

  it('rejects an unknown role at path ["role"]', () => {
    const result = inviteUserInput.safeParse({
      email: 'x@example.com',
      role: 'Janitor',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['role']);
    }
  });

  it('rejects an unknown tag at path ["tags", 0]', () => {
    const result = inviteUserInput.safeParse({
      email: 'x@example.com',
      role: 'Supervisor',
      tags: ['superuser'],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['tags', 0]);
    }
  });

  it('rejects missing or invalid email', () => {
    expect(inviteUserInput.safeParse({ role: 'Supervisor' }).success).toBe(false);
    expect(inviteUserInput.safeParse({ email: 'not-an-email', role: 'Supervisor' }).success).toBe(
      false,
    );
  });

  it('accepts an optional redirectUrl and rejects invalid ones', () => {
    expect(
      inviteUserInput.safeParse({
        email: 'x@example.com',
        role: 'Supervisor',
        redirectUrl: 'https://app.example.com/welcome',
      }).success,
    ).toBe(true);
    expect(
      inviteUserInput.safeParse({
        email: 'x@example.com',
        role: 'Supervisor',
        redirectUrl: 'not-a-url',
      }).success,
    ).toBe(false);
  });
});

describe('linkGuardianInput', () => {
  it('accepts a valid pair', () => {
    expect(
      linkGuardianInput.parse({ userId: 'u_parent', studentId: 's_student' }),
    ).toEqual({ userId: 'u_parent', studentId: 's_student' });
  });

  it('rejects empty ids', () => {
    expect(linkGuardianInput.safeParse({ userId: '', studentId: 's' }).success).toBe(false);
    expect(linkGuardianInput.safeParse({ userId: 'u', studentId: '' }).success).toBe(false);
  });
});

describe('resolveInviteMetadata', () => {
  const defaults = { role: 'Parent' as const, tags: [] };

  it('returns defaults for null / undefined', () => {
    expect(resolveInviteMetadata(null, defaults)).toEqual({ role: 'Parent', tags: [] });
    expect(resolveInviteMetadata(undefined, defaults)).toEqual({ role: 'Parent', tags: [] });
  });

  it('parses valid metadata', () => {
    expect(
      resolveInviteMetadata({ role: 'Supervisor', tags: ['shopkeeper'] }, defaults),
    ).toEqual({ role: 'Supervisor', tags: ['shopkeeper'] });
  });

  it('falls back to defaults silently on malformed input (does not throw)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      expect(resolveInviteMetadata({ role: 'Janitor' }, defaults)).toEqual({
        role: 'Parent',
        tags: [],
      });
      expect(resolveInviteMetadata('not an object', defaults)).toEqual({
        role: 'Parent',
        tags: [],
      });
      expect(warn).toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  it('uses defaults for missing fields', () => {
    expect(resolveInviteMetadata({ tags: ['shopadmin'] }, defaults)).toEqual({
      role: 'Parent',
      tags: ['shopadmin'],
    });
    expect(resolveInviteMetadata({ role: 'Supervisor' }, defaults)).toEqual({
      role: 'Supervisor',
      tags: [],
    });
  });

  it('returns a copy of defaults.tags so mutation does not leak', () => {
    const result = resolveInviteMetadata(null, defaults);
    result.tags.push('shopkeeper');
    expect(defaults.tags).toEqual([]);
  });
});

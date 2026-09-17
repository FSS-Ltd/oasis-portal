import { describe, expect, it } from 'vitest';
import { shouldSendParentEmailNotification } from '../services/parent-email-notifications.js';

describe('shouldSendParentEmailNotification', () => {
  it('allows notification emails by default', () => {
    expect(shouldSendParentEmailNotification({}, 'Message')).toBe(true);
  });

  it('suppresses every optional category when the master preference is off', () => {
    expect(
      shouldSendParentEmailNotification({ parentEmailNotificationsEnabled: false }, 'Report'),
    ).toBe(false);
  });

  it('suppresses only opted-out categories when the master preference is on', () => {
    const recipient = { parentEmailNotificationOptOuts: ['Club'] as const };

    expect(shouldSendParentEmailNotification(recipient, 'Club')).toBe(false);
    expect(shouldSendParentEmailNotification(recipient, 'Behaviour')).toBe(true);
  });
});

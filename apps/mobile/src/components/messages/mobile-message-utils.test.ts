import { describe, expect, it } from 'vitest';
import {
  avatarColour,
  buildMessageRows,
  findConversationForRecipient,
  formatSeparator,
  initials,
} from './mobile-message-utils';

const NOW = new Date('2026-10-28T15:00:00');

function message(id: string, senderId: string, at: string) {
  return { id, senderId, createdAt: new Date(at) };
}

describe('buildMessageRows', () => {
  it('opens with a time label and ends a single bubble with its tail', () => {
    const rows = buildMessageRows([message('a', 'me', '2026-10-28T14:00:00')], 'me', NOW);

    expect(rows.map((row) => row.type)).toEqual(['separator', 'message']);
    expect(rows[0]).toMatchObject({ label: 'Today 14:00' });
    expect(rows[1]).toMatchObject({ mine: true, position: 'single' });
  });

  it('groups consecutive bubbles from one sender and gives only the last a tail', () => {
    const rows = buildMessageRows(
      [
        message('a', 'them', '2026-10-28T14:00:00'),
        message('b', 'them', '2026-10-28T14:01:00'),
        message('c', 'them', '2026-10-28T14:02:00'),
      ],
      'me',
      NOW,
    );
    const positions = rows.flatMap((row) => (row.type === 'message' ? [row.position] : []));

    expect(positions).toEqual(['first', 'middle', 'last']);
  });

  it('starts a new group when the sender changes', () => {
    const rows = buildMessageRows(
      [
        message('a', 'them', '2026-10-28T14:00:00'),
        message('b', 'me', '2026-10-28T14:01:00'),
        message('c', 'them', '2026-10-28T14:02:00'),
      ],
      'me',
      NOW,
    );
    const positions = rows.flatMap((row) => (row.type === 'message' ? [row.position] : []));

    expect(positions).toEqual(['single', 'single', 'single']);
  });

  it('adds a time label after a 30 minute pause and splits the group', () => {
    const rows = buildMessageRows(
      [message('a', 'them', '2026-10-28T09:00:00'), message('b', 'them', '2026-10-28T14:00:00')],
      'me',
      NOW,
    );

    expect(rows.map((row) => row.type)).toEqual(['separator', 'message', 'separator', 'message']);
    expect(rows[1]).toMatchObject({ position: 'single' });
    expect(rows[3]).toMatchObject({ position: 'single' });
  });

  it('adds a time label when the day changes even within 30 minutes', () => {
    const rows = buildMessageRows(
      [message('a', 'them', '2026-10-27T23:50:00'), message('b', 'them', '2026-10-28T00:10:00')],
      'me',
      NOW,
    );

    expect(rows.filter((row) => row.type === 'separator')).toHaveLength(2);
  });

  it('shows delivery status only under the most recent message you sent', () => {
    const rows = buildMessageRows(
      [
        message('a', 'me', '2026-10-28T14:00:00'),
        message('b', 'them', '2026-10-28T14:01:00'),
        message('c', 'me', '2026-10-28T14:02:00'),
        message('d', 'them', '2026-10-28T14:03:00'),
      ],
      'me',
      NOW,
    );
    const status = rows.flatMap((row) =>
      row.type === 'message' ? [[row.key, row.showStatus]] : [],
    );

    expect(status).toEqual([
      ['a', false],
      ['b', false],
      ['c', true],
      ['d', false],
    ]);
  });

  it('names the sender only on the first bubble of their group, never on your own', () => {
    const rows = buildMessageRows(
      [
        message('a', 'them', '2026-10-28T14:00:00'),
        message('b', 'them', '2026-10-28T14:01:00'),
        message('c', 'me', '2026-10-28T14:02:00'),
      ],
      'me',
      NOW,
    );
    const sender = rows.flatMap((row) => (row.type === 'message' ? [row.showSender] : []));

    expect(sender).toEqual([true, false, false]);
  });

  it('handles an empty conversation', () => {
    expect(buildMessageRows([], 'me', NOW)).toEqual([]);
  });
});

describe('formatSeparator', () => {
  it('labels today, yesterday, the last week and older dates', () => {
    expect(formatSeparator('2026-10-28T09:05:00', NOW)).toBe('Today 09:05');
    expect(formatSeparator('2026-10-27T18:30:00', NOW)).toBe('Yesterday 18:30');
    expect(formatSeparator('2026-10-24T12:00:00', NOW)).toBe('Sat 12:00');
    expect(formatSeparator('2026-09-12T12:00:00', NOW)).toBe('12 Sept 12:00');
  });
});

describe('contacts', () => {
  it('derives stable initials and colours from a name', () => {
    expect(initials('Amara Okoye')).toBe('AO');
    expect(initials('  prince  ')).toBe('P');
    expect(initials('')).toBe('?');
    expect(avatarColour('Amara Okoye')).toBe(avatarColour('Amara Okoye'));
  });

  it('reopens the existing one-to-one conversation of the same kind', () => {
    const conversations = [
      { id: 'c1', kind: 'ParentStaff', participants: [{ id: 'me' }, { id: 'p1' }] },
      { id: 'c2', kind: 'StaffDirect', participants: [{ id: 'me' }, { id: 'p1' }] },
      { id: 'c3', kind: 'Staffroom', participants: [{ id: 'me' }, { id: 'p1' }] },
    ];

    expect(findConversationForRecipient(conversations, 'p1', 'StaffDirect')?.id).toBe('c2');
    expect(findConversationForRecipient(conversations, 'p1', 'ParentStaff')?.id).toBe('c1');
    expect(findConversationForRecipient(conversations, 'p2', 'ParentStaff')).toBeUndefined();
  });
});

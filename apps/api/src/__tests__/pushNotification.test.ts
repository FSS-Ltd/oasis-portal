import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SessionUser } from '@oasis/domain';
import { makeTestContext } from './helpers/test-context.js';
import { pushNotificationRouter } from '../routers/pushNotification.js';
import {
  EXPO_PUSH_SEND_URL,
  NEW_MESSAGE_PUSH,
  sendPushToStudents,
  sendPushToUsers,
} from '../services/push-notifications.js';
import { router } from '../trpc.js';

const TOKEN = 'ExponentPushToken[abc123]';
const parent: SessionUser = { id: 'p1', role: 'Parent', tags: [], requires2fa: false };

function makeDb(devices: Array<{ id: string; tokenEnc: string }> = []) {
  return {
    pushDeviceToken: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue(devices),
      upsert: vi.fn().mockResolvedValue({ id: 'd1' }),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    student: { findMany: vi.fn().mockResolvedValue([{ userId: 's1' }, { userId: null }]) },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
    $enc: {
      encrypt: (value: string) => `enc:${value}`,
      decrypt: (value: string) => value.replace(/^enc:/, ''),
      blindIndex: (value: string) => `bidx:${value}`,
    },
  };
}

function caller(db: ReturnType<typeof makeDb>, user: SessionUser | null = parent) {
  const ctx = makeTestContext({ db, user });
  return router({ pushNotification: pushNotificationRouter }).createCaller(ctx);
}

function stubExpo(tickets: unknown[], status = 200) {
  const fetchMock = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ data: tickets }), { status }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('pushNotification router', () => {
  it('registers a device against the signed-in user without storing the raw token', async () => {
    const db = makeDb();
    await expect(
      caller(db).pushNotification.register({ token: TOKEN, platform: 'Ios' }),
    ).resolves.toEqual({ enabled: true });
    const args = db.pushDeviceToken.upsert.mock.calls[0]?.[0] as {
      where: unknown;
      create: { userId: string; tokenEnc: string };
      update: { userId: string };
    };
    expect(args.where).toEqual({ tokenBidx: `bidx:${TOKEN}` });
    expect(args.create).toMatchObject({ userId: 'p1', tokenEnc: `enc:${TOKEN}` });
    expect(args.update.userId).toBe('p1');
    expect(JSON.stringify(db.auditLog.create.mock.calls)).not.toContain(TOKEN);
  });

  it('rejects anything that is not an Expo push token', async () => {
    await expect(
      caller(makeDb()).pushNotification.register({ token: 'not-a-token', platform: 'Android' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('requires sign-in to register', async () => {
    await expect(
      caller(makeDb(), null).pushNotification.register({ token: TOKEN, platform: 'Ios' }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('reports status only for the signed-in user', async () => {
    const db = makeDb();
    await caller(db).pushNotification.status({ token: TOKEN });
    expect(db.pushDeviceToken.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tokenBidx: `bidx:${TOKEN}`, userId: 'p1' } }),
    );
  });

  it('forgets a device after sign-out without a session', async () => {
    const db = makeDb();
    await expect(caller(db, null).pushNotification.forget({ token: TOKEN })).resolves.toEqual({
      enabled: false,
    });
    expect(db.pushDeviceToken.deleteMany).toHaveBeenCalledWith({
      where: { tokenBidx: `bidx:${TOKEN}` },
    });
  });
});

describe('sendPushToUsers', () => {
  it('sends generic copy to each device and deletes devices Expo no longer knows', async () => {
    const db = makeDb([
      { id: 'd1', tokenEnc: 'enc:ExpoPushToken[one]' },
      { id: 'd2', tokenEnc: 'enc:ExpoPushToken[two]' },
    ]);
    const fetchMock = stubExpo([
      { status: 'ok' },
      { status: 'error', details: { error: 'DeviceNotRegistered' } },
    ]);

    await sendPushToUsers(makeTestContext({ db, user: parent }), ['u1', 'u1'], NEW_MESSAGE_PUSH);

    expect(db.pushDeviceToken.findMany.mock.calls[0]?.[0]).toMatchObject({
      where: { userId: { in: ['u1'] }, user: { active: true, deletedAt: null } },
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, { body: string }];
    expect(url).toBe(EXPO_PUSH_SEND_URL);
    expect(JSON.parse(init.body)).toEqual([
      { to: 'ExpoPushToken[one]', sound: 'default', ...NEW_MESSAGE_PUSH },
      { to: 'ExpoPushToken[two]', sound: 'default', ...NEW_MESSAGE_PUSH },
    ]);
    expect(db.pushDeviceToken.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['d2'] } } });
  });

  it('never throws when Expo is down', async () => {
    const db = makeDb([{ id: 'd1', tokenEnc: 'enc:ExpoPushToken[one]' }]);
    stubExpo([], 503);
    await expect(
      sendPushToUsers(makeTestContext({ db, user: parent }), ['u1'], NEW_MESSAGE_PUSH),
    ).resolves.toBeUndefined();
  });

  it('does not call Expo when no device has push on', async () => {
    const fetchMock = stubExpo([]);
    await sendPushToUsers(
      makeTestContext({ db: makeDb(), user: parent }),
      ['u1'],
      NEW_MESSAGE_PUSH,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps students to their logins and skips students without one', async () => {
    const db = makeDb();
    stubExpo([]);
    await sendPushToStudents(
      makeTestContext({ db, user: parent }),
      ['st1', 'st2'],
      NEW_MESSAGE_PUSH,
    );
    expect(db.pushDeviceToken.findMany.mock.calls[0]?.[0]).toMatchObject({
      where: { userId: { in: ['s1'] } },
    });
  });
});

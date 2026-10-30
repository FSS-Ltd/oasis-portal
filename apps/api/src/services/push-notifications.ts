import type { AppContext } from '../context.js';
import { logOperationalEvent, operationalErrorMessage } from '../lib/observability.js';

export const EXPO_PUSH_SEND_URL = 'https://exp.host/--/api/v2/push/send';
// Expo accepts at most 100 messages per request.
const EXPO_PUSH_BATCH = 100;

/** Lock-screen copy stays generic: no names, behaviour, safeguarding or finance detail. */
export interface PushMessage {
  title: string;
  body: string;
  /** Lets the app decide where a tap should land. */
  data: { area: 'messages' | 'updates' };
}

export const NEW_MESSAGE_PUSH: PushMessage = {
  title: 'New message',
  body: 'You have a new message in Oasis.',
  data: { area: 'messages' },
};

export const NEW_UPDATE_PUSH: PushMessage = {
  title: 'Oasis',
  body: 'You have a new update in Oasis.',
  data: { area: 'updates' },
};

interface ExpoPushTicket {
  status: 'ok' | 'error';
  details?: { error?: string };
}

type PushContext = Pick<AppContext, 'db'> & { requestId?: string };

function requestIdOf(ctx: PushContext): { requestId?: string } {
  return ctx.requestId ? { requestId: ctx.requestId } : {};
}

/**
 * Sends a push to every device that active users in `userIds` have turned push on for.
 * Never throws: push is a nudge on top of the in-app record, so a failure must not fail the request.
 * Tokens Expo reports as DeviceNotRegistered are deleted.
 * ponytail: ticket errors only; add receipt polling if silent APNs/FCM failures show up.
 */
export async function sendPushToUsers(
  ctx: PushContext,
  userIds: readonly string[],
  message: PushMessage,
): Promise<void> {
  if (userIds.length === 0) return;

  try {
    const devices = await ctx.db.pushDeviceToken.findMany({
      where: { userId: { in: [...new Set(userIds)] }, user: { active: true, deletedAt: null } },
      select: { id: true, tokenEnc: true },
    });
    const targets = devices.flatMap((device) => {
      const token = ctx.db.$enc.decrypt(device.tokenEnc);
      return token ? [{ id: device.id, token }] : [];
    });

    const accessToken = process.env.EXPO_PUSH_ACCESS_TOKEN;
    for (let start = 0; start < targets.length; start += EXPO_PUSH_BATCH) {
      const batch = targets.slice(start, start + EXPO_PUSH_BATCH);
      const response = await fetch(EXPO_PUSH_SEND_URL, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(
          batch.map(({ token }) => ({ to: token, sound: 'default', ...message })),
        ),
      });
      if (!response.ok)
        throw new Error(`Expo push send failed with HTTP ${String(response.status)}`);

      const { data: tickets = [] } = (await response.json()) as { data?: ExpoPushTicket[] };
      const deadIds = batch
        .filter((_, index) => tickets[index]?.details?.error === 'DeviceNotRegistered')
        .map(({ id }) => id);
      if (deadIds.length > 0) {
        await ctx.db.pushDeviceToken.deleteMany({ where: { id: { in: deadIds } } });
      }
      const failed = tickets.filter((ticket) => ticket.status === 'error').length;
      if (failed > 0) {
        logOperationalEvent({
          event: 'push.delivery_failed',
          level: 'warn',
          message: 'Expo rejected some push messages',
          meta: { failed, removedDevices: deadIds.length, sent: batch.length },
          ...requestIdOf(ctx),
        });
      }
    }
  } catch (err) {
    logOperationalEvent({
      event: 'push.delivery_failed',
      level: 'error',
      message: 'Push notification delivery failed',
      meta: { error: operationalErrorMessage(err), recipients: userIds.length },
      ...requestIdOf(ctx),
    });
  }
}

/** Pushes to the student logins behind `studentIds`. Students without a login are skipped. */
export async function sendPushToStudents(
  ctx: PushContext,
  studentIds: readonly string[],
  message: PushMessage,
): Promise<void> {
  if (studentIds.length === 0) return;
  try {
    const students = await ctx.db.student.findMany({
      where: { id: { in: [...new Set(studentIds)] } },
      select: { userId: true },
    });
    const userIds = students.flatMap((student) => (student.userId ? [student.userId] : []));
    await sendPushToUsers(ctx, userIds, message);
  } catch (err) {
    logOperationalEvent({
      event: 'push.delivery_failed',
      level: 'error',
      message: 'Push notification recipient lookup failed',
      meta: { error: operationalErrorMessage(err), students: studentIds.length },
      ...requestIdOf(ctx),
    });
  }
}

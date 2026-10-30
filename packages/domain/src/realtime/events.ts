import { z } from 'zod';

export const REALTIME_DATA_EVENT = 'oasis.data_changed';

export const REALTIME_AREAS = [
  'admin',
  'audit',
  'health',
  'student',
  'attendance',
  'behaviour',
  'childLog',
  'childNotes',
  'pace',
  'meritLedger',
  'tithe',
  'investment',
  'shop',
  'leaderboard',
  'club',
  'calendar',
  'notice',
  'message',
  'community',
  'profile',
  'report',
  'rota',
  'email',
  'registration',
  'invoice',
  'permissionSlip',
  'incident',
  'studentSettings',
  'faithCorner',
  'studentNotification',
  'homework',
  'staffHome',
  'academicInventory',
  'personalTask',
  'timetable',
  'library',
  'compliance',
  'userAgreement',
  'accountDeletion',
  'pushNotification',
] as const;

export type RealtimeArea = (typeof REALTIME_AREAS)[number];

/** Includes profile-only control events sent to already-revoked connections. */
export const REALTIME_AUTHORITY_AREAS = [
  'health',
  'admin',
  'profile',
  'studentSettings',
  'registration',
] as const satisfies readonly RealtimeArea[];

export interface DataChangedEvent {
  readonly eventId: string;
  readonly areas: readonly RealtimeArea[];
  readonly occurredAt: string;
}

const dataChangedEventSchema = z
  .object({
    // Managed realtime.send adds its own message UUID to the application payload.
    id: z.string().uuid().optional(),
    eventId: z.string().uuid(),
    areas: z
      .array(z.enum(REALTIME_AREAS))
      .min(1)
      .max(REALTIME_AREAS.length)
      .refine((areas) => new Set(areas).size === areas.length),
    occurredAt: z.string().datetime({ offset: true }),
  })
  .strict()
  .transform(({ eventId, areas, occurredAt }) => ({ eventId, areas, occurredAt }));

export function parseDataChangedEvent(payload: unknown): DataChangedEvent | null {
  const parsed = dataChangedEventSchema.safeParse(payload);
  return parsed.success ? parsed.data : null;
}

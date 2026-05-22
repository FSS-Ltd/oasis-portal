export const OASIS_REALTIME_EVENTS = {
  childNotesChanged: 'oasis.child_notes_changed',
  messageChanged: 'oasis.message_changed',
  messageReadChanged: 'oasis.message_read_changed',
  messageThreadChanged: 'oasis.message_thread_changed',
} as const;

type RealtimeEventName = (typeof OASIS_REALTIME_EVENTS)[keyof typeof OASIS_REALTIME_EVENTS];
type RealtimeOperation = 'DELETE' | 'INSERT' | 'UPDATE';

interface RealtimeEventBase {
  event: RealtimeEventName;
  occurredAt: string;
  operation: RealtimeOperation;
}

export interface MessageRealtimeEvent extends RealtimeEventBase {
  event:
    | typeof OASIS_REALTIME_EVENTS.messageChanged
    | typeof OASIS_REALTIME_EVENTS.messageReadChanged
    | typeof OASIS_REALTIME_EVENTS.messageThreadChanged;
  threadId: string;
}

export interface ChildNotesRealtimeEvent extends RealtimeEventBase {
  event: typeof OASIS_REALTIME_EVENTS.childNotesChanged;
}

export type OasisRealtimeEvent = ChildNotesRealtimeEvent | MessageRealtimeEvent;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function stringField(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function operationField(payload: Record<string, unknown>): RealtimeOperation | null {
  const value = payload['operation'];
  return value === 'DELETE' || value === 'INSERT' || value === 'UPDATE' ? value : null;
}

function isRealtimeEventName(value: string): value is RealtimeEventName {
  return Object.values(OASIS_REALTIME_EVENTS).includes(value as RealtimeEventName);
}

export function parseOasisRealtimeEvent(
  eventName: string,
  payload: unknown,
): OasisRealtimeEvent | null {
  if (!isRealtimeEventName(eventName) || !isRecord(payload)) return null;

  const operation = operationField(payload);
  const occurredAt = stringField(payload, 'occurredAt');
  if (!operation || !occurredAt) return null;

  if (eventName === OASIS_REALTIME_EVENTS.childNotesChanged) {
    return { event: eventName, occurredAt, operation };
  }

  const threadId = stringField(payload, 'threadId');
  if (!threadId) return null;

  return { event: eventName, occurredAt, operation, threadId };
}

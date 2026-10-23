import { REALTIME_DATA_EVENT } from '@oasis/domain';
import { OASIS_REALTIME_EVENTS, parseOasisRealtimeEvent, type OasisRealtimeEvent } from './events';

export interface RealtimeChannelAdapter {
  onBroadcast(event: string, callback: (payload: unknown) => void): void;
  subscribe(callback: (status: string) => void): void;
  remove(): Promise<void>;
}

interface SubscriptionOptions {
  channel: RealtimeChannelAdapter;
  getToken: (fresh: boolean) => Promise<string | null>;
  setAuth: (token: string) => Promise<void>;
  receive: (payload: unknown) => void;
  receiveLegacy: (event: OasisRealtimeEvent) => void;
  subscribed: () => void;
  disconnected: () => void;
  failed: (error: unknown) => void;
}

/** JWT metadata is used only to schedule refresh; server authorization validates it. */
export function tokenRefreshDelay(token: string, now = Date.now()): number | null {
  try {
    const encoded = token.split('.')[1];
    if (!encoded) return null;
    const payload: unknown = JSON.parse(atob(encoded.replace(/-/g, '+').replace(/_/g, '/')));
    if (typeof payload !== 'object' || payload === null || !('exp' in payload)) return null;
    return typeof payload.exp === 'number' && Number.isFinite(payload.exp)
      ? Math.max(1_000, payload.exp * 1_000 - now - 10_000)
      : null;
  } catch {
    return null;
  }
}

export function startRealtimeSubscription(options: SubscriptionOptions): () => Promise<void> {
  let disposed = false;
  const isActive = (): boolean => !disposed;
  let tokenTimer: ReturnType<typeof setTimeout> | undefined;
  const guarded =
    <T>(callback: (value: T) => void) =>
    (value: T) => {
      if (isActive()) callback(value);
    };
  options.channel.onBroadcast(REALTIME_DATA_EVENT, guarded(options.receive));
  for (const eventName of Object.values(OASIS_REALTIME_EVENTS)) {
    options.channel.onBroadcast(
      eventName,
      guarded((payload) => {
        const event = parseOasisRealtimeEvent(eventName, payload);
        if (event) options.receiveLegacy(event);
      }),
    );
  }
  async function authenticate(fresh: boolean): Promise<void> {
    try {
      const token = await options.getToken(fresh);
      if (!isActive()) return;
      if (!token) throw new Error('Live updates require an authenticated session.');
      await options.setAuth(token);
      if (!isActive()) return;
      const delay = tokenRefreshDelay(token);
      if (delay !== null)
        tokenTimer = setTimeout(() => {
          void authenticate(true);
        }, delay);
      if (!fresh) {
        options.channel.subscribe(
          guarded((status) => {
            if (status === 'SUBSCRIBED') options.subscribed();
            else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
              options.disconnected();
            }
          }),
        );
      }
    } catch (error) {
      if (isActive()) options.failed(error);
    }
  }
  void authenticate(false);
  return async () => {
    disposed = true;
    clearTimeout(tokenTimer);
    await options.channel.remove().catch(() => {
      // Cleanup may race a closed transport. No application state remains subscribed.
    });
  };
}

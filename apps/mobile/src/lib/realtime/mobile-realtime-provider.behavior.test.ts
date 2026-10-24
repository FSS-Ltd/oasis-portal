import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mobileTestRenderer, type MobileTestRenderer } from '../../test-utils/mobile-test-renderer';
import { MobileRealtimeProvider } from './mobile-realtime-provider';

const mocks = vi.hoisted(() => {
  const reconcile = vi.fn();
  const receive = vi.fn();
  const dispose = vi.fn();
  const removeChannel = vi.fn(() => Promise.resolve(undefined));
  const removeAllChannels = vi.fn(() => Promise.resolve(undefined));
  const auth = {
    isSignedIn: true,
    userId: 'account-one',
    getToken: () => Promise.resolve('token'),
  };
  const listeners = new Set<() => void>();
  let status: ((value: string) => void) | undefined;
  let broadcast: ((event: { payload: unknown }) => void) | undefined;
  const channel = {
    on: vi.fn((_kind: string, _filter: unknown, handler: typeof broadcast) => {
      broadcast = handler;
      return channel;
    }),
    subscribe: vi.fn((handler: typeof status) => {
      status = handler;
      return channel;
    }),
  };
  return {
    unstableGetToken: false,
    clientOptions: [] as Array<{ accessToken: () => Promise<string | null> }>,
    reconcile,
    receive,
    dispose,
    removeChannel,
    removeAllChannels,
    auth,
    listeners,
    channel,
    coordinator: vi.fn(() => ({ reconcile, receive, dispose, enqueue: vi.fn() })),
    appState: {
      currentState: 'active',
      addEventListener: vi.fn((_event: string, listener: () => void) => {
        listeners.add(listener);
        return { remove: () => listeners.delete(listener) };
      }),
    },
    emitStatus: (value: string) => status?.(value),
    emitBroadcast: (payload: unknown) => broadcast?.({ payload }),
  };
});

const mockUtils = {
  health: {
    me: { fetch: () => Promise.resolve({ accountAccessState: 'active', user: { id: 'one' } }) },
  },
};
vi.mock('../trpc', () => ({ api: { useUtils: () => mockUtils } }));

vi.mock('@clerk/clerk-expo', () => ({
  useAuth: () => {
    const getToken = mocks.auth.getToken;
    return mocks.unstableGetToken ? { ...mocks.auth, getToken: () => getToken() } : mocks.auth;
  },
}));
vi.mock('@supabase/supabase-js', () => ({
  REALTIME_SUBSCRIBE_STATES: {
    SUBSCRIBED: 'SUBSCRIBED',
    CHANNEL_ERROR: 'CHANNEL_ERROR',
    TIMED_OUT: 'TIMED_OUT',
    CLOSED: 'CLOSED',
  },
  createClient: (
    _url: string,
    _key: string,
    options: { accessToken: () => Promise<string | null> },
  ) => {
    mocks.clientOptions.push(options);
    return {
      channel: () => mocks.channel,
      removeChannel: mocks.removeChannel,
      removeAllChannels: mocks.removeAllChannels,
    };
  },
}));
vi.mock('@oasis/domain', () => ({
  REALTIME_DATA_EVENT: 'oasis.data_changed',
  REALTIME_CLOCK_AREAS: ['report', 'staffHome'],
  createRealtimeRefreshCoordinator: mocks.coordinator,
  nextLondonMidnight: () => new Date(Date.now() + 86_400_000),
}));
vi.mock('react-native', () => ({
  AppState: mocks.appState,
  Platform: { OS: 'ios' },
  View: 'View',
  Text: 'Text',
  Pressable: 'Pressable',
  StyleSheet: { create: (styles: unknown) => styles },
}));

function render(client: QueryClient): MobileTestRenderer {
  return mobileTestRenderer.create(
    createElement(
      QueryClientProvider,
      { client },
      createElement(MobileRealtimeProvider, { children: null }),
    ),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listeners.clear();
  mocks.appState.currentState = 'active';
  mocks.auth.userId = 'account-one';
  mocks.auth.getToken = () => Promise.resolve('token');
  mocks.unstableGetToken = false;
  mocks.clientOptions.length = 0;
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'public-key';
});

describe('mobile realtime lifecycle', () => {
  it('keeps one subscription when Clerk recreates getToken and uses the latest token callback', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(0);
    mocks.unstableGetToken = true;
    const client = new QueryClient();
    let renderer: MobileTestRenderer | undefined;
    try {
      mobileTestRenderer.act(() => {
        renderer = render(client);
      });
      expect(mocks.coordinator).toHaveBeenCalledTimes(1);

      mocks.auth.getToken = () => Promise.resolve('next-token');
      mobileTestRenderer.act(() => {
        renderer?.update(
          createElement(
            QueryClientProvider,
            { client },
            createElement(MobileRealtimeProvider, { children: null }),
          ),
        );
      });

      expect(mocks.coordinator).toHaveBeenCalledTimes(1);
      expect(mocks.removeChannel).not.toHaveBeenCalled();
      await expect(mocks.clientOptions[0]?.accessToken()).resolves.toBe('next-token');
    } finally {
      mobileTestRenderer.act(() => {
        renderer?.unmount();
      });
      client.clear();
      now.mockRestore();
    }
  });

  it('waits for subscription before catch-up, forwards broadcasts, and stops on background and unmount', () => {
    const client = new QueryClient();
    let renderer: MobileTestRenderer | undefined;
    mobileTestRenderer.act(() => {
      renderer = render(client);
    });
    expect(mocks.reconcile).not.toHaveBeenCalled();
    mobileTestRenderer.act(() => {
      mocks.emitStatus('SUBSCRIBED');
    });
    expect(mocks.reconcile).toHaveBeenCalledTimes(1);
    mobileTestRenderer.act(() => {
      mocks.emitStatus('CHANNEL_ERROR');
    });
    expect(JSON.stringify(renderer?.toJSON())).toContain('Live updates unavailable');
    mobileTestRenderer.act(() => {
      mocks.emitStatus('SUBSCRIBED');
    });
    expect(mocks.reconcile).toHaveBeenCalledTimes(2);
    const event = { eventId: 'event-one' };
    mocks.emitBroadcast(event);
    expect(mocks.receive).toHaveBeenCalledWith(event);
    mobileTestRenderer.act(() => {
      mocks.appState.currentState = 'background';
      mocks.listeners.forEach((listener) => {
        listener();
      });
    });
    expect(mocks.dispose).toHaveBeenCalledTimes(1);
    expect(mocks.removeChannel).toHaveBeenCalledTimes(1);
    mobileTestRenderer.act(() => {
      mocks.appState.currentState = 'active';
      mocks.listeners.forEach((listener) => {
        listener();
      });
    });
    expect(mocks.coordinator).toHaveBeenCalledTimes(2);
    mobileTestRenderer.act(() => {
      renderer?.unmount();
    });
    expect(mocks.dispose).toHaveBeenCalledTimes(2);
    expect(mocks.listeners.size).toBe(0);
    client.clear();
  });

  it('clears account caches when the Clerk user changes', () => {
    const client = new QueryClient();
    let renderer: MobileTestRenderer | undefined;
    mobileTestRenderer.act(() => {
      renderer = render(client);
    });
    client.setQueryData([['message', 'list']], 'private');
    mobileTestRenderer.act(() => {
      mocks.auth.userId = 'account-two';
      renderer?.update(
        createElement(
          QueryClientProvider,
          { client },
          createElement(MobileRealtimeProvider, { children: null }),
        ),
      );
    });
    expect(client.getQueryData([['message', 'list']])).toBeUndefined();
    expect(mocks.dispose).toHaveBeenCalledTimes(1);
    mobileTestRenderer.act(() => {
      renderer?.unmount();
    });
    client.clear();
  });
});

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import { useQueryClient } from '@tanstack/react-query';
import { createClient, REALTIME_SUBSCRIBE_STATES } from '@supabase/supabase-js';
import { AppState, Platform, StyleSheet, View } from 'react-native';
import {
  createRealtimeRefreshCoordinator,
  nextLondonMidnight,
  REALTIME_DATA_EVENT,
  REALTIME_CLOCK_AREAS,
} from '@oasis/domain';
import { refreshMobileQueries } from './query-refresh';
import { api } from '../trpc';
import { SchoolClockContext } from './school-clock';

export function MobileRealtimeProvider({ children }: { children: ReactNode }) {
  const { getToken, isSignedIn, userId, sessionId } = useAuth();
  const queryClient = useQueryClient();
  const utils = api.useUtils();
  // Clerk Expo recreates getToken each render; keep it fresh without restarting subscriptions.
  const current = useRef({ getToken, utils });
  current.current = { getToken, utils };
  const fetchAuthority = useCallback(
    () => current.current.utils.health.me.fetch(undefined, { staleTime: 0 }),
    [],
  );
  const [schoolNow, setSchoolNow] = useState(() => Date.now());

  useEffect(() => {
    if (!isSignedIn || !userId) return;
    const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) return;
    const settings = { url, key, userId };
    let stopped = false;
    let stopSession: (() => void) | undefined;
    let midnight: ReturnType<typeof setTimeout> | undefined;
    const visible = () =>
      AppState.currentState !== 'background' &&
      AppState.currentState !== 'inactive' &&
      (Platform.OS !== 'web' ||
        typeof document === 'undefined' ||
        document.visibilityState === 'visible');

    function stop() {
      stopSession?.();
      stopSession = undefined;
      clearTimeout(midnight);
    }

    function start() {
      if (stopped || !visible() || stopSession) return;
      const client = createClient(settings.url, settings.key, {
        accessToken: () => current.current.getToken(),
        auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
        realtime: {
          reconnectAfterMs: (tries: number) => Math.min(1_000 * 2 ** Math.min(tries, 5), 30_000),
        },
      });
      setSchoolNow(Date.now());
      let disposed = false;
      const coordinator = createRealtimeRefreshCoordinator({
        refresh: async (areas) => {
          await refreshMobileQueries(queryClient, areas, fetchAuthority, () => !disposed);
        },
        onError: () => {
          // Reconnection is automatic (backoff, foreground return); there is nothing to show.
        },
      });
      const channel = client.channel(`oasis:user:${settings.userId}`, {
        config: { private: true },
      });
      channel.on('broadcast', { event: REALTIME_DATA_EVENT }, ({ payload }) =>
        coordinator.receive(payload),
      );
      channel.subscribe((status) => {
        if (disposed) return;
        if (status === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED) coordinator.reconcile();
      });
      function scheduleMidnight() {
        midnight = setTimeout(() => {
          setSchoolNow(Date.now());
          coordinator.enqueue(REALTIME_CLOCK_AREAS);
          scheduleMidnight();
        }, nextLondonMidnight().getTime() - Date.now());
      }
      scheduleMidnight();
      stopSession = () => {
        disposed = true;
        coordinator.dispose();
        void client.removeChannel(channel);
      };
    }

    const onVisibility = () => {
      if (visible()) start();
      else stop();
    };
    const subscription = AppState.addEventListener('change', onVisibility);
    if (Platform.OS === 'web' && typeof document !== 'undefined')
      document.addEventListener('visibilitychange', onVisibility);
    start();
    return () => {
      stopped = true;
      stop();
      subscription.remove();
      if (Platform.OS === 'web' && typeof document !== 'undefined')
        document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [fetchAuthority, isSignedIn, queryClient, userId, sessionId]);

  // A session swap must never reuse another account's cached data.
  useEffect(
    () => () => {
      void queryClient.cancelQueries();
      queryClient.clear();
    },
    [queryClient, userId, isSignedIn, sessionId],
  );

  return (
    <SchoolClockContext.Provider value={schoolNow}>
      <View style={styles.shell}>{children}</View>
    </SchoolClockContext.Provider>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
});

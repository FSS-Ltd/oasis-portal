import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import { useQueryClient } from '@tanstack/react-query';
import { createClient, REALTIME_SUBSCRIBE_STATES } from '@supabase/supabase-js';
import { AppState, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  createRealtimeRefreshCoordinator,
  nextLondonMidnight,
  REALTIME_DATA_EVENT,
  REALTIME_CLOCK_AREAS,
} from '@oasis/domain';
import { refreshMobileQueries } from './query-refresh';
import { C } from '../../components/core/mobile-theme';
import { api } from '../trpc';
import { SchoolClockContext } from './school-clock';

type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'unconfigured';

export function MobileRealtimeProvider({ children }: { children: ReactNode }) {
  const { getToken, isSignedIn, userId, sessionId } = useAuth();
  const queryClient = useQueryClient();
  const utils = api.useUtils();
  const fetchAuthority = useCallback(
    () => utils.health.me.fetch(undefined, { staleTime: 0 }),
    [utils],
  );
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const [attempt, setAttempt] = useState(0);
  const [schoolNow, setSchoolNow] = useState(() => Date.now());
  const retry = useCallback(() => {
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!isSignedIn || !userId) return;
    const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) {
      setConnection('unconfigured');
      return;
    }
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
        accessToken: getToken,
        auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
        realtime: {
          reconnectAfterMs: (tries: number) => Math.min(1_000 * 2 ** Math.min(tries, 5), 30_000),
        },
      });
      setConnection('connecting');
      setSchoolNow(Date.now());
      let disposed = false;
      let subscribed = false;
      const coordinator = createRealtimeRefreshCoordinator({
        refresh: async (areas) => {
          await refreshMobileQueries(queryClient, areas, fetchAuthority, () => !disposed);
          if (!disposed && subscribed) setConnection('connected');
        },
        onError: () => {
          if (!disposed) setConnection('disconnected');
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
        if (status === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED) {
          subscribed = true;
          coordinator.reconcile();
        }
        if (
          status === REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR ||
          status === REALTIME_SUBSCRIBE_STATES.TIMED_OUT ||
          status === REALTIME_SUBSCRIBE_STATES.CLOSED
        ) {
          subscribed = false;
          setConnection('disconnected');
        }
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
  }, [attempt, fetchAuthority, getToken, isSignedIn, queryClient, userId, sessionId]);

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
      <View style={styles.shell}>
        {isSignedIn && connection !== 'connected' ? (
          <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.warning}>
            <Text style={styles.message}>
              {connection === 'connecting'
                ? 'Connecting live updates…'
                : 'Live updates unavailable. Information may be out of date.'}
            </Text>
            {connection !== 'connecting' ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Retry live updates"
                onPress={retry}
              >
                <Text style={styles.retry}>Retry</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        {children}
      </View>
    </SchoolClockContext.Provider>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  warning: { backgroundColor: C.warningBg, flexDirection: 'row', gap: 12, padding: 12 },
  message: { color: C.warning, flex: 1, fontSize: 12 },
  retry: { color: C.warning, fontWeight: '700', paddingHorizontal: 8 },
});

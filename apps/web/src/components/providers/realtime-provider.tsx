'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { useSession, useUser } from '@clerk/nextjs';
import { usePathname, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import {
  createRealtimeRefreshCoordinator,
  nextLondonMidnight,
  REALTIME_AREAS,
  REALTIME_CLOCK_AREAS,
  REALTIME_AUTHORITY_AREAS,
  type RealtimeArea,
} from '@oasis/domain';
import { createClient } from '@/lib/supabase/client';
import { api } from '@/lib/trpc';
import { OASIS_REALTIME_EVENTS, type OasisRealtimeEvent } from '@/lib/realtime/events';
import { startRealtimeSubscription } from '@/lib/realtime/subscription';
import { refreshRealtimeQueries } from '@/lib/realtime/query-cache';
import {
  clearProtectedRealtimeData,
  refreshAccountAuthority,
} from '@/lib/realtime/account-authority';
import { routeDependsOnAreas } from '@/lib/realtime/route-dependencies';
import { notifyRealtimeAreas } from '@/lib/realtime/area-listeners';

function legacyAreas(event: OasisRealtimeEvent): readonly RealtimeArea[] {
  if (event.event === OASIS_REALTIME_EVENTS.childNotesChanged) return ['childNotes', 'childLog'];
  if ('groupId' in event) return ['community'];
  return ['message'];
}

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, session } = useSession();
  const { user } = useUser();
  const utils = api.useUtils();
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const current = useRef({ session, utils, pathname, router });
  current.current = { session, utils, pathname, router };
  const previousIdentity = useRef<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    const identity = isSignedIn ? `${user?.id ?? ''}:${session.id}` : null;
    if (previousIdentity.current !== null && previousIdentity.current !== identity) {
      void queryClient.cancelQueries().then(() => {
        if (previousIdentity.current !== identity) return;
        clearProtectedRealtimeData(queryClient, true);
        queryClient.clear();
      });
    }
    previousIdentity.current = identity;
  }, [isLoaded, isSignedIn, user?.id, session?.id, queryClient]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user?.id) return;
    const channelUserId = user.id;
    let disposed = false;
    const isActive = (): boolean => !disposed && document.visibilityState !== 'hidden';
    let stopSubscription: (() => Promise<void>) | undefined;
    let removal = Promise.resolve();
    let connectionGeneration = 0;
    let clockTimer: ReturnType<typeof setTimeout> | undefined;
    let authority: string | undefined;
    let supabase: ReturnType<typeof createClient>;
    try {
      supabase = createClient({
        accessToken: async () => current.current.session?.getToken() ?? null,
      });
    } catch {
      return;
    }
    const coordinator = createRealtimeRefreshCoordinator({
      async refresh(areas, reconcile) {
        if (!isActive()) return;
        if (reconcile || REALTIME_AUTHORITY_AREAS.some((area) => areas.includes(area))) {
          const result = await refreshAccountAuthority(
            queryClient,
            () => current.current.utils.health.me.fetch(undefined, { staleTime: 0 }),
            authority,
            isActive,
          );
          if (!result) return;
          if (result.redirect) {
            current.current.router.replace(result.redirect);
            return;
          }
          authority = result.fingerprint;
          if (result.changed) {
            notifyRealtimeAreas(REALTIME_AREAS);
            current.current.router.refresh();
            return;
          }
        }
        if (!isActive()) return;
        notifyRealtimeAreas(areas);
        await refreshRealtimeQueries(queryClient, areas, isActive);
        if (
          isActive() &&
          (reconcile || routeDependsOnAreas(current.current.pathname ?? '', areas))
        ) {
          // React's router refresh merges server output and preserves local form state.
          current.current.router.refresh();
        }
      },
      onError() {
        // Reconnection is automatic (visibility and network events); there is nothing to show.
      },
    });

    function scheduleClock(): void {
      clearTimeout(clockTimer);
      if (disposed || document.visibilityState === 'hidden') return;
      clockTimer = setTimeout(() => {
        coordinator.enqueue(REALTIME_CLOCK_AREAS);
        scheduleClock();
      }, nextLondonMidnight().getTime() - Date.now());
    }
    function disconnect(): void {
      connectionGeneration++;
      if (stopSubscription) removal = stopSubscription();
      stopSubscription = undefined;
    }
    async function connect(): Promise<void> {
      disconnect();
      const generation = connectionGeneration;
      // Supabase reuses a channel with the same topic until removal finishes.
      await removal;
      if (generation !== connectionGeneration || disposed || document.visibilityState === 'hidden')
        return;
      const channel = supabase.channel(`oasis:user:${channelUserId}`, {
        config: { private: true },
      });
      stopSubscription = startRealtimeSubscription({
        channel: {
          onBroadcast(event, callback) {
            channel.on('broadcast', { event }, ({ payload }) => {
              callback(payload);
            });
          },
          subscribe(callback) {
            channel.subscribe(callback);
          },
          async remove() {
            await supabase.removeChannel(channel);
          },
        },
        getToken: async (fresh) => current.current.session?.getToken({ skipCache: fresh }) ?? null,
        setAuth: (token) => supabase.realtime.setAuth(token),
        receive: (payload) => {
          coordinator.receive(payload);
        },
        receiveLegacy: (event) => {
          coordinator.enqueue(legacyAreas(event));
        },
        subscribed() {
          if (disposed) return;
          coordinator.reconcile();
        },
        disconnected() {
          // Reconnects on its own; no status is shown.
        },
        failed() {
          // Reconnects on its own; no status is shown.
        },
      });
      scheduleClock();
    }
    function visibilityChanged(): void {
      if (document.visibilityState === 'hidden') {
        disconnect();
        clearTimeout(clockTimer);
      } else void connect();
    }
    function online(): void {
      void connect();
    }
    void connect();
    document.addEventListener('visibilitychange', visibilityChanged);
    window.addEventListener('online', online);
    return () => {
      disposed = true;
      disconnect();
      coordinator.dispose();
      clearTimeout(clockTimer);
      document.removeEventListener('visibilitychange', visibilityChanged);
      window.removeEventListener('online', online);
    };
  }, [isLoaded, isSignedIn, user?.id, session?.id, queryClient]);

  return <>{children}</>;
}

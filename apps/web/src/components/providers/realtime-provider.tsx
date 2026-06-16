'use client';

import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useSession, useUser } from '@clerk/nextjs';
import { createClient } from '@/lib/supabase/client';
import { api } from '@/lib/trpc';
import {
  OASIS_REALTIME_EVENTS,
  parseOasisRealtimeEvent,
  type OasisRealtimeEvent,
} from '@/lib/realtime/events';

interface RealtimeProviderProps {
  children: ReactNode;
}

function invalidateForRealtimeEvent(
  utils: ReturnType<typeof api.useUtils>,
  event: OasisRealtimeEvent,
): void {
  switch (event.event) {
    case OASIS_REALTIME_EVENTS.messageChanged:
    case OASIS_REALTIME_EVENTS.messageReadChanged:
    case OASIS_REALTIME_EVENTS.messageThreadChanged:
      void utils.message.listConversations.invalidate();
      void utils.message.listConversationMessages.invalidate();
      void utils.message.listThreads.invalidate();
      void utils.message.listInThread.invalidate({ threadId: event.threadId });
      return;

    case OASIS_REALTIME_EVENTS.communityGroupChanged:
    case OASIS_REALTIME_EVENTS.communityMessageChanged:
    case OASIS_REALTIME_EVENTS.communityReadChanged:
    case OASIS_REALTIME_EVENTS.communityMemberChanged:
      void utils.community.listStudentGroups.invalidate();
      void utils.community.listGroupMessages.invalidate({ groupId: event.groupId });
      void utils.community.listAdminGroups.invalidate();
      void utils.community.listStudentModeration.invalidate();
      return;

    case OASIS_REALTIME_EVENTS.childNotesChanged:
      void utils.childNotes.listForStudent.invalidate();
      void utils.childLog.snapshot.invalidate();
      void utils.childLog.centreSnapshot.invalidate();
      void utils.childLog.drillThrough.invalidate();
      void utils.childLog.supervisorNotesHistory.invalidate();
      return;
  }
}

export function RealtimeProvider({ children }: RealtimeProviderProps) {
  const { isLoaded, isSignedIn, session } = useSession();
  const { user } = useUser();
  const utils = api.useUtils();
  const sessionRef = useRef(session);
  const utilsRef = useRef(utils);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    utilsRef.current = utils;
  }, [utils]);

  const supabase = useMemo(
    () =>
      createClient({
        accessToken: async () => sessionRef.current?.getToken() ?? null,
      }),
    [],
  );

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user?.id) return;

    const channel = supabase.channel(`oasis:user:${user.id}`, {
      config: { private: true },
    });

    Object.values(OASIS_REALTIME_EVENTS).forEach((eventName) => {
      channel.on('broadcast', { event: eventName }, ({ payload }) => {
        const event = parseOasisRealtimeEvent(eventName, payload);
        if (!event) return;

        invalidateForRealtimeEvent(utilsRef.current, event);
      });
    });

    channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [isLoaded, isSignedIn, supabase, user?.id]);

  return children;
}

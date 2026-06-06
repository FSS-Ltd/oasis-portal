'use client';

import { useEffect, useMemo, type ReactNode } from 'react';
import { AlertTriangle, Clock, Lock, Loader2 } from 'lucide-react';
import { friendlyErrorMessage } from '@/lib/notifications';
import { api } from '@/lib/trpc';

type StudentAccessState = 'access-denied' | 'locked' | 'loading' | 'not-ready' | 'usage-limit';

const HEARTBEAT_INTERVAL_MS = 55_000;
const HEARTBEAT_RETRY_MS = 10_000;

interface StudentPortalGateProps {
  children: ReactNode;
}

function isLockedMessage(message: string | undefined): boolean {
  return Boolean(message?.toLowerCase().includes('student portal is locked'));
}

function isOffLimitDayMessage(message: string | undefined): boolean {
  return Boolean(message?.toLowerCase().includes('student portal is off limits today'));
}

function isUsageLimitMessage(message: string | undefined): boolean {
  const normalized = message?.toLowerCase();
  return Boolean(normalized?.includes('student portal usage limit reached'));
}

function accessStateFromError(message: string | undefined): StudentAccessState {
  if (isOffLimitDayMessage(message)) return 'locked';
  if (isLockedMessage(message)) return 'locked';
  if (isUsageLimitMessage(message)) return 'usage-limit';
  if (message?.toLowerCase().includes('student profile not found')) return 'not-ready';
  return 'access-denied';
}

function accessStateFromHeartbeatError(message: string | undefined): StudentAccessState | null {
  if (isOffLimitDayMessage(message)) return 'locked';
  if (isLockedMessage(message)) return 'locked';
  if (isUsageLimitMessage(message)) return 'usage-limit';
  if (message?.toLowerCase().includes('student profile not found')) return 'not-ready';
  return null;
}

function messageFromUnknown(error: unknown): string | undefined {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (typeof error !== 'object' || error === null) return undefined;

  const message = (error as { message?: unknown }).message;
  return typeof message === 'string' ? message : undefined;
}

function studentPortalDetail(state: StudentAccessState, message: string | undefined): string {
  const normalized = message?.toLowerCase() ?? '';
  if (state === 'locked') {
    if (
      normalized.includes('student portal is locked by oasis learning centre') ||
      normalized.includes('student portal is locked by a parent or carer')
    ) {
      return message ?? 'Your student portal is locked right now.';
    }
    return normalized.includes('student portal is off limits today')
      ? 'The student portal is off limits today.'
      : 'Your student portal is locked right now.';
  }
  if (state === 'usage-limit') {
    return "You have reached today's student portal time limit.";
  }
  if (state === 'not-ready') {
    return 'No active student profile is linked to this account yet.';
  }
  if (state === 'loading') {
    return 'Preparing your student portal.';
  }
  return friendlyErrorMessage(message, 'This account cannot open the student portal right now.');
}

function StudentPortalStatePanel({
  detail,
  state,
}: {
  detail?: string | undefined;
  state: StudentAccessState;
}) {
  const Icon =
    state === 'locked'
      ? Lock
      : state === 'usage-limit'
        ? Clock
        : state === 'loading'
          ? Loader2
          : AlertTriangle;
  const title =
    state === 'locked'
      ? 'Student portal locked'
      : state === 'usage-limit'
        ? 'Usage limit reached'
        : state === 'loading'
          ? 'Loading student portal'
          : state === 'not-ready'
            ? 'Student portal not ready'
            : 'Student portal unavailable';
  const body = detail ?? studentPortalDetail(state, undefined);

  return (
    <section aria-live="polite" className={`student-state-card student-state-card--${state}`}>
      <span className="student-state-card__icon">
        <Icon
          aria-hidden="true"
          className={state === 'loading' ? 'is-spinning' : undefined}
          size={22}
        />
      </span>
      <div>
        <h1>{title}</h1>
        <p>{body}</p>
      </div>
    </section>
  );
}

export function StudentPortalGate({ children }: StudentPortalGateProps) {
  const sessionKey = useMemo(
    () => `student-web-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
    [],
  );
  const student = api.student.me.useQuery(undefined, { retry: false });
  const { error: heartbeatError, mutateAsync: sendHeartbeat } = api.student.heartbeat.useMutation();
  const heartbeatBlockedState = accessStateFromHeartbeatError(heartbeatError?.message);
  const blockedState = student.error
    ? accessStateFromError(student.error.message)
    : heartbeatBlockedState;
  const blockedMessage =
    student.error?.message ?? (heartbeatBlockedState ? heartbeatError?.message : undefined);

  useEffect(() => {
    if (!student.data?.id || blockedState) return undefined;

    let cancelled = false;
    let timeoutId: number | undefined;

    const scheduleHeartbeat = (delayMs: number): void => {
      timeoutId = window.setTimeout(() => {
        void runHeartbeat();
      }, delayMs);
    };

    async function runHeartbeat(): Promise<void> {
      try {
        await sendHeartbeat({ sessionKey });
        if (!cancelled) scheduleHeartbeat(HEARTBEAT_INTERVAL_MS);
      } catch (error) {
        if (cancelled) return;
        if (accessStateFromHeartbeatError(messageFromUnknown(error))) return;
        scheduleHeartbeat(HEARTBEAT_RETRY_MS);
      }
    }

    scheduleHeartbeat(0);

    return () => {
      cancelled = true;
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, [blockedState, sendHeartbeat, sessionKey, student.data?.id]);

  if (student.isLoading) {
    return <StudentPortalStatePanel state="loading" />;
  }

  if (blockedState) {
    return (
      <StudentPortalStatePanel
        detail={studentPortalDetail(blockedState, blockedMessage)}
        state={blockedState}
      />
    );
  }

  return <>{children}</>;
}

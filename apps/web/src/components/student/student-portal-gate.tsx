'use client';

import { useEffect, useMemo, type ReactNode } from 'react';
import { AlertTriangle, Clock, Lock, Loader2 } from 'lucide-react';
import { api } from '@/lib/trpc';

type StudentAccessState = 'access-denied' | 'locked' | 'loading' | 'not-ready' | 'usage-limit';

interface StudentPortalGateProps {
  children: ReactNode;
}

function isLockedMessage(message: string | undefined): boolean {
  return Boolean(message?.toLowerCase().includes('student portal is locked'));
}

function isUsageLimitMessage(message: string | undefined): boolean {
  return Boolean(message?.toLowerCase().includes('student portal usage limit reached'));
}

function accessStateFromError(message: string | undefined): StudentAccessState {
  if (isLockedMessage(message)) return 'locked';
  if (isUsageLimitMessage(message)) return 'usage-limit';
  if (message?.toLowerCase().includes('student profile not found')) return 'not-ready';
  return 'access-denied';
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
  const body =
    detail ??
    (state === 'loading'
      ? 'Preparing your student portal.'
      : state === 'not-ready'
        ? 'No active student profile is linked to this account yet.'
        : 'This account cannot open the student portal.');

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
  const heartbeat = api.student.heartbeat.useMutation();
  const errorMessage = heartbeat.error?.message ?? student.error?.message;
  const blockedState = errorMessage ? accessStateFromError(errorMessage) : null;

  useEffect(() => {
    if (!student.data?.id || blockedState) return undefined;

    heartbeat.mutate({ sessionKey });
    const intervalId = window.setInterval(() => {
      heartbeat.mutate({ sessionKey });
    }, 55_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [blockedState, sessionKey, student.data?.id]);

  if (student.isLoading) {
    return <StudentPortalStatePanel state="loading" />;
  }

  if (blockedState) {
    return <StudentPortalStatePanel detail={errorMessage} state={blockedState} />;
  }

  return <>{children}</>;
}

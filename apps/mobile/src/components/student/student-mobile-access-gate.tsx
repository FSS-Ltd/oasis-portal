import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { api, type RouterOutputs } from '../../lib/trpc';
import { C } from '../core/mobile-theme';
import { Card, ErrorText, InlineSpinner, MutedText, SectionTitle } from '../core/mobile-ui';

type StudentPortalUsage = RouterOutputs['student']['portalUsage']['usage'];
type StudentAccessState =
  | 'allowed'
  | 'denied'
  | 'heartbeat-failed'
  | 'loading'
  | 'locked'
  | 'not-ready'
  | 'off-limit'
  | 'usage-limit';
type HeartbeatStatus = 'failed' | 'idle' | 'ready' | 'checking';

const HEARTBEAT_INTERVAL_MS = 55_000;
const HEARTBEAT_RETRY_MS = 10_000;

interface StudentMobileAccessGateProps {
  children: ReactNode;
  onSignOut: () => void;
}

function isLockedMessage(message: string | undefined): boolean {
  return Boolean(message?.toLowerCase().includes('student portal is locked'));
}

function isOffLimitDayMessage(message: string | undefined): boolean {
  return Boolean(message?.toLowerCase().includes('student portal is off limits today'));
}

function isUsageLimitMessage(message: string | undefined): boolean {
  return Boolean(message?.toLowerCase().includes('student portal usage limit reached'));
}

function isNoProfileMessage(message: string | undefined): boolean {
  return Boolean(message?.toLowerCase().includes('student profile not found'));
}

function messageFromUnknown(error: unknown): string | undefined {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (typeof error !== 'object' || error === null) return undefined;
  const message = (error as { message?: unknown }).message;
  return typeof message === 'string' ? message : undefined;
}

export function accessStateFromStudentAccessError(
  message: string | undefined,
): Exclude<StudentAccessState, 'allowed' | 'heartbeat-failed' | 'loading'> {
  if (isOffLimitDayMessage(message)) return 'off-limit';
  if (isLockedMessage(message)) return 'locked';
  if (isUsageLimitMessage(message)) return 'usage-limit';
  if (isNoProfileMessage(message)) return 'not-ready';
  return 'denied';
}

export function accessStateFromUsageStatus(usage: StudentPortalUsage): StudentAccessState {
  if (usage.allowed) return 'allowed';
  if (usage.blockedReason === 'OffLimitDay') return 'off-limit';
  if (usage.blockedReason === 'DailyLimit') return 'usage-limit';
  return 'denied';
}

function detailForState(state: StudentAccessState, message: string | null | undefined): string {
  if (state === 'loading') return 'One moment while we open your portal.';
  if (state === 'locked') return message ?? 'Student portal is locked right now.';
  if (state === 'off-limit') {
    return message ?? 'Student portal is off limits today. Try again on the next available day.';
  }
  if (state === 'usage-limit') {
    return message ?? 'Daily student portal usage limit reached.';
  }
  if (state === 'not-ready') return 'No active student profile is linked to this account.';
  if (state === 'heartbeat-failed') {
    return 'We need to update your usage timer before you continue.';
  }
  if (state === 'allowed') return 'Enter student portal';
  return message ?? 'This account cannot open the student portal right now.';
}

function titleForState(state: StudentAccessState): string {
  if (state === 'loading') return 'Loading student portal';
  if (state === 'locked') return 'Student portal locked';
  if (state === 'off-limit') return 'Off-limit day';
  if (state === 'usage-limit') return 'Usage limit reached';
  if (state === 'not-ready') return 'Student portal not ready';
  if (state === 'heartbeat-failed') return 'Heartbeat failed';
  if (state === 'allowed') return 'Enter student portal';
  return 'Student portal unavailable';
}

function usageMeta(usage: StudentPortalUsage | undefined): string | null {
  if (!usage) return null;
  const limit = usage.daily.limitMinutes;
  if (limit === null) return null;
  return `${String(usage.daily.usedMinutes)} of ${String(limit)} minutes used today.`;
}

export function StudentMobileAccessGate({ children, onSignOut }: StudentMobileAccessGateProps) {
  const sessionKey = useMemo(
    () => `student-mobile-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
    [],
  );
  const [heartbeatStatus, setHeartbeatStatus] = useState<HeartbeatStatus>('idle');
  const [heartbeatMessage, setHeartbeatMessage] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const studentAccess = api.student.portalUsage.useQuery(undefined, { retry: false });
  const studentHeartbeat = api.student.heartbeat.useMutation();
  const sendStudentHeartbeat = studentHeartbeat.mutateAsync;

  const accessErrorState = studentAccess.error
    ? accessStateFromStudentAccessError(studentAccess.error.message)
    : null;
  const usageState = studentAccess.data
    ? accessStateFromUsageStatus(studentAccess.data.usage)
    : null;
  const blockedState =
    accessErrorState ?? (usageState && usageState !== 'allowed' ? usageState : null);
  const state: StudentAccessState = studentAccess.isLoading
    ? 'loading'
    : (blockedState ??
      (heartbeatStatus === 'ready'
        ? 'allowed'
        : heartbeatStatus === 'failed'
          ? 'heartbeat-failed'
          : 'loading'));
  const stateMessage =
    studentAccess.error?.message ??
    studentAccess.data?.usage.message ??
    heartbeatMessage ??
    undefined;

  useEffect(() => {
    if (!studentAccess.data?.usage.allowed || blockedState) return undefined;

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    function runHeartbeat(delayMs: number): void {
      timeoutId = setTimeout(() => {
        setHeartbeatStatus('checking');
        void sendStudentHeartbeat({ sessionKey })
          .then((result) => {
            if (cancelled) return;
            const nextState = accessStateFromUsageStatus(result.usage);
            if (nextState !== 'allowed') {
              setHeartbeatStatus('failed');
              setHeartbeatMessage(
                result.usage.message ?? 'Daily student portal usage limit reached.',
              );
              return;
            }
            setHeartbeatStatus('ready');
            setHeartbeatMessage(null);
            runHeartbeat(HEARTBEAT_INTERVAL_MS);
          })
          .catch((error: unknown) => {
            if (cancelled) return;
            const message = messageFromUnknown(error);
            const nextState = accessStateFromStudentAccessError(message);
            setHeartbeatStatus('failed');
            setHeartbeatMessage(
              nextState === 'denied' ? 'Heartbeat failed' : (message ?? 'Heartbeat failed'),
            );
            if (nextState === 'denied') runHeartbeat(HEARTBEAT_RETRY_MS);
          });
      }, delayMs);
    }

    runHeartbeat(0);

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [blockedState, retryNonce, sendStudentHeartbeat, sessionKey, studentAccess.data]);

  async function retryAccess() {
    setRetrying(true);
    try {
      setHeartbeatStatus('idle');
      setHeartbeatMessage(null);
      await studentAccess.refetch();
      setRetryNonce((value) => value + 1);
    } finally {
      setRetrying(false);
    }
  }

  if (state === 'allowed') {
    return <>{children}</>;
  }

  const usageDetail = usageMeta(studentAccess.data?.usage);

  return (
    <View style={styles.wrap}>
      <Card style={styles.card}>
        <Text style={styles.eyebrow}>Student access</Text>
        <SectionTitle>{titleForState(state)}</SectionTitle>
        {state === 'loading' ? <InlineSpinner label="Checking student access" /> : null}
        <MutedText>{detailForState(state, stateMessage)}</MutedText>
        {usageDetail ? <Text style={styles.meta}>{usageDetail}</Text> : null}
        {state === 'denied' || state === 'heartbeat-failed' ? (
          <ErrorText>{stateMessage ?? 'Could not check access'}</ErrorText>
        ) : null}
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            disabled={studentAccess.isFetching || retrying}
            onPress={() => {
              void retryAccess();
            }}
            style={[styles.primaryAction, retrying ? styles.disabled : null]}
          >
            <Text style={styles.primaryActionText}>Retry</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onSignOut} style={styles.secondaryAction}>
            <Text style={styles.secondaryActionText}>Sign out</Text>
          </Pressable>
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  card: {
    gap: 12,
    padding: 16,
  },
  disabled: {
    opacity: 0.5,
  },
  eyebrow: {
    color: C.crimson,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  meta: {
    backgroundColor: C.blueLight,
    borderRadius: 8,
    color: C.navy,
    fontSize: 12,
    fontWeight: '800',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  primaryAction: {
    alignItems: 'center',
    backgroundColor: C.navy,
    borderRadius: 8,
    minHeight: 40,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  primaryActionText: {
    color: C.surface,
    fontSize: 13,
    fontWeight: '900',
  },
  secondaryAction: {
    alignItems: 'center',
    backgroundColor: C.surface,
    borderColor: C.border,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 40,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  secondaryActionText: {
    color: C.navy,
    fontSize: 13,
    fontWeight: '900',
  },
  wrap: {
    gap: 14,
    padding: 16,
  },
});

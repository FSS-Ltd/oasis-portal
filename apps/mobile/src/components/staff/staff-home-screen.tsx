import { useMemo } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useClerk } from '@clerk/clerk-expo';
import { api, type RouterOutputs } from '../../lib/trpc';
import { C } from '../smoke/mobile-theme';
import { Badge, Card, ErrorText, InlineSpinner, MutedText } from '../smoke/smoke-ui';
import { PortalMobileHeader } from '../smoke/portal-mobile-shell';
import {
  buildStaffHomeViewModel,
  type StaffHomeQuickAction,
  type StaffHomeSummary,
} from './staff-home-model';

type SessionUser = NonNullable<RouterOutputs['health']['me']['user']>;
type StaffHomeSummaryOutput = RouterOutputs['staffHome']['summary'];
const schoolTimeZone = 'Europe/London';

function datePartsInSchoolTimeZone(value: Date): { day: string; month: string; year: string } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    timeZone: schoolTimeZone,
    year: 'numeric',
  }).formatToParts(value);

  return {
    day: parts.find((part) => part.type === 'day')?.value ?? '01',
    month: parts.find((part) => part.type === 'month')?.value ?? '01',
    year: parts.find((part) => part.type === 'year')?.value ?? '1970',
  };
}

function todayDate(): Date {
  const parts = datePartsInSchoolTimeZone(new Date());
  return new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00.000Z`);
}

function greetingName(user: SessionUser | undefined): string {
  if (!user) return 'staff';
  return user.role;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'full', timeZone: 'UTC' }).format(
    new Date(`${value}T00:00:00.000Z`),
  );
}

function formatTime(value: string | Date): string {
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(
    new Date(value),
  );
}

function nextShiftLabel(summary: StaffHomeSummaryOutput): string {
  const shift = summary.rota.nextShift;
  if (!shift) return 'No upcoming shift';
  const label = shift.kind === 'Meeting' ? 'Meeting' : (shift.bandName ?? 'Cover');
  return `${label} · ${formatTime(shift.startsAt)}-${formatTime(shift.endsAt)}`;
}

function toViewModelInput(summary: StaffHomeSummaryOutput): StaffHomeSummary {
  return {
    ...summary,
    rota: {
      ...summary.rota,
      nextShift: summary.rota.nextShift
        ? {
            ...summary.rota.nextShift,
            endsAt: summary.rota.nextShift.endsAt,
            startsAt: summary.rota.nextShift.startsAt,
          }
        : null,
    },
  };
}

export function StaffHomeScreen({
  onOpenAttendance,
  onOpenBehaviour,
  onOpenCommunications,
  onOpenRota,
  user,
}: {
  onOpenAttendance?: () => void;
  onOpenBehaviour?: () => void;
  onOpenCommunications?: () => void;
  onOpenRota?: () => void;
  user: SessionUser | undefined;
}) {
  const { signOut } = useClerk();
  const summary = api.staffHome.summary.useQuery({ date: todayDate() }, { retry: false });
  const data = summary.data;
  const view = useMemo(
    () => (data ? buildStaffHomeViewModel(toViewModelInput(data)) : null),
    [data],
  );

  async function refresh() {
    await summary.refetch();
  }

  return (
    <SafeAreaView style={styles.shell}>
      <PortalMobileHeader
        actionAccessibilityLabel="Sign out of staff account"
        actionLabel="Out"
        avatarLabel="S"
        eyebrow="Staff Portal"
        onActionPress={() => {
          void signOut();
        }}
        subtitle={`${greetingName(user)} · Daily workflow`}
        title="Oasis Learning Centre"
        variant="dark"
      />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            onRefresh={() => {
              void refresh();
            }}
            refreshing={summary.isFetching}
          />
        }
        style={styles.scroller}
      >
        {summary.isLoading ? <InlineSpinner label="Loading staff home" /> : null}
        {summary.error ? <ErrorText>{summary.error.message}</ErrorText> : null}

        {data && view ? (
          <>
            <View style={styles.intro}>
              <Text style={styles.eyebrow}>{formatDate(data.date)}</Text>
              <Text style={styles.title}>Good morning</Text>
              <Text style={styles.subtitle}>Daily command centre for today's operations.</Text>
            </View>

            <View style={styles.metricGrid}>
              <MetricCard
                label="Rota"
                sub="shifts this week"
                value={String(data.rota.shiftsThisWeek)}
              />
              <MetricCard
                label="Attendance"
                sub={view.attendanceProgressLabel}
                tone={data.attendance.unmarked > 0 ? 'warning' : 'success'}
                value={`${String(view.attendanceCompletionPercent)}%`}
              />
              <MetricCard
                label="PACE"
                sub="tests today"
                value={String(data.pace.testsRecordedToday)}
              />
              <MetricCard
                label={data.permissions.canUseShopCounter ? 'Shop' : 'Notices'}
                sub={data.permissions.canUseShopCounter ? 'pickups ready' : 'unread staff notices'}
                tone={
                  (data.permissions.canUseShopCounter
                    ? data.shop.readyReservationCount
                    : data.notices.unread) > 0
                    ? 'warning'
                    : 'default'
                }
                value={String(
                  data.permissions.canUseShopCounter
                    ? data.shop.readyReservationCount
                    : data.notices.unread,
                )}
              />
            </View>

            <Card style={styles.nextTaskCard}>
              <View style={styles.rowHeader}>
                <View style={styles.rowBody}>
                  <Text style={styles.cardTitle}>Next task</Text>
                  <Text style={styles.nextTaskTitle}>{view.nextTask.title}</Text>
                  <MutedText>{nextShiftLabel(data)}</MutedText>
                </View>
                <Badge variant={view.nextTask.tone === 'warning' ? 'warning' : 'blue'}>
                  {view.nextTask.metric}
                </Badge>
              </View>
            </Card>

            <Card style={styles.compactCard}>
              <View style={styles.rowHeader}>
                <Text style={styles.cardTitle}>Attendance today</Text>
                <Badge variant={data.attendance.unmarked > 0 ? 'warning' : 'success'}>
                  {view.attendanceProgressLabel}
                </Badge>
              </View>
              <View style={styles.attendanceCells}>
                <AttendanceCell label="Present" tone="success" value={data.attendance.present} />
                <AttendanceCell label="Absent" tone="danger" value={data.attendance.absent} />
                <AttendanceCell label="Late" tone="warning" value={data.attendance.late} />
              </View>
              {data.attendance.total === 0 ? (
                <MutedText>No attendance register is available for your current scope.</MutedText>
              ) : null}
            </Card>

            <Card style={styles.compactCard}>
              <Text style={styles.cardTitle}>Quick actions</Text>
              {view.quickActions.map((action) =>
                action.id === 'attendance' && onOpenAttendance ? (
                  <QuickActionRow action={action} key={action.id} onPress={onOpenAttendance} />
                ) : action.id === 'behaviour' && onOpenBehaviour ? (
                  <QuickActionRow action={action} key={action.id} onPress={onOpenBehaviour} />
                ) : action.id === 'communications' && onOpenCommunications ? (
                  <QuickActionRow action={action} key={action.id} onPress={onOpenCommunications} />
                ) : action.id === 'rota' && onOpenRota ? (
                  <QuickActionRow action={action} key={action.id} onPress={onOpenRota} />
                ) : (
                  <QuickActionRow action={action} key={action.id} />
                ),
              )}
            </Card>

            <Card style={styles.compactCard}>
              <Text style={styles.cardTitle}>Daily signals</Text>
              <SignalRow
                label="Behaviour entries"
                value={`${String(data.behaviour.entriesRecordedToday)} today`}
              />
              <SignalRow label="Staff notices" value={`${String(data.notices.unread)} unread`} />
              <SignalRow
                label="Pending swaps"
                value={`${String(data.rota.pendingSwapCount)} open`}
              />
              {data.permissions.canUseClubs ? (
                <SignalRow
                  label="Club access"
                  value={`${String(data.clubs.assignedClubCount)} available`}
                />
              ) : null}
            </Card>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function MetricCard({
  label,
  sub,
  tone = 'default',
  value,
}: {
  label: string;
  sub: string;
  tone?: 'default' | 'success' | 'warning';
  value: string;
}) {
  const accent = tone === 'success' ? C.success : tone === 'warning' ? C.warning : C.blue;
  return (
    <View style={[styles.metricCard, { borderTopColor: accent }]}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, { color: accent }]}>{value}</Text>
      <Text numberOfLines={1} style={styles.metricSub}>
        {sub}
      </Text>
    </View>
  );
}

function AttendanceCell({
  label,
  tone,
  value,
}: {
  label: string;
  tone: 'danger' | 'success' | 'warning';
  value: number;
}) {
  const palette = {
    danger: { backgroundColor: C.dangerBg, color: C.danger },
    success: { backgroundColor: C.successBg, color: C.success },
    warning: { backgroundColor: C.warningBg, color: C.warning },
  }[tone];

  return (
    <View style={[styles.attendanceCell, { backgroundColor: palette.backgroundColor }]}>
      <Text style={[styles.attendanceValue, { color: palette.color }]}>{value}</Text>
      <Text style={styles.attendanceLabel}>{label}</Text>
    </View>
  );
}

function QuickActionRow({
  action,
  onPress,
}: {
  action: StaffHomeQuickAction;
  onPress?: () => void;
}) {
  if (onPress) {
    return (
      <Pressable
        accessibilityLabel={`Open ${action.label}`}
        accessibilityRole="button"
        onPress={onPress}
        style={styles.actionRow}
      >
        <View style={styles.actionDot} />
        <View style={styles.rowBody}>
          <Text style={styles.actionTitle}>{action.label}</Text>
          <Text style={styles.actionMeta}>{action.meta}</Text>
        </View>
        <Text style={styles.actionState}>Open</Text>
      </Pressable>
    );
  }

  return (
    <View accessibilityRole="text" style={styles.actionRow}>
      <View style={styles.actionDot} />
      <View style={styles.rowBody}>
        <Text style={styles.actionTitle}>{action.label}</Text>
        <Text style={styles.actionMeta}>{action.meta}</Text>
      </View>
      <Text style={styles.actionState}>Queued</Text>
    </View>
  );
}

function SignalRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.signalRow}>
      <Text style={styles.signalLabel}>{label}</Text>
      <Text style={styles.signalValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  actionDot: {
    backgroundColor: C.blue,
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  actionMeta: {
    color: C.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
  actionRow: {
    alignItems: 'center',
    backgroundColor: C.bg,
    borderRadius: 10,
    flexDirection: 'row',
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  actionState: {
    color: C.blue,
    fontSize: 12,
    fontWeight: '800',
  },
  actionTitle: {
    color: C.navy,
    fontSize: 13,
    fontWeight: '800',
  },
  attendanceCell: {
    alignItems: 'center',
    borderRadius: 10,
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  attendanceCells: {
    flexDirection: 'row',
    gap: 8,
  },
  attendanceLabel: {
    color: C.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  attendanceValue: {
    fontSize: 22,
    fontWeight: '900',
  },
  cardTitle: {
    color: C.navy,
    fontSize: 14,
    fontWeight: '900',
  },
  compactCard: {
    gap: 10,
    padding: 16,
  },
  content: {
    gap: 12,
    padding: 16,
    paddingBottom: 104,
  },
  eyebrow: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  intro: {
    gap: 3,
  },
  metricCard: {
    backgroundColor: C.surface,
    borderColor: C.border,
    borderRadius: 10,
    borderTopWidth: 3,
    borderWidth: 1,
    flexBasis: '48%',
    flexGrow: 1,
    minWidth: 144,
    padding: 12,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricLabel: {
    color: C.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  metricSub: {
    color: C.textMuted,
    fontSize: 11,
    marginTop: 4,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '900',
    marginTop: 4,
  },
  nextTaskCard: {
    borderLeftColor: C.crimson,
    borderLeftWidth: 4,
    padding: 16,
  },
  nextTaskTitle: {
    color: C.navy,
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 23,
  },
  rowBody: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  rowHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  scroller: {
    backgroundColor: C.bg,
    flex: 1,
  },
  shell: {
    backgroundColor: C.bg,
    flex: 1,
  },
  signalLabel: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  signalRow: {
    alignItems: 'center',
    borderBottomColor: C.borderLight,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  signalValue: {
    color: C.navy,
    fontSize: 12,
    fontWeight: '900',
  },
  subtitle: {
    color: C.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  title: {
    color: C.navy,
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 29,
  },
});

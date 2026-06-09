import { StyleSheet, Text, View } from 'react-native';
import type { RouterOutputs } from '../../lib/trpc';
import { C } from './mobile-theme';
import { Badge, Card, MutedText, SectionTitle, SmokeButton } from './smoke-ui';

type DashboardChild = RouterOutputs['childLog']['parentDashboard']['children'][number];
type ChildDetail = RouterOutputs['childLog']['drillThrough'];

const shortDateFormatter = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
const dateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  month: 'short',
});

function formatDate(value: Date | string): string {
  return shortDateFormatter.format(new Date(value));
}

function formatDateTime(value: Date | string): string {
  return dateTimeFormatter.format(new Date(value));
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join('')
    .slice(0, 2);
}

export function displaySchoolYearLabel(year: string): string {
  const trimmed = year.trim();
  if (/^nursery$/iu.test(trimmed)) return 'Nursery';
  if (/^(reception|abc|r)$/iu.test(trimmed)) return 'ABC';

  const yearMatch = /^(?:year\s*|y)([1-9]|1[0-3])$/iu.exec(trimmed);
  if (!yearMatch) return year;

  return `Level ${String(Number(yearMatch[1]))}`;
}

function attendanceLabel(status: DashboardChild['attendance'][number]['status'] | undefined) {
  return status ?? 'None';
}

function attendanceVariant(
  status: DashboardChild['attendance'][number]['status'] | undefined,
): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'Present') return 'success';
  if (status === 'Late') return 'warning';
  if (status === 'Absent') return 'danger';
  return 'neutral';
}

export function ParentChildPicker({
  onSelect,
  rows,
  selectedStudentId,
}: {
  onSelect: (studentId: string) => void;
  rows: DashboardChild[];
  selectedStudentId: string;
}) {
  if (rows.length <= 1) return null;

  return (
    <Card style={styles.switcherCard}>
      <SectionTitle>Switch child</SectionTitle>
      <View style={styles.buttonColumn}>
        {rows.map((child) => (
          <SmokeButton
            compact
            key={child.student.id}
            label={`${child.student.fullName} - ${displaySchoolYearLabel(child.student.yearGroup)}`}
            onPress={() => {
              onSelect(child.student.id);
            }}
            variant={selectedStudentId === child.student.id ? 'primary' : 'secondary'}
          />
        ))}
      </View>
    </Card>
  );
}

export function ParentChildOverview({
  child,
  detail,
}: {
  child: DashboardChild;
  detail: ChildDetail | undefined;
}) {
  const latestAttendance = child.attendance[0];
  const attendanceRate =
    child.metrics.attendanceRate === null ? '-' : `${String(child.metrics.attendanceRate)}%`;

  return (
    <>
      <Card style={styles.childHero}>
        <View style={styles.heroMain}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(child.student.fullName)}</Text>
          </View>
          <View style={styles.heroText}>
            <Text style={styles.heroName}>{child.student.fullName}</Text>
            <Text style={styles.heroSub}>{displaySchoolYearLabel(child.student.yearGroup)}</Text>
          </View>
          <View style={styles.heroTotal}>
            <Text style={styles.heroTotalValue}>{String(child.metrics.totalMerits)}</Text>
            <Text style={styles.heroTotalLabel}>total merits</Text>
          </View>
        </View>
        <View style={styles.heroStats}>
          <HeroStat label="Latest" value={attendanceLabel(latestAttendance?.status)} />
          <HeroStat label="Attendance" value={attendanceRate} />
          <HeroStat label="PACEs" value={String(child.metrics.pacesCompletedThisAcademicYear)} />
        </View>
      </Card>

      <ChildDetailPanel detail={detail} fallback={child} />
    </>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.heroStat}>
      <Text style={styles.heroStatValue}>{value}</Text>
      <Text style={styles.heroStatLabel}>{label}</Text>
    </View>
  );
}

function ChildDetailPanel({
  detail,
  fallback,
}: {
  detail: ChildDetail | undefined;
  fallback: DashboardChild;
}) {
  const attendance = detail?.attendance ?? fallback.attendance;
  const pace = detail?.pace ?? fallback.pace;
  const behaviour = detail?.behaviour ?? fallback.behaviour;
  const notes = detail?.notes ?? fallback.notes;

  return (
    <View style={styles.panelStack}>
      <MeritWalletCard child={fallback} />
      <RecentBehaviourCard behaviour={behaviour} />
      <RecentAttendanceCard attendance={attendance} />
      <PaceProgressCard pace={pace} />
      {notes.length > 0 ? <VisibleNotesCard notes={notes} /> : null}
    </View>
  );
}

function MeritWalletCard({ child }: { child: DashboardChild }) {
  const rows = [
    { label: 'Spend', value: child.metrics.meritBalances.Spend, color: C.crimson },
    { label: 'Saving', value: child.metrics.meritBalances.Saving, color: C.navy },
    { label: 'Investment', value: child.metrics.meritBalances.Investment, color: C.blue },
  ];

  return (
    <Card style={styles.compactCard}>
      <SectionTitle>Merit wallet</SectionTitle>
      {rows.map((row) => (
        <View key={row.label} style={styles.walletRow}>
          <View style={styles.walletLabelGroup}>
            <View style={[styles.walletSwatch, { backgroundColor: row.color }]} />
            <Text style={styles.walletLabel}>{row.label} Account</Text>
          </View>
          <Text style={[styles.walletValue, { color: row.color }]}>{String(row.value)}</Text>
        </View>
      ))}
      <View style={styles.walletTotalRow}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalValue}>{String(child.metrics.totalMerits)}</Text>
      </View>
    </Card>
  );
}

function RecentBehaviourCard({ behaviour }: { behaviour: DashboardChild['behaviour'] }) {
  return (
    <Card style={styles.compactCard}>
      <SectionTitle>Recent behaviour</SectionTitle>
      {behaviour.length === 0 ? <MutedText>No recent behaviour returned.</MutedText> : null}
      {behaviour.slice(0, 3).map((entry) => (
        <View key={entry.id} style={styles.activityRow}>
          <View
            style={[
              styles.activityDelta,
              entry.meritDelta >= 0 ? styles.activityDeltaPositive : styles.activityDeltaNegative,
            ]}
          >
            <Text
              style={[
                styles.activityDeltaText,
                entry.meritDelta >= 0
                  ? styles.activityDeltaTextPositive
                  : styles.activityDeltaTextNegative,
              ]}
            >
              {entry.meritDelta > 0 ? '+' : ''}
              {String(entry.meritDelta)}
            </Text>
          </View>
          <View style={styles.rowBody}>
            <Text numberOfLines={1} style={styles.rowTitle}>
              {entry.category}
            </Text>
            <MutedText>{entry.note ?? entry.type}</MutedText>
          </View>
          <Text style={styles.rowMeta}>{formatDateTime(entry.createdAt)}</Text>
        </View>
      ))}
    </Card>
  );
}

function RecentAttendanceCard({ attendance }: { attendance: DashboardChild['attendance'] }) {
  return (
    <Card style={styles.compactCard}>
      <SectionTitle>Recent attendance</SectionTitle>
      {attendance.length === 0 ? <MutedText>No attendance returned.</MutedText> : null}
      {attendance.slice(0, 4).map((row) => (
        <View key={row.id} style={styles.listRow}>
          <View style={styles.rowBody}>
            <Text style={styles.rowTitle}>{formatDate(row.date)}</Text>
            <MutedText>{formatDateTime(row.recordedAt)}</MutedText>
          </View>
          <Badge variant={attendanceVariant(row.status)}>{row.status}</Badge>
        </View>
      ))}
    </Card>
  );
}

function PaceProgressCard({ pace }: { pace: DashboardChild['pace'] }) {
  return (
    <Card style={styles.compactCard}>
      <SectionTitle>PACE progress</SectionTitle>
      {pace.length === 0 ? <MutedText>No PACE records returned.</MutedText> : null}
      {pace.slice(0, 4).map((record) => (
        <View key={record.id} style={styles.listRow}>
          <View style={styles.rowBody}>
            <Text style={styles.rowTitle}>
              {record.subjectCode} PACE {String(record.paceNumber)}
            </Text>
            <MutedText>
              {record.testType} - {String(record.score)}% - {formatDate(record.date)}
            </MutedText>
          </View>
          <Badge variant={record.passed ? 'success' : 'warning'}>
            {record.passed ? 'Passed' : 'Review'}
          </Badge>
        </View>
      ))}
    </Card>
  );
}

function VisibleNotesCard({ notes }: { notes: DashboardChild['notes'] }) {
  return (
    <Card style={styles.compactCard}>
      <SectionTitle>Visible notes</SectionTitle>
      {notes.slice(0, 3).map((note) => (
        <View key={note.id} style={styles.noteRow}>
          <Text style={styles.rowTitle}>{formatDateTime(note.createdAt)}</Text>
          <MutedText>{note.note}</MutedText>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    backgroundColor: C.blue,
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  avatarText: {
    color: C.surface,
    fontSize: 15,
    fontWeight: '800',
  },
  buttonColumn: {
    gap: 8,
  },
  childHero: {
    backgroundColor: C.navy,
    borderColor: C.navy,
    padding: 16,
  },
  compactCard: {
    gap: 10,
    padding: 16,
  },
  activityDelta: {
    alignItems: 'center',
    borderRadius: 8,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  activityDeltaNegative: {
    backgroundColor: C.dangerBg,
  },
  activityDeltaPositive: {
    backgroundColor: C.successBg,
  },
  activityDeltaText: {
    fontSize: 11,
    fontWeight: '900',
  },
  activityDeltaTextNegative: {
    color: C.danger,
  },
  activityDeltaTextPositive: {
    color: C.success,
  },
  activityRow: {
    alignItems: 'center',
    borderBottomColor: C.borderLight,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingBottom: 10,
  },
  heroMain: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  heroName: {
    color: C.surface,
    fontSize: 18,
    fontWeight: '800',
  },
  heroStat: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 8,
    flex: 1,
    gap: 3,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  heroStatLabel: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: 10,
    fontWeight: '600',
  },
  heroStatValue: {
    color: C.surface,
    fontSize: 16,
    fontWeight: '800',
  },
  heroStats: {
    flexDirection: 'row',
    gap: 8,
  },
  heroSub: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    fontWeight: '600',
  },
  heroText: {
    flex: 1,
    minWidth: 0,
  },
  heroTotal: {
    alignItems: 'flex-end',
  },
  heroTotalLabel: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 10,
    fontWeight: '700',
  },
  heroTotalValue: {
    color: C.blue,
    fontSize: 26,
    fontWeight: '900',
  },
  listRow: {
    alignItems: 'center',
    borderBottomColor: C.borderLight,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 10,
  },
  noteRow: {
    borderBottomColor: C.borderLight,
    borderBottomWidth: 1,
    gap: 4,
    paddingBottom: 10,
  },
  panelStack: {
    gap: 14,
  },
  rowBody: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  rowMeta: {
    color: C.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },
  rowTitle: {
    color: C.navy,
    fontSize: 13,
    fontWeight: '800',
  },
  switcherCard: {
    gap: 10,
    padding: 16,
  },
  totalLabel: {
    color: C.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  totalValue: {
    color: C.navy,
    fontSize: 18,
    fontWeight: '900',
  },
  walletLabel: {
    color: C.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  walletLabelGroup: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  walletRow: {
    alignItems: 'center',
    borderBottomColor: C.borderLight,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  walletSwatch: {
    borderRadius: 3,
    height: 10,
    width: 10,
  },
  walletTotalRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 2,
  },
  walletValue: {
    fontSize: 15,
    fontWeight: '900',
  },
});

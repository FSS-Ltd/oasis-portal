import { StyleSheet, Text, View } from 'react-native';
import type { RouterOutputs } from '../../lib/trpc';
import { C } from './mobile-theme';
import { Badge, Card, MutedText, SectionTitle, SmokeButton, StatCard } from './smoke-ui';

type DashboardChild = RouterOutputs['childLog']['parentDashboard']['children'][number];
type ChildDetail = RouterOutputs['childLog']['drillThrough'];

function formatDate(value: Date | string): string {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(
    new Date(value),
  );
}

function formatDateTime(value: Date | string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  }).format(new Date(value));
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join('')
    .slice(0, 2);
}

function displaySchoolYearLabel(year: string): string {
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
  if (rows.length === 0) return null;

  return (
    <Card>
      <SectionTitle>Children</SectionTitle>
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
        <View style={styles.heroIdentity}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(child.student.fullName)}</Text>
          </View>
          <View style={styles.heroText}>
            <Text style={styles.heroName}>{child.student.fullName}</Text>
            <Text style={styles.heroSub}>{displaySchoolYearLabel(child.student.yearGroup)}</Text>
          </View>
          <Badge variant={attendanceVariant(latestAttendance?.status)}>
            {attendanceLabel(latestAttendance?.status)}
          </Badge>
        </View>
        <View style={styles.heroStats}>
          <HeroStat label="Total merits" value={String(child.metrics.totalMerits)} />
          <HeroStat label="Attendance" value={attendanceRate} />
          <HeroStat
            label="PACEs passed"
            value={String(child.metrics.pacesCompletedThisAcademicYear)}
          />
        </View>
      </Card>

      <View style={styles.statsGrid}>
        <StatCard
          accent={C.crimson}
          label="Spend"
          value={String(child.metrics.meritBalances.Spend)}
        />
        <StatCard
          accent={C.navy}
          label="Saving"
          value={String(child.metrics.meritBalances.Saving)}
        />
        <StatCard
          accent={C.blue}
          label="Investment"
          value={String(child.metrics.meritBalances.Investment)}
        />
      </View>

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
      <Card>
        <SectionTitle>Recent attendance</SectionTitle>
        {attendance.length === 0 ? <MutedText>No attendance returned.</MutedText> : null}
        {attendance.slice(0, 5).map((row) => (
          <View key={row.id} style={styles.row}>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>{formatDate(row.date)}</Text>
              <MutedText>{formatDateTime(row.recordedAt)}</MutedText>
            </View>
            <Badge variant={attendanceVariant(row.status)}>{row.status}</Badge>
          </View>
        ))}
      </Card>

      <Card>
        <SectionTitle>PACE progress</SectionTitle>
        {pace.length === 0 ? <MutedText>No PACE records returned.</MutedText> : null}
        {pace.slice(0, 5).map((record) => (
          <View key={record.id} style={styles.stackRow}>
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

      <Card>
        <SectionTitle>Recent behaviour</SectionTitle>
        {behaviour.length === 0 ? <MutedText>No behaviour returned.</MutedText> : null}
        {behaviour.slice(0, 5).map((entry) => (
          <View key={entry.id} style={styles.stackRow}>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>
                {entry.category} - {entry.meritDelta > 0 ? '+' : ''}
                {String(entry.meritDelta)}
              </Text>
              <MutedText>{entry.note ?? entry.type}</MutedText>
            </View>
            <Badge variant={entry.meritDelta >= 0 ? 'success' : 'danger'}>{entry.type}</Badge>
          </View>
        ))}
      </Card>

      <Card>
        <SectionTitle>Visible notes</SectionTitle>
        {notes.length === 0 ? <MutedText>No notes returned.</MutedText> : null}
        {notes.slice(0, 5).map((note) => (
          <View key={note.id} style={styles.stackRow}>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>{formatDateTime(note.createdAt)}</Text>
              <MutedText>{note.note}</MutedText>
            </View>
          </View>
        ))}
      </Card>
    </View>
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
  },
  heroIdentity: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  heroName: {
    color: C.surface,
    fontSize: 20,
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
  },
  panelStack: {
    gap: 16,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  rowBody: {
    flex: 1,
    gap: 4,
  },
  rowTitle: {
    color: C.navy,
    fontSize: 13,
    fontWeight: '800',
  },
  stackRow: {
    borderBottomColor: C.borderLight,
    borderBottomWidth: 1,
    gap: 10,
    paddingBottom: 10,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
});

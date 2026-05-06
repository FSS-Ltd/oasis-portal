import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useClerk } from '@clerk/clerk-expo';
import { api } from '../../lib/trpc';
import { C } from './mobile-theme';
import {
  Badge,
  Card,
  ErrorText,
  Field,
  InlineSpinner,
  MutedText,
  SectionTitle,
  SmokeButton,
  StatCard,
} from './smoke-ui';

type AttendanceStatus = 'Present' | 'Absent' | 'Late';
type BehaviourType = 'Merit' | 'Demerit';
type PaceTestType = 'SelfTest' | 'FinalTest';

const attendanceStatuses: AttendanceStatus[] = ['Present', 'Absent', 'Late'];
const behaviourTypes: BehaviourType[] = ['Merit', 'Demerit'];
const paceTestTypes: PaceTestType[] = ['SelfTest', 'FinalTest'];

const attendancePalette: Record<
  AttendanceStatus,
  { backgroundColor: string; borderColor: string; color: string }
> = {
  Present: { backgroundColor: C.successBg, borderColor: C.successMid, color: C.success },
  Absent: { backgroundColor: C.dangerBg, borderColor: C.dangerMid, color: C.danger },
  Late: { backgroundColor: C.warningBg, borderColor: C.warningBg, color: C.warning },
};

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function dateFromKey(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function startOfWeek(date: Date): Date {
  const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = next.getUTCDay() || 7;
  next.setUTCDate(next.getUTCDate() - day + 1);
  return next;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(date);
}

function numericInput(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function firstError(...messages: Array<string | undefined>): string | null {
  return messages.find((message) => Boolean(message)) ?? null;
}

export function SupervisorSmokeScreen() {
  const { signOut } = useClerk();
  const utils = api.useUtils();
  const today = useMemo(() => dateFromKey(dateKey(new Date())), []);
  const weekStart = useMemo(() => startOfWeek(today), [today]);
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);
  const [attendanceDateKey, setAttendanceDateKey] = useState(dateKey(today));
  const attendanceDate = useMemo(() => dateFromKey(attendanceDateKey), [attendanceDateKey]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [behaviourType, setBehaviourType] = useState<BehaviourType>('Merit');
  const [behaviourAmount, setBehaviourAmount] = useState('5');
  const [behaviourCategory, setBehaviourCategory] = useState('Daily workflow smoke');
  const [behaviourNote, setBehaviourNote] = useState('');
  const [paceStudentId, setPaceStudentId] = useState('');
  const [paceSubjectId, setPaceSubjectId] = useState('');
  const [paceNumber, setPaceNumber] = useState('');
  const [paceScore, setPaceScore] = useState('');
  const [paceTestType, setPaceTestType] = useState<PaceTestType>('SelfTest');
  const [lastMessage, setLastMessage] = useState<string | null>(null);

  const health = api.health.me.useQuery();
  const rota = api.rota.myRota.useQuery({ from: weekStart, to: weekEnd });
  const attendance = api.attendance.forDate.useQuery({ date: attendanceDate });
  const paceRoster = api.pace.roster.useQuery({ date: today });
  const activePaceStudentId = paceStudentId || paceRoster.data?.students[0]?.studentId || '';
  const paceDetail = api.pace.forStudent.useQuery(
    { studentId: activePaceStudentId, date: today },
    { enabled: Boolean(activePaceStudentId) },
  );

  const activeStudentId = selectedStudentId || attendance.data?.[0]?.studentId || '';
  const selectedPaceSubject =
    paceDetail.data?.subjects.find((subject) => subject.subjectId === paceSubjectId) ??
    paceDetail.data?.subjects[0] ??
    null;
  const activePaceSubjectId = selectedPaceSubject?.subjectId ?? '';
  const activePaceNumber = selectedPaceSubject
    ? numericInput(paceNumber, selectedPaceSubject.currentPaceNumber)
    : 0;
  const activePaceScore = numericInput(paceScore, 0);
  const selectedStudentName =
    attendance.data?.find((row) => row.studentId === activeStudentId)?.studentName ?? 'None';
  const markedAttendance = (attendance.data ?? []).filter((row) => row.status).length;
  const paceWarnings = paceDetail.data?.warnings;

  const markAttendance = api.attendance.mark.useMutation({
    onError: (error) => {
      setLastMessage(error.message);
    },
    onSuccess: async (row) => {
      setLastMessage(`Attendance saved: ${row.status}`);
      await utils.attendance.forDate.invalidate();
    },
  });

  const logBehaviour = api.behaviour.log.useMutation({
    onError: (error) => {
      setLastMessage(error.message);
    },
    onSuccess: async (row) => {
      setLastMessage(`Behaviour saved: ${row.type}`);
      setBehaviourNote('');
      await utils.behaviour.recentEntries.invalidate();
    },
  });

  const recordPace = api.pace.record.useMutation({
    onError: (error) => {
      setLastMessage(error.message);
    },
    onSuccess: async (row) => {
      setLastMessage(
        row.advanced ? `PACE saved and advanced to ${String(row.newPaceNumber)}` : 'PACE saved',
      );
      setPaceScore('');
      await Promise.all([utils.pace.forStudent.invalidate(), utils.pace.roster.invalidate()]);
    },
  });

  const loading =
    health.isFetching ||
    rota.isFetching ||
    attendance.isFetching ||
    paceRoster.isFetching ||
    paceDetail.isFetching;
  const queryError = firstError(
    health.error?.message,
    rota.error?.message,
    attendance.error?.message,
    paceRoster.error?.message,
    paceDetail.error?.message,
  );

  async function refresh() {
    await Promise.all([
      health.refetch(),
      rota.refetch(),
      attendance.refetch(),
      paceRoster.refetch(),
      paceDetail.refetch(),
    ]);
  }

  return (
    <SafeAreaView style={styles.shell}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            onRefresh={() => {
              void refresh();
            }}
            refreshing={loading}
          />
        }
        style={styles.scroller}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>
              {new Intl.DateTimeFormat('en-GB', {
                dateStyle: 'full',
              }).format(today)}
            </Text>
            <Text style={styles.title}>Supervisor daily workflow</Text>
            <Text style={styles.subtitle}>Phase 2 mobile smoke</Text>
          </View>
          <SmokeButton
            compact
            label="Sign out"
            onPress={() => {
              void signOut();
            }}
            variant="secondary"
          />
        </View>

        <View style={styles.statsGrid}>
          <StatCard
            accent={C.blue}
            label="Rota"
            value={rota.data ? String(rota.data.length) : '...'}
          />
          <StatCard
            accent={C.success}
            label="Marked"
            value={
              attendance.data
                ? `${String(markedAttendance)}/${String(attendance.data.length)}`
                : '...'
            }
          />
          <StatCard
            accent={paceWarnings?.atLimit ? C.crimson : C.blue}
            label="PACE"
            value={
              paceWarnings ? `${String(paceWarnings.count)}/${String(paceWarnings.limit)}` : '...'
            }
          />
        </View>

        <Card>
          <SectionTitle>Session</SectionTitle>
          {health.data?.user?.role ? <Badge variant="blue">{health.data.user.role}</Badge> : null}
          <MutedText>
            {health.data?.user
              ? health.data.user.id
              : 'Signed in with Clerk; Oasis user not loaded yet.'}
          </MutedText>
          <MutedText>
            tRPC: {process.env.EXPO_PUBLIC_TRPC_URL ?? 'http://localhost:3000/api/trpc'}
          </MutedText>
        </Card>

        {queryError ? <ErrorText>{queryError}</ErrorText> : null}
        {lastMessage ? <MutedText>{lastMessage}</MutedText> : null}

        <StudentPicker
          rows={attendance.data ?? []}
          selectedStudentId={activeStudentId}
          onSelect={(studentId) => {
            setSelectedStudentId(studentId);
            setPaceStudentId(studentId);
          }}
        />

        <Card>
          <SectionTitle>Rota this week</SectionTitle>
          {rota.isLoading ? <InlineSpinner label="Loading rota" /> : null}
          {(rota.data ?? []).length === 0 ? (
            <MutedText>No shifts returned for this week.</MutedText>
          ) : null}
          {(rota.data ?? []).map((shift) => (
            <View key={shift.id} style={styles.row}>
              <View style={[styles.bandDot, { backgroundColor: shift.bandColour ?? C.blue }]} />
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>{shift.bandName ?? 'Unassigned band'}</Text>
                <MutedText>
                  {shift.date} · {formatTime(shift.startsAt)}-{formatTime(shift.endsAt)}
                </MutedText>
              </View>
            </View>
          ))}
        </Card>

        <Card>
          <SectionTitle>Attendance</SectionTitle>
          <Field
            label="Date"
            onChangeText={setAttendanceDateKey}
            placeholder="YYYY-MM-DD"
            value={attendanceDateKey}
          />
          {(attendance.data ?? []).slice(0, 8).map((row) => (
            <View key={row.studentId} style={styles.stackRow}>
              <View style={styles.rowBody}>
                <View style={styles.rowTitleLine}>
                  <Text style={styles.rowTitle}>{row.studentName}</Text>
                  <Badge
                    variant={
                      row.status === 'Present'
                        ? 'success'
                        : row.status === 'Absent'
                          ? 'danger'
                          : row.status === 'Late'
                            ? 'warning'
                            : 'neutral'
                    }
                  >
                    {row.status ?? 'Unmarked'}
                  </Badge>
                </View>
                <MutedText>{row.yearGroup}</MutedText>
              </View>
              <View style={styles.buttonRow}>
                {attendanceStatuses.map((status) => (
                  <AttendanceMarkButton
                    active={row.status === status}
                    disabled={markAttendance.isPending}
                    key={status}
                    onPress={() => {
                      markAttendance.mutate({
                        studentId: row.studentId,
                        date: attendanceDate,
                        status,
                      });
                    }}
                    status={status}
                  />
                ))}
              </View>
            </View>
          ))}
        </Card>

        <Card>
          <SectionTitle>Behaviour</SectionTitle>
          <View style={styles.selectedRow}>
            <MutedText>Selected student</MutedText>
            <Badge variant={activeStudentId ? 'blue' : 'neutral'}>{selectedStudentName}</Badge>
          </View>
          <View style={styles.buttonRow}>
            {behaviourTypes.map((type) => (
              <SmokeButton
                compact
                key={type}
                label={type}
                onPress={() => {
                  setBehaviourType(type);
                }}
                variant={behaviourType === type ? 'primary' : 'secondary'}
              />
            ))}
          </View>
          <Field label="Category" onChangeText={setBehaviourCategory} value={behaviourCategory} />
          {behaviourType === 'Merit' ? (
            <Field
              keyboardType="numeric"
              label="Merit amount"
              onChangeText={setBehaviourAmount}
              value={behaviourAmount}
            />
          ) : null}
          <Field label="Note" multiline onChangeText={setBehaviourNote} value={behaviourNote} />
          <SmokeButton
            disabled={!activeStudentId || !behaviourCategory.trim() || logBehaviour.isPending}
            label={logBehaviour.isPending ? 'Saving behaviour...' : 'Log behaviour'}
            onPress={() => {
              logBehaviour.mutate({
                studentId: activeStudentId,
                type: behaviourType,
                category: behaviourCategory,
                note: behaviourNote.trim() || undefined,
                visibility: 'General',
                amount: behaviourType === 'Merit' ? numericInput(behaviourAmount, 1) : undefined,
              });
            }}
          />
        </Card>

        <Card>
          <SectionTitle>PACE</SectionTitle>
          <PaceStudentPicker
            rows={paceRoster.data?.students ?? []}
            selectedStudentId={activePaceStudentId}
            onSelect={(studentId) => {
              setPaceStudentId(studentId);
              setPaceSubjectId('');
              setPaceNumber('');
              setPaceScore('');
            }}
          />
          {paceWarnings?.atLimit ? (
            <View style={styles.warningBox}>
              <Badge variant="danger">PACE limit</Badge>
              <Text style={styles.warningText}>
                Daily PACE test limit reached for this student.
              </Text>
            </View>
          ) : paceWarnings?.dailyLimitEnabled ? (
            <View style={styles.warningBox}>
              <Badge variant="warning">PACE warning</Badge>
              <Text style={styles.warningText}>
                Daily PACE tests: {paceWarnings.count}/{paceWarnings.limit}
              </Text>
            </View>
          ) : null}
          <View style={styles.buttonColumn}>
            {(paceDetail.data?.subjects ?? []).map((subject) => (
              <SmokeButton
                compact
                key={subject.subjectId}
                label={`${subject.code} #${String(subject.currentPaceNumber)}`}
                onPress={() => {
                  setPaceSubjectId(subject.subjectId);
                  setPaceNumber(String(subject.currentPaceNumber));
                }}
                variant={activePaceSubjectId === subject.subjectId ? 'primary' : 'secondary'}
              />
            ))}
          </View>
          <View style={styles.buttonRow}>
            {paceTestTypes.map((type) => (
              <SmokeButton
                compact
                key={type}
                label={type === 'SelfTest' ? 'Self' : 'Final'}
                onPress={() => {
                  setPaceTestType(type);
                }}
                variant={paceTestType === type ? 'primary' : 'secondary'}
              />
            ))}
          </View>
          <Field
            keyboardType="numeric"
            label="PACE number"
            onChangeText={setPaceNumber}
            placeholder={
              selectedPaceSubject ? String(selectedPaceSubject.currentPaceNumber) : undefined
            }
            value={paceNumber}
          />
          <Field
            keyboardType="numeric"
            label="Score"
            onChangeText={setPaceScore}
            value={paceScore}
          />
          <SmokeButton
            disabled={
              !activePaceStudentId ||
              !activePaceSubjectId ||
              activePaceScore <= 0 ||
              recordPace.isPending
            }
            label={recordPace.isPending ? 'Saving PACE...' : 'Record PACE score'}
            onPress={() => {
              recordPace.mutate({
                studentId: activePaceStudentId,
                subjectId: activePaceSubjectId,
                paceNumber: activePaceNumber,
                testType: paceTestType,
                score: activePaceScore,
                completedAt: today,
              });
            }}
          />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function AttendanceMarkButton({
  active,
  disabled,
  onPress,
  status,
}: {
  active: boolean;
  disabled: boolean;
  onPress: () => void;
  status: AttendanceStatus;
}) {
  const palette = attendancePalette[status];

  return (
    <Pressable
      accessibilityLabel={`Mark ${status}`}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.attendanceButton,
        {
          backgroundColor: active ? palette.backgroundColor : C.surface,
          borderColor: palette.borderColor,
        },
        disabled ? styles.disabled : null,
      ]}
    >
      <Text style={[styles.attendanceButtonText, { color: palette.color }]}>
        {status.slice(0, 1)}
      </Text>
    </Pressable>
  );
}

function StudentPicker({
  rows,
  selectedStudentId,
  onSelect,
}: {
  rows: Array<{ studentId: string; studentName: string; yearGroup: string }>;
  selectedStudentId: string;
  onSelect: (studentId: string) => void;
}) {
  return (
    <Card>
      <SectionTitle>Students</SectionTitle>
      {rows.length === 0 ? <MutedText>Load attendance to select a student.</MutedText> : null}
      <View style={styles.buttonColumn}>
        {rows.slice(0, 8).map((row) => (
          <SmokeButton
            compact
            key={row.studentId}
            label={`${row.studentName} · ${row.yearGroup}`}
            onPress={() => {
              onSelect(row.studentId);
            }}
            variant={row.studentId === selectedStudentId ? 'primary' : 'secondary'}
          />
        ))}
      </View>
    </Card>
  );
}

function PaceStudentPicker({
  rows,
  selectedStudentId,
  onSelect,
}: {
  rows: Array<{ studentId: string; studentName: string; yearGroupLabel: string }>;
  selectedStudentId: string;
  onSelect: (studentId: string) => void;
}) {
  if (rows.length === 0) return <MutedText>No PACE students returned for today.</MutedText>;

  return (
    <View style={styles.buttonColumn}>
      {rows.slice(0, 8).map((row) => (
        <SmokeButton
          compact
          key={row.studentId}
          label={`${row.studentName} · ${row.yearGroupLabel}`}
          onPress={() => {
            onSelect(row.studentId);
          }}
          variant={row.studentId === selectedStudentId ? 'primary' : 'secondary'}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  attendanceButton: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1.5,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  attendanceButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  bandDot: {
    borderRadius: 5,
    height: 10,
    marginTop: 5,
    width: 10,
  },
  buttonColumn: {
    gap: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  content: {
    gap: 14,
    padding: 16,
    paddingBottom: 32,
  },
  eyebrow: {
    color: C.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  disabled: {
    opacity: 0.45,
  },
  row: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
  },
  rowBody: {
    flex: 1,
    gap: 3,
  },
  rowTitle: {
    color: C.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  rowTitleLine: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  selectedRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  shell: {
    backgroundColor: C.bg,
    flex: 1,
  },
  scroller: {
    backgroundColor: C.bg,
    flex: 1,
  },
  stackRow: {
    borderTopColor: C.border,
    borderTopWidth: 1,
    gap: 9,
    paddingTop: 10,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  subtitle: {
    color: C.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3,
  },
  title: {
    color: C.navy,
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 26,
  },
  warningBox: {
    backgroundColor: C.warningBg,
    borderColor: C.warningBg,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    padding: 10,
  },
  warningText: {
    color: C.warning,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
});

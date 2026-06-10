import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useClerk } from '@clerk/clerk-expo';
import { api, type RouterOutputs } from '../../lib/trpc';
import { C } from './mobile-theme';
import { StaffClubsPanel } from './staff-smoke-clubs';
import {
  Badge,
  Card,
  ErrorText,
  Field,
  InlineSpinner,
  MutedText,
  SectionTitle,
  SmokeButton,
} from './smoke-ui';
import {
  PortalMobileBottomNav,
  PortalMobileHeader,
  type PortalMobileNavItem,
} from './portal-mobile-shell';

type AttendanceStatus = 'Present' | 'Absent' | 'Late';
type BehaviourType = 'Merit' | 'Demerit';
type PaceTestType = 'SelfTest' | 'FinalTest';
type SessionUser = NonNullable<RouterOutputs['health']['me']['user']>;
type SessionRole = SessionUser['role'];
type ShopItem = RouterOutputs['shop']['listItems'][number];
type ShopReservation = RouterOutputs['shop']['listReservations'][number];
type SupervisorMobileTab = 'dashboard' | 'attendance' | 'behaviour' | 'shop' | 'pace' | 'clubs';

const attendanceStatuses: AttendanceStatus[] = ['Present', 'Absent', 'Late'];
const behaviourTypes: BehaviourType[] = ['Merit', 'Demerit'];
const paceTestTypes: PaceTestType[] = ['SelfTest', 'FinalTest'];
const supervisorTabs: Array<PortalMobileNavItem<SupervisorMobileTab>> = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { id: 'attendance', label: 'Attendance', icon: 'attendance' },
  { id: 'behaviour', label: 'Behaviour', icon: 'behaviour' },
  { id: 'shop', label: 'Shop', icon: 'shop' },
  { id: 'pace', label: 'PACE', icon: 'pace' },
  { id: 'clubs', label: 'Clubs', icon: 'clubs' },
];

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

function isMobileFullAdmin(role: SessionRole | undefined): boolean {
  return (
    role === 'Head' || role === 'Principal' || role === 'Pastor' || role === 'HeadOfDiscipline'
  );
}

function canUseMobileClubAdmin(role: SessionRole | undefined): boolean {
  return isMobileFullAdmin(role) || role === 'ClubsAdmin';
}

function canUseMobileShopCounter(user: SessionUser | undefined): boolean {
  return Boolean(
    user &&
    (isMobileFullAdmin(user.role) ||
      user.tags.includes('shopadmin') ||
      user.tags.includes('shopkeeper')),
  );
}

function formatMerits(value: number): string {
  return new Intl.NumberFormat('en-GB').format(value);
}

function stockVariant(item: ShopItem): 'success' | 'warning' | 'danger' | 'neutral' {
  if (item.stockStatus === 'Inactive') return 'neutral';
  if (item.stockStatus === 'OutOfStock') return 'danger';
  if (item.stockStatus === 'LowStock') return 'warning';
  return 'success';
}

function stockLabel(item: ShopItem): string {
  if (item.stockStatus === 'Inactive') return 'Paused';
  if (item.stockStatus === 'OutOfStock') return 'Out';
  if (item.stockStatus === 'LowStock') return `Low · ${String(item.stockCount)}`;
  return `${String(item.stockCount)} left`;
}

export function SupervisorSmokeScreen() {
  const { signOut } = useClerk();
  const utils = api.useUtils();
  const today = useMemo(() => dateFromKey(dateKey(new Date())), []);
  const weekStart = useMemo(() => startOfWeek(today), [today]);
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);
  const [activeTab, setActiveTab] = useState<SupervisorMobileTab>('dashboard');
  const [attendanceDateKey, setAttendanceDateKey] = useState(dateKey(today));
  const attendanceDate = useMemo(() => dateFromKey(attendanceDateKey), [attendanceDateKey]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [behaviourType, setBehaviourType] = useState<BehaviourType>('Merit');
  const [behaviourAmount, setBehaviourAmount] = useState('5');
  const [behaviourCategory, setBehaviourCategory] = useState('Daily workflow');
  const [behaviourNote, setBehaviourNote] = useState('');
  const [paceStudentId, setPaceStudentId] = useState('');
  const [paceSubjectId, setPaceSubjectId] = useState('');
  const [paceNumber, setPaceNumber] = useState('');
  const [paceScore, setPaceScore] = useState('');
  const [paceTestType, setPaceTestType] = useState<PaceTestType>('SelfTest');
  const [selectedClubId, setSelectedClubId] = useState('');
  const [lastMessage, setLastMessage] = useState<string | null>(null);

  const health = api.health.me.useQuery();
  const sessionUser = health.data?.user ?? undefined;
  const sessionRole = sessionUser?.role;
  const canUseClubAdmin = canUseMobileClubAdmin(sessionRole);
  const canUseShopCounter = canUseMobileShopCounter(sessionUser);
  const rota = api.rota.myRota.useQuery({ from: weekStart, to: weekEnd });
  const attendance = api.attendance.forDate.useQuery({ date: attendanceDate });
  const paceRoster = api.pace.roster.useQuery({ date: today });
  const activePaceStudentId = paceStudentId || paceRoster.data?.students[0]?.studentId || '';
  const paceDetail = api.pace.forStudent.useQuery(
    { studentId: activePaceStudentId, date: today },
    { enabled: Boolean(activePaceStudentId) },
  );
  const clubList = api.club.list.useQuery(undefined, {
    enabled: activeTab === 'clubs' || canUseClubAdmin,
    retry: false,
  });
  const shopItems = api.shop.listItems.useQuery(undefined, { retry: false });
  const shopReservations = api.shop.listReservations.useQuery(
    { status: 'Ready' },
    { enabled: canUseShopCounter, retry: false },
  );

  const activeStudentId = selectedStudentId || attendance.data?.[0]?.studentId || '';
  const clubs = clubList.data ?? [];
  const selectedClub =
    clubs.find((club) => club.id === selectedClubId) ??
    clubs.find((club) => club.active) ??
    clubs[0] ??
    null;
  const activeClubId = selectedClub?.id ?? '';
  const clubRoster = api.club.roster.useQuery(
    { clubId: activeClubId },
    { enabled: activeTab === 'clubs' && Boolean(activeClubId), retry: false },
  );
  const selectedPaceSubject =
    paceDetail.data?.subjects.find((subject) => subject.subjectId === paceSubjectId) ??
    paceDetail.data?.subjects[0] ??
    null;
  const activePaceSubjectId = selectedPaceSubject?.subjectId ?? '';
  const activePaceNumber = selectedPaceSubject
    ? numericInput(paceNumber, selectedPaceSubject.currentPaceNumber)
    : 0;
  const activePaceScore = numericInput(paceScore, 0);
  const selfTestExistsForPace =
    selectedPaceSubject !== null &&
    activePaceNumber > 0 &&
    selectedPaceSubject.selfTestPaceNumbers.includes(activePaceNumber);
  const selectedStudentName =
    attendance.data?.find((row) => row.studentId === activeStudentId)?.studentName ?? 'None';
  const markedAttendance = (attendance.data ?? []).filter((row) => row.status).length;
  const paceWarnings = paceDetail.data?.warnings;
  const readyReservationCount = shopReservations.data?.length ?? 0;
  const navItems = useMemo(
    () =>
      supervisorTabs.map((tab) =>
        tab.id === 'shop' && readyReservationCount > 0
          ? { ...tab, badge: readyReservationCount }
          : tab,
      ),
    [readyReservationCount],
  );

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
    paceDetail.isFetching ||
    ((activeTab === 'clubs' || canUseClubAdmin) && clubList.isFetching) ||
    (activeTab === 'clubs' && clubRoster.isFetching) ||
    (activeTab === 'shop' && shopItems.isFetching) ||
    (activeTab === 'shop' && canUseShopCounter && shopReservations.isFetching);
  const queryError = firstError(
    health.error?.message,
    rota.error?.message,
    attendance.error?.message,
    paceRoster.error?.message,
    paceDetail.error?.message,
    activeTab === 'shop' ? shopItems.error?.message : undefined,
    activeTab === 'shop' && canUseShopCounter ? shopReservations.error?.message : undefined,
  );
  const attendanceRows = attendance.data ?? [];
  const rotaRows = rota.data ?? [];
  const paceCount = paceWarnings
    ? `${String(paceWarnings.count)}/${String(paceWarnings.limit)}`
    : '...';
  const staffRole = sessionRole ?? 'Staff';
  const clubDashboardLabel = clubList.isLoading
    ? 'Loading club access'
    : clubList.error
      ? clubList.error.message
      : `${String(clubs.length)} clubs available for roster checks.`;
  const clubDashboardCount = clubList.isLoading ? '...' : String(clubs.length);

  async function refresh() {
    const tasks: Promise<unknown>[] = [
      health.refetch(),
      rota.refetch(),
      attendance.refetch(),
      paceRoster.refetch(),
      paceDetail.refetch(),
    ];
    if (activeTab === 'clubs' || canUseClubAdmin) {
      tasks.push(clubList.refetch());
    }
    if (activeTab === 'clubs') {
      if (activeClubId) tasks.push(clubRoster.refetch());
    }
    if (activeTab === 'shop') {
      tasks.push(shopItems.refetch());
      if (canUseShopCounter) tasks.push(shopReservations.refetch());
    }
    await Promise.all(tasks);
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
        subtitle={`${staffRole} · Daily workflow`}
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
            refreshing={loading}
          />
        }
        style={styles.scroller}
      >
        {queryError ? <ErrorText>{queryError}</ErrorText> : null}
        {lastMessage ? (
          <View style={styles.statusMessage}>
            <Text style={styles.statusMessageText}>{lastMessage}</Text>
          </View>
        ) : null}

        {activeTab === 'dashboard' ? (
          <>
            <WorkflowIntro today={today} />
            <View style={styles.metricGrid}>
              <WorkflowMetric
                accent={C.blue}
                label="Rota"
                sub="shifts this week"
                value={rotaRows.length ? String(rotaRows.length) : '...'}
              />
              <WorkflowMetric
                accent={C.success}
                label="Marked"
                sub="attendance today"
                value={
                  attendanceRows.length
                    ? `${String(markedAttendance)}/${String(attendanceRows.length)}`
                    : '...'
                }
              />
              <WorkflowMetric
                accent={paceWarnings?.atLimit ? C.crimson : C.blue}
                label="PACE"
                sub="daily tests"
                value={paceCount}
              />
            </View>

            {canUseClubAdmin ? (
              <Card style={styles.compactCard}>
                <View style={styles.selectedRow}>
                  <View style={styles.rowBody}>
                    <SectionTitle>Clubs</SectionTitle>
                    <MutedText>{clubDashboardLabel}</MutedText>
                  </View>
                  <Badge variant={clubList.error ? 'danger' : 'blue'}>{clubDashboardCount}</Badge>
                </View>
                <SmokeButton
                  compact
                  disabled={clubList.isLoading}
                  label="Open Clubs"
                  onPress={() => {
                    setActiveTab('clubs');
                  }}
                  variant="blue"
                />
              </Card>
            ) : null}

            <Card style={styles.compactCard}>
              <SectionTitle>Session</SectionTitle>
              <View style={styles.selectedRow}>
                <MutedText>Signed in role</MutedText>
                <Badge variant="blue">{staffRole}</Badge>
              </View>
            </Card>

            <Card style={styles.compactCard}>
              <SectionTitle>Rota this week</SectionTitle>
              {rota.isLoading ? <InlineSpinner label="Loading rota" /> : null}
              {rotaRows.length === 0 ? (
                <MutedText>No shifts returned for this week.</MutedText>
              ) : null}
              {rotaRows.map((shift) => (
                <View key={shift.id} style={styles.row}>
                  <View
                    style={[
                      styles.bandDot,
                      {
                        backgroundColor:
                          shift.kind === 'Meeting' ? '#0f766e' : (shift.bandColour ?? C.blue),
                      },
                    ]}
                  />
                  <View style={styles.rowBody}>
                    <Text style={styles.rowTitle}>
                      {shift.kind === 'Meeting' ? 'Meeting' : (shift.bandName ?? 'Unassigned band')}
                    </Text>
                    <MutedText>
                      {shift.date} · {formatTime(shift.startsAt)}-{formatTime(shift.endsAt)}
                    </MutedText>
                  </View>
                </View>
              ))}
            </Card>
          </>
        ) : null}

        {activeTab === 'attendance' ? (
          <>
            <ScreenIntro
              subtitle={`${String(markedAttendance)} of ${String(attendanceRows.length)} marked`}
              title="Attendance Register"
            />
            <Card style={styles.compactCard}>
              <Field
                label="Date"
                onChangeText={setAttendanceDateKey}
                placeholder="YYYY-MM-DD"
                value={attendanceDateKey}
              />
              {attendanceRows.slice(0, 8).map((row) => (
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
              {attendanceRows.length === 0 ? (
                <MutedText>No attendance rows returned.</MutedText>
              ) : null}
            </Card>
          </>
        ) : null}

        {activeTab === 'behaviour' ? (
          <>
            <ScreenIntro subtitle="Record merits and demerits" title="Behaviour Log" />
            <StudentPicker
              rows={attendanceRows}
              selectedStudentId={activeStudentId}
              onSelect={(studentId) => {
                setSelectedStudentId(studentId);
                setPaceStudentId(studentId);
              }}
            />
            <Card style={styles.compactCard}>
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
              <Field
                label="Category"
                onChangeText={setBehaviourCategory}
                value={behaviourCategory}
              />
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
                    amount:
                      behaviourType === 'Merit' ? numericInput(behaviourAmount, 1) : undefined,
                  });
                }}
              />
            </Card>
          </>
        ) : null}

        {activeTab === 'pace' ? (
          <>
            <ScreenIntro subtitle="Record today's PACE scores" title="PACE Progress" />
            <Card style={styles.compactCard}>
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
                    disabled={type === 'FinalTest' && !selfTestExistsForPace}
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
                  (paceTestType === 'FinalTest' && !selfTestExistsForPace) ||
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
          </>
        ) : null}

        {activeTab === 'clubs' ? (
          <StaffClubsPanel
            clubs={clubs}
            listError={clubList.error?.message ?? null}
            listLoading={clubList.isLoading}
            rosterError={clubRoster.error?.message ?? null}
            rosterLoading={clubRoster.isLoading}
            rosterSignups={clubRoster.data?.signups ?? []}
            selectedClubId={activeClubId}
            onSelectClub={setSelectedClubId}
          />
        ) : null}

        {activeTab === 'shop' ? (
          <SupervisorShopPanel
            canUseCounter={canUseShopCounter}
            items={shopItems.data ?? []}
            itemsLoading={shopItems.isFetching}
            reservations={shopReservations.data ?? []}
            reservationsError={shopReservations.error?.message ?? null}
            reservationsLoading={shopReservations.isFetching}
          />
        ) : null}
      </ScrollView>
      <PortalMobileBottomNav
        activeId={activeTab}
        items={navItems}
        primaryItemLimit={5}
        onSelect={setActiveTab}
        variant="dark"
      />
    </SafeAreaView>
  );
}

function WorkflowIntro({ today }: { today: Date }) {
  return (
    <View style={styles.screenIntro}>
      <Text style={styles.eyebrow}>
        {new Intl.DateTimeFormat('en-GB', { dateStyle: 'full' }).format(today)}
      </Text>
      <Text style={styles.title}>Good morning</Text>
      <Text style={styles.subtitle}>Supervisor workflow for today's centre operations.</Text>
    </View>
  );
}

function ScreenIntro({ subtitle, title }: { subtitle: string; title: string }) {
  return (
    <View style={styles.screenIntro}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

function SupervisorShopPanel({
  canUseCounter,
  items,
  itemsLoading,
  reservations,
  reservationsError,
  reservationsLoading,
}: {
  canUseCounter: boolean;
  items: ShopItem[];
  itemsLoading: boolean;
  reservations: ShopReservation[];
  reservationsError: string | null;
  reservationsLoading: boolean;
}) {
  const activeItems = items.filter((item) => item.active);
  const lowStockCount = activeItems.filter((item) => item.stockStatus === 'LowStock').length;
  const outOfStockCount = activeItems.filter((item) => item.stockStatus === 'OutOfStock').length;
  const soldCount = items.reduce((total, item) => total + item.soldCount, 0);

  return (
    <View style={styles.panelStack}>
      <ScreenIntro
        subtitle={
          canUseCounter
            ? `${String(reservations.length)} pickup${reservations.length === 1 ? '' : 's'} ready`
            : 'Active catalogue view'
        }
        title="Merit Shop"
      />

      <View style={styles.shopMetricGrid}>
        <WorkflowMetric
          accent={C.blue}
          label="Items"
          sub="active catalogue"
          value={String(activeItems.length)}
        />
        <WorkflowMetric
          accent={lowStockCount > 0 ? C.warning : C.success}
          label="Low"
          sub="stock warning"
          value={String(lowStockCount)}
        />
        <WorkflowMetric
          accent={outOfStockCount > 0 ? C.crimson : C.success}
          label="Out"
          sub="needs restock"
          value={String(outOfStockCount)}
        />
        <WorkflowMetric
          accent={C.crimson}
          label="Sold"
          sub="this term"
          value={formatMerits(soldCount)}
        />
      </View>

      {itemsLoading || (canUseCounter && reservationsLoading) ? (
        <InlineSpinner label="Loading shop" />
      ) : null}

      {canUseCounter ? (
        <Card style={styles.compactCard}>
          <View style={styles.selectedRow}>
            <View style={styles.rowBody}>
              <SectionTitle>Pickup Queue</SectionTitle>
              <MutedText>Ready reservations waiting at the counter.</MutedText>
            </View>
            <Badge variant={reservations.length > 0 ? 'crimson' : 'neutral'}>
              {String(reservations.length)}
            </Badge>
          </View>
          {reservationsError ? <ErrorText>{reservationsError}</ErrorText> : null}
          {reservations.length === 0 && !reservationsLoading ? (
            <MutedText>No ready pickups at the moment.</MutedText>
          ) : null}
          {reservations.slice(0, 4).map((reservation) => (
            <View key={reservation.id} style={styles.shopReservationRow}>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>{reservation.studentName}</Text>
                <MutedText>
                  {reservation.lines
                    .map((line) => `${String(line.unitsReserved)} x ${line.itemName}`)
                    .join(', ')}
                </MutedText>
              </View>
              <Badge variant="blue">{formatMerits(reservation.totalPriceMerits)}m</Badge>
            </View>
          ))}
        </Card>
      ) : null}

      <Card style={styles.compactCard}>
        <View style={styles.selectedRow}>
          <View style={styles.rowBody}>
            <SectionTitle>Catalogue</SectionTitle>
            <MutedText>{String(activeItems.length)} active rewards on the shelf.</MutedText>
          </View>
          <Badge variant="blue">{String(items.length)}</Badge>
        </View>
        {activeItems.length === 0 && !itemsLoading ? (
          <MutedText>No active shop items returned.</MutedText>
        ) : null}
        {activeItems.slice(0, 8).map((item) => (
          <View key={item.id} style={styles.shopItemRow}>
            <View style={[styles.shopItemSwatch, { backgroundColor: item.categoryTint }]}>
              <Text style={[styles.shopItemSwatchText, { color: item.categoryInk }]}>
                {item.name.slice(0, 2).toUpperCase()}
              </Text>
            </View>
            <View style={styles.rowBody}>
              <Text numberOfLines={1} style={styles.rowTitle}>
                {item.name}
              </Text>
              <MutedText>
                {item.categoryLabel} · {formatMerits(item.priceIncVat)} merits
              </MutedText>
            </View>
            <Badge variant={stockVariant(item)}>{stockLabel(item)}</Badge>
          </View>
        ))}
      </Card>
    </View>
  );
}

function WorkflowMetric({
  accent,
  label,
  sub,
  value,
}: {
  accent: string;
  label: string;
  sub: string;
  value: string;
}) {
  return (
    <View style={[styles.metricCard, { borderTopColor: accent }]}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, { color: accent }]}>{value}</Text>
      <Text style={styles.metricSub}>{sub}</Text>
    </View>
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
  compactCard: {
    gap: 10,
    padding: 16,
  },
  content: {
    gap: 14,
    padding: 14,
    paddingBottom: 24,
  },
  eyebrow: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.45,
  },
  metricCard: {
    backgroundColor: C.surface,
    borderColor: C.border,
    borderRadius: 12,
    borderTopWidth: 3,
    borderWidth: 1,
    flex: 1,
    gap: 5,
    minWidth: 96,
    padding: 12,
  },
  metricGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  metricLabel: {
    color: C.textSecondary,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  metricSub: {
    color: C.textMuted,
    fontSize: 10,
    fontWeight: '600',
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '900',
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
  panelStack: {
    gap: 14,
  },
  selectedRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  screenIntro: {
    gap: 2,
    paddingTop: 2,
  },
  scroller: {
    backgroundColor: C.bg,
    flex: 1,
  },
  shell: {
    backgroundColor: C.navy,
    flex: 1,
  },
  shopItemRow: {
    alignItems: 'center',
    borderTopColor: C.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingTop: 10,
  },
  shopItemSwatch: {
    alignItems: 'center',
    borderRadius: 8,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  shopItemSwatchText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  shopMetricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  shopReservationRow: {
    alignItems: 'center',
    borderTopColor: C.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingTop: 10,
  },
  stackRow: {
    borderTopColor: C.border,
    borderTopWidth: 1,
    gap: 9,
    paddingTop: 10,
  },
  statusMessage: {
    backgroundColor: C.blueLight,
    borderColor: C.blueMid,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  statusMessageText: {
    color: C.navy,
    fontSize: 12,
    fontWeight: '700',
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

import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useClerk } from '@clerk/clerk-expo';
import { api, type RouterInputs, type RouterOutputs } from '../../lib/trpc';
import { C } from './mobile-theme';
import { displaySchoolYearLabel } from './parent-smoke-children';
import { Badge, Card, ErrorText, InlineSpinner, MutedText, SectionTitle } from './smoke-ui';
import { StudentLeaderboardPanel } from './student-smoke-leaderboard';
import { StudentPacePanel } from './student-smoke-pace';
import { StudentShopPanel } from './student-smoke-shop';
import { StudentWalletPanel } from './student-smoke-wallet';
import {
  PortalMobileBottomNav,
  PortalMobileHeader,
  type PortalMobileNavItem,
} from './portal-mobile-shell';

type SessionUser = NonNullable<RouterOutputs['health']['me']['user']>;
type StudentProfile = RouterOutputs['student']['me'];
type MeritBalances = RouterOutputs['meritLedger']['balances'];
type PaceDetail = RouterOutputs['pace']['forStudent'];
type LeaderboardInput = NonNullable<Exclude<RouterInputs['leaderboard']['get'], void>>;
type LeaderboardKind = Exclude<NonNullable<LeaderboardInput['kind']>, 'HighestDemerits'>;
type StudentMobileTab = 'home' | 'wallet' | 'pace' | 'leaderboard' | 'shop';
type TransferAccount = 'Spend' | 'Saving';

const studentTabs: Array<PortalMobileNavItem<StudentMobileTab>> = [
  { id: 'home', label: 'Home', icon: 'dashboard' },
  { id: 'wallet', label: 'Wallet', icon: 'wallet' },
  { id: 'pace', label: 'PACE', icon: 'pace' },
  { id: 'leaderboard', label: 'Ranks', icon: 'leaderboard' },
  { id: 'shop', label: 'Shop', icon: 'shop' },
];

const todayFormatter = new Intl.DateTimeFormat('en-GB', { dateStyle: 'full' });

function firstError(...messages: Array<string | undefined>): string | null {
  return messages.find((message) => Boolean(message)) ?? null;
}

function isUsageLimitMessage(message: string | null | undefined): message is string {
  const normalized = message?.toLowerCase();
  return Boolean(normalized?.includes('student portal usage limit reached'));
}

function isOffLimitDayMessage(message: string | null | undefined): message is string {
  return Boolean(message?.toLowerCase().includes('student portal is off limits today'));
}

function studentFriendlyErrorMessage(message: string | null | undefined): string | null {
  if (!message) return null;
  const normalized = message.toLowerCase();
  if (isOffLimitDayMessage(message)) return 'The student portal is off limits today.';
  if (isUsageLimitMessage(message)) return "You have reached today's student portal time limit.";
  if (normalized.includes('student portal is locked by oasis learning centre')) return message;
  if (normalized.includes('student portal is locked by a parent or carer')) return message;
  if (normalized.includes('student profile not found')) {
    return 'No active student profile is linked to this account yet.';
  }
  if (
    normalized.includes('prisma') ||
    normalized.includes('connectorerror') ||
    normalized.includes('queryerror') ||
    normalized.includes('query execution') ||
    normalized.includes('row-level security') ||
    normalized.includes('new row violates') ||
    normalized.includes('postgres') ||
    normalized.includes('rls') ||
    normalized.includes('internal')
  ) {
    return 'Something went wrong. Try again, or contact an administrator if it continues.';
  }
  return message;
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join('')
    .slice(0, 2);
}

function totalBalance(balances: MeritBalances | undefined): number {
  if (!balances) return 0;
  return (
    balances.balances.Spend +
    balances.balances.Saving +
    balances.balances.Investment +
    balances.balances.ShopReserved
  );
}

function completedPaces(pace: PaceDetail | undefined): number {
  return (pace?.subjects ?? []).reduce((sum, subject) => sum + subject.completedPaceCount, 0);
}

function firstUsageLimitMessage(messages: Array<string | undefined>): string | null {
  return (
    messages.find((message): message is string =>
      Boolean(message && (isUsageLimitMessage(message) || isOffLimitDayMessage(message))),
    ) ?? null
  );
}

function StudentHomePanel({
  balances,
  loading,
  pace,
  profile,
}: {
  balances: MeritBalances | undefined;
  loading: boolean;
  pace: PaceDetail | undefined;
  profile: StudentProfile | undefined;
}) {
  if (loading && !profile) return <InlineSpinner label="Loading student profile" />;

  if (!profile) {
    return (
      <Card>
        <SectionTitle>No student profile</SectionTitle>
        <MutedText>No active student profile is linked to this account.</MutedText>
      </Card>
    );
  }

  return (
    <View style={styles.stack}>
      <Card style={styles.heroCard}>
        <View style={styles.heroMain}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(profile.fullName)}</Text>
          </View>
          <View style={styles.heroText}>
            <Text numberOfLines={1} style={styles.heroName}>
              {profile.fullName}
            </Text>
            <Text style={styles.heroSub}>{displaySchoolYearLabel(profile.yearGroup)}</Text>
          </View>
          <View style={styles.heroTotal}>
            <Text style={styles.heroTotalValue}>{String(totalBalance(balances))}</Text>
            <Text style={styles.heroTotalLabel}>merits</Text>
          </View>
        </View>
        <View style={styles.heroStats}>
          <HeroStat label="Spend" value={String(balances?.balances.Spend ?? 0)} />
          <HeroStat label="Saving" value={String(balances?.balances.Saving ?? 0)} />
          <HeroStat label="PACEs" value={String(completedPaces(pace))} />
        </View>
      </Card>
      <Card style={styles.compactCard}>
        <View style={styles.cardHeader}>
          <SectionTitle>Today</SectionTitle>
          <Badge variant="blue">
            {pace ? `${String(pace.today.testCount)} PACE tests` : 'Loading'}
          </Badge>
        </View>
        <MutedText>{todayFormatter.format(new Date())}</MutedText>
      </Card>
    </View>
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

function UsageLimitReachedPanel({ message }: { message: string }) {
  return (
    <Card style={styles.compactCard}>
      <SectionTitle>
        {isOffLimitDayMessage(message) ? 'Student portal locked' : 'Usage limit reached'}
      </SectionTitle>
      <MutedText>{message}</MutedText>
    </Card>
  );
}

export function StudentPortalSmokeScreen({ user }: { user: SessionUser }) {
  const { signOut } = useClerk();
  const utils = api.useUtils();
  const today = useMemo(() => new Date(), []);
  const sessionKey = useMemo(
    () => `student-mobile-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
    [],
  );
  const [activeTab, setActiveTab] = useState<StudentMobileTab>('home');
  const [leaderboardKind, setLeaderboardKind] = useState<LeaderboardKind>('TopSavers');
  const [transferStatus, setTransferStatus] = useState<string | null>(null);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [usageLimitNotice, setUsageLimitNotice] = useState<string | null>(null);

  const student = api.student.me.useQuery(undefined, { retry: false });
  const studentId = student.data?.id ?? '';
  const balances = api.meritLedger.balances.useQuery(
    { studentId },
    { enabled: Boolean(studentId), retry: false },
  );
  const weekActivity = api.meritLedger.activity.useQuery(
    { studentId, range: 'week' },
    { enabled: Boolean(studentId), retry: false },
  );
  const monthActivity = api.meritLedger.activity.useQuery(
    { studentId, range: 'month' },
    { enabled: Boolean(studentId), retry: false },
  );
  const investment = api.investment.account.useQuery(
    { studentId },
    { enabled: Boolean(studentId), retry: false },
  );
  const pace = api.pace.forStudent.useQuery(
    { studentId, date: today },
    { enabled: Boolean(studentId), retry: false },
  );
  const leaderboard = api.leaderboard.get.useQuery(
    { kind: leaderboardKind, limit: 10 },
    { retry: false },
  );
  const shopItems = api.shop.listItems.useQuery(undefined, { retry: false });
  const transfer = api.meritLedger.transfer.useMutation();
  const heartbeat = api.student.heartbeat.useMutation({
    onError(error) {
      if (isUsageLimitMessage(error.message) || isOffLimitDayMessage(error.message)) {
        setUsageLimitNotice(studentFriendlyErrorMessage(error.message));
      }
    },
    onSuccess(data) {
      if (!data.usage.allowed && data.usage.message) {
        setUsageLimitNotice(studentFriendlyErrorMessage(data.usage.message));
      }
    },
  });

  const loading =
    student.isFetching ||
    balances.isFetching ||
    weekActivity.isFetching ||
    monthActivity.isFetching ||
    investment.isFetching ||
    pace.isFetching ||
    leaderboard.isFetching ||
    shopItems.isFetching;
  const queryError = firstError(
    usageLimitNotice ?? undefined,
    studentFriendlyErrorMessage(student.error?.message) ?? undefined,
    studentFriendlyErrorMessage(balances.error?.message) ?? undefined,
    studentFriendlyErrorMessage(weekActivity.error?.message) ?? undefined,
    studentFriendlyErrorMessage(monthActivity.error?.message) ?? undefined,
    studentFriendlyErrorMessage(investment.error?.message) ?? undefined,
    studentFriendlyErrorMessage(pace.error?.message) ?? undefined,
    studentFriendlyErrorMessage(leaderboard.error?.message) ?? undefined,
    studentFriendlyErrorMessage(shopItems.error?.message) ?? undefined,
  );
  const rawUsageLimitMessage = firstUsageLimitMessage([
    student.error?.message,
    heartbeat.error?.message,
    balances.error?.message,
    weekActivity.error?.message,
    monthActivity.error?.message,
    investment.error?.message,
    pace.error?.message,
    leaderboard.error?.message,
    shopItems.error?.message,
  ]);
  const usageLimitMessage = usageLimitNotice ?? studentFriendlyErrorMessage(rawUsageLimitMessage);

  useEffect(() => {
    if (!studentId || usageLimitNotice) return undefined;

    heartbeat.mutate({ sessionKey });
    const intervalId = setInterval(() => {
      heartbeat.mutate({ sessionKey });
    }, 55_000);

    return () => {
      clearInterval(intervalId);
    };
  }, [studentId, sessionKey, usageLimitNotice]);

  async function refresh() {
    await student.refetch();
    if (studentId) {
      await Promise.all([
        balances.refetch(),
        weekActivity.refetch(),
        monthActivity.refetch(),
        investment.refetch(),
        pace.refetch(),
      ]);
    }
    await Promise.all([leaderboard.refetch(), shopItems.refetch()]);
  }

  async function moveMerits(from: TransferAccount, to: TransferAccount, amount: number) {
    if (!studentId) return;
    setTransferStatus(null);
    setTransferError(null);
    try {
      await transfer.mutateAsync({ studentId, from, to, amount });
      setTransferStatus(`${String(amount)} merits moved.`);
      await Promise.all([
        utils.meritLedger.balances.invalidate(),
        utils.meritLedger.activity.invalidate(),
        utils.investment.account.invalidate(),
        utils.leaderboard.get.invalidate(),
      ]);
    } catch (error) {
      setTransferError(error instanceof Error ? error.message : 'Transfer failed.');
    }
  }

  const header = (
    <PortalMobileHeader
      actionAccessibilityLabel={`Sign out of student account ${user.id}`}
      actionLabel="Sign out"
      avatarLabel="S"
      eyebrow="Student Portal"
      onActionPress={() => {
        void signOut();
      }}
      subtitle={student.data ? displaySchoolYearLabel(student.data.yearGroup) : 'Student account'}
      title={student.data?.fullName ?? 'Oasis Learning Centre'}
      variant="dark"
    />
  );

  return (
    <SafeAreaView style={styles.shell}>
      {header}
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
        {!usageLimitMessage && queryError ? <ErrorText>{queryError}</ErrorText> : null}

        {usageLimitMessage ? <UsageLimitReachedPanel message={usageLimitMessage} /> : null}

        {!usageLimitMessage && activeTab === 'home' ? (
          <StudentHomePanel
            balances={balances.data}
            loading={student.isLoading}
            pace={pace.data}
            profile={student.data}
          />
        ) : null}

        {!usageLimitMessage && activeTab === 'wallet' ? (
          <StudentWalletPanel
            balances={balances.data}
            investment={investment.data}
            loading={balances.isFetching || weekActivity.isFetching || monthActivity.isFetching}
            monthActivity={monthActivity.data}
            transferError={transferError}
            transferPending={transfer.isPending}
            transferStatus={transferStatus}
            weekActivity={weekActivity.data}
            onTransfer={(from, to, amount) => {
              void moveMerits(from, to, amount);
            }}
          />
        ) : null}

        {!usageLimitMessage && activeTab === 'pace' ? (
          <StudentPacePanel loading={pace.isFetching} pace={pace.data} />
        ) : null}

        {!usageLimitMessage && activeTab === 'leaderboard' ? (
          <StudentLeaderboardPanel
            kind={leaderboardKind}
            loading={leaderboard.isFetching}
            rows={leaderboard.data?.rows ?? []}
            onKindChange={setLeaderboardKind}
          />
        ) : null}

        {!usageLimitMessage && activeTab === 'shop' ? (
          <StudentShopPanel
            heldMerits={balances.data?.balances.ShopReserved ?? 0}
            items={shopItems.data ?? []}
            loading={shopItems.isFetching}
            ownerName={student.data?.fullName ?? 'Student'}
            spendBalance={balances.data?.balances.Spend ?? 0}
            studentId={studentId}
          />
        ) : null}
      </ScrollView>
      <PortalMobileBottomNav
        activeId={activeTab}
        items={studentTabs}
        primaryItemLimit={5}
        variant="dark"
        onSelect={setActiveTab}
      />
    </SafeAreaView>
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
    fontWeight: '900',
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  compactCard: {
    gap: 10,
    padding: 16,
  },
  content: {
    gap: 14,
    padding: 14,
    paddingBottom: 26,
  },
  heroCard: {
    backgroundColor: C.navy,
    borderColor: C.navy,
    padding: 16,
  },
  heroMain: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  heroName: {
    color: C.surface,
    fontSize: 18,
    fontWeight: '900',
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
    fontWeight: '700',
  },
  heroStats: {
    flexDirection: 'row',
    gap: 8,
  },
  heroStatValue: {
    color: C.surface,
    fontSize: 16,
    fontWeight: '900',
  },
  heroSub: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    fontWeight: '700',
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
    fontWeight: '800',
  },
  heroTotalValue: {
    color: C.blue,
    fontSize: 26,
    fontWeight: '900',
  },
  scroller: {
    backgroundColor: C.bg,
    flex: 1,
  },
  shell: {
    backgroundColor: C.navy,
    flex: 1,
  },
  stack: {
    gap: 14,
  },
});

import { useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useClerk } from '@clerk/clerk-expo';
import { api, type RouterOutputs } from '../../lib/trpc';
import { C } from '../core/mobile-theme';
import { PortalMobileHeader } from '../core/portal-mobile-shell';
import { AvailabilityPanel } from './staff-rota-availability-panel';
import { TabButton } from './staff-rota-common';
import { RotaPanel } from './staff-rota-rota-panel';
import { SwapPanel } from './staff-rota-swap-panel';
import {
  addDays,
  currentMonthKey,
  dateKey,
  monthRange,
  newAvailabilityDraft,
  newMonthlyAvailabilityDraft,
  startOfWeek,
  type AvailabilityDraft,
  type MonthlyAvailabilityDraft,
  type RotaMode,
} from './staff-rota-utils';

type SessionUser = NonNullable<RouterOutputs['health']['me']['user']>;
type StaffRotaTab = 'rota' | 'availability' | 'swaps';

const today = new Date(`${dateKey(new Date())}T00:00:00.000Z`);

export function StaffRotaScreen({
  onBack,
  user,
}: {
  onBack: () => void;
  user: SessionUser | undefined;
}) {
  const { signOut } = useClerk();
  const utils = api.useUtils();
  const [activeTab, setActiveTab] = useState<StaffRotaTab>('rota');
  const [rotaMode, setRotaMode] = useState<RotaMode>('today');
  const [month, setMonth] = useState(currentMonthKey);
  const [weeklyDraft, setWeeklyDraft] = useState<AvailabilityDraft[]>([]);
  const [monthlyDraft, setMonthlyDraft] = useState<MonthlyAvailabilityDraft[]>([]);
  const [fromShiftId, setFromShiftId] = useState('');
  const [toShiftId, setToShiftId] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const weekStart = useMemo(() => startOfWeek(today), []);
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);
  const monthBounds = useMemo(() => monthRange(month), [month]);

  const todayRota = api.rota.myRota.useQuery({ from: today, to: today }, { retry: false });
  const weekRota = api.rota.myRota.useQuery({ from: weekStart, to: weekEnd }, { retry: false });
  const monthRota = api.rota.myRota.useQuery(
    { from: monthBounds.from, to: monthBounds.to },
    { enabled: rotaMode === 'month', retry: false },
  );
  const availability = api.rota.myAvailability.useQuery(undefined, { retry: false });
  const monthlyAvailability = api.rota.myMonthlyAvailability.useQuery({ month }, { retry: false });
  const swapCandidates = api.rota.swapCandidates.useQuery(
    { from: weekStart, to: weekEnd },
    { retry: false },
  );
  const mySwaps = api.rota.mySwapRequests.useQuery(undefined, { retry: false });

  const saveAvailability = api.rota.setMyAvailability.useMutation({
    onError: (error) => {
      setStatusMessage(error.message);
    },
    onSuccess: async (rows) => {
      setStatusMessage('Weekly availability saved.');
      setWeeklyDraft(rows.map((row) => ({ ...row, id: row.id })));
      await Promise.all([
        utils.rota.myAvailability.invalidate(),
        utils.staffHome.summary.invalidate(),
      ]);
    },
  });
  const saveMonthlyAvailability = api.rota.setMyMonthlyAvailability.useMutation({
    onError: (error) => {
      setStatusMessage(error.message);
    },
    onSuccess: async (rows) => {
      setStatusMessage('Monthly unavailability saved.');
      setMonthlyDraft(rows.map((row) => ({ ...row, id: row.id })));
      await Promise.all([
        utils.rota.myMonthlyAvailability.invalidate({ month }),
        utils.staffHome.summary.invalidate(),
      ]);
    },
  });
  const requestSwap = api.rota.requestSwap.useMutation({
    onError: (error) => {
      setStatusMessage(error.message);
    },
    onSuccess: async () => {
      setStatusMessage('Shift swap request sent for Head review.');
      setFromShiftId('');
      setToShiftId('');
      await Promise.all([
        utils.rota.myRota.invalidate({ from: weekStart, to: weekEnd }),
        utils.rota.swapCandidates.invalidate({ from: weekStart, to: weekEnd }),
        utils.rota.mySwapRequests.invalidate(),
        utils.staffHome.summary.invalidate(),
      ]);
    },
  });

  useEffect(() => {
    if (!availability.data) return;
    setWeeklyDraft(
      availability.data.map((window) => ({
        id: window.id,
        dayOfWeek: window.dayOfWeek,
        endMinute: window.endMinute,
        startMinute: window.startMinute,
      })),
    );
  }, [availability.data]);

  useEffect(() => {
    if (!monthlyAvailability.data) return;
    setMonthlyDraft(
      monthlyAvailability.data.map((window) => ({
        id: window.id,
        date: window.date,
        endMinute: window.endMinute,
        startMinute: window.startMinute,
      })),
    );
  }, [monthlyAvailability.data]);

  const activeRota =
    rotaMode === 'today'
      ? (todayRota.data ?? [])
      : rotaMode === 'week'
        ? (weekRota.data ?? [])
        : (monthRota.data ?? []);
  const activeRotaLoading =
    rotaMode === 'today'
      ? todayRota.isLoading
      : rotaMode === 'week'
        ? weekRota.isLoading
        : monthRota.isLoading;
  const activeRotaError =
    rotaMode === 'today'
      ? todayRota.error?.message
      : rotaMode === 'week'
        ? weekRota.error?.message
        : monthRota.error?.message;
  const pendingSwaps = (mySwaps.data ?? []).filter((swap) => swap.status === 'Pending');
  const refreshing =
    todayRota.isFetching ||
    weekRota.isFetching ||
    monthRota.isFetching ||
    availability.isFetching ||
    monthlyAvailability.isFetching ||
    swapCandidates.isFetching ||
    mySwaps.isFetching ||
    saveAvailability.isPending ||
    saveMonthlyAvailability.isPending ||
    requestSwap.isPending;

  async function refresh() {
    await Promise.all([
      todayRota.refetch(),
      weekRota.refetch(),
      rotaMode === 'month' ? monthRota.refetch() : Promise.resolve(),
      availability.refetch(),
      monthlyAvailability.refetch(),
      swapCandidates.refetch(),
      mySwaps.refetch(),
    ]);
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
        subtitle={`${user?.role ?? 'Staff'} · Rota`}
        title="Oasis Learning Centre"
        variant="dark"
      />
      <View style={styles.content}>
        <View style={styles.topRow}>
          <Pressable
            accessibilityLabel="Back to staff home"
            accessibilityRole="button"
            onPress={onBack}
            style={styles.backButton}
          >
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>
          <View style={styles.titleGroup}>
            <Text style={styles.eyebrow}>Rota and availability</Text>
            <Text style={styles.title}>Today, weeks, leave blocks and swaps</Text>
          </View>
        </View>

        <View style={styles.tabRow}>
          <TabButton
            active={activeTab === 'rota'}
            label="Rota"
            onPress={() => {
              setActiveTab('rota');
            }}
          />
          <TabButton
            active={activeTab === 'availability'}
            label="Availability"
            onPress={() => {
              setActiveTab('availability');
            }}
          />
          <TabButton
            active={activeTab === 'swaps'}
            badge={pendingSwaps.length}
            label="Swaps"
            onPress={() => {
              setActiveTab('swaps');
            }}
          />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              onRefresh={() => {
                void refresh();
              }}
              refreshing={refreshing}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {statusMessage ? (
            <View style={styles.statusMessage}>
              <Text style={styles.statusMessageText}>{statusMessage}</Text>
            </View>
          ) : null}

          {activeTab === 'rota' ? (
            <RotaPanel
              error={activeRotaError}
              loading={activeRotaLoading}
              month={month}
              mode={rotaMode}
              onChangeMode={setRotaMode}
              onChangeMonth={setMonth}
              shifts={activeRota}
            />
          ) : null}

          {activeTab === 'availability' ? (
            <AvailabilityPanel
              monthlyDraft={monthlyDraft}
              monthlyError={
                monthlyAvailability.error?.message ?? saveMonthlyAvailability.error?.message
              }
              monthlyLoading={monthlyAvailability.isLoading}
              month={month}
              onAddMonthly={() => {
                setMonthlyDraft((rows) => [...rows, newMonthlyAvailabilityDraft(month)]);
              }}
              onAddWeekly={() => {
                setWeeklyDraft((rows) => [...rows, newAvailabilityDraft()]);
              }}
              onChangeMonthly={setMonthlyDraft}
              onChangeMonth={setMonth}
              onChangeWeekly={setWeeklyDraft}
              onSaveMonthly={() => {
                saveMonthlyAvailability.mutate({
                  month,
                  windows: monthlyDraft.map(({ date, endMinute, startMinute }) => ({
                    date,
                    endMinute,
                    startMinute,
                  })),
                });
              }}
              onSaveWeekly={() => {
                saveAvailability.mutate({
                  windows: weeklyDraft.map(({ dayOfWeek, endMinute, startMinute }) => ({
                    dayOfWeek,
                    endMinute,
                    startMinute,
                  })),
                });
              }}
              savingMonthly={saveMonthlyAvailability.isPending}
              savingWeekly={saveAvailability.isPending}
              weeklyDraft={weeklyDraft}
              weeklyError={availability.error?.message ?? saveAvailability.error?.message}
              weeklyLoading={availability.isLoading}
            />
          ) : null}

          {activeTab === 'swaps' ? (
            <SwapPanel
              candidates={swapCandidates.data ?? []}
              candidatesError={swapCandidates.error?.message}
              candidatesLoading={swapCandidates.isLoading}
              fromShiftId={fromShiftId}
              onChangeFrom={setFromShiftId}
              onChangeTo={setToShiftId}
              onSubmit={() => {
                requestSwap.mutate({ fromShiftId, toShiftId });
              }}
              saving={requestSwap.isPending}
              swaps={mySwaps.data ?? []}
              swapsError={mySwaps.error?.message ?? requestSwap.error?.message}
              swapsLoading={mySwaps.isLoading}
              toShiftId={toShiftId}
              weekShifts={weekRota.data ?? []}
            />
          ) : null}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: 'center',
    borderColor: C.border,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 12,
  },
  backButtonText: {
    color: C.blue,
    fontSize: 13,
    fontWeight: '800',
  },
  content: {
    flex: 1,
    gap: 14,
    padding: 16,
  },
  eyebrow: {
    color: C.textMuted,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  scrollContent: {
    gap: 12,
    paddingBottom: 28,
  },
  shell: {
    backgroundColor: C.bg,
    flex: 1,
  },
  statusMessage: {
    backgroundColor: C.successBg,
    borderColor: C.successMid,
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
  },
  statusMessageText: {
    color: C.success,
    fontSize: 12,
    fontWeight: '800',
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
  },
  title: {
    color: C.navy,
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 24,
  },
  titleGroup: {
    flex: 1,
    gap: 2,
  },
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
});

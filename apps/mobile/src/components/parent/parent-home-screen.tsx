import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api, type RouterOutputs } from '../../lib/trpc';
import { C } from '../core/mobile-theme';
import { Card, ErrorText, InlineSpinner, MutedText } from '../core/mobile-ui';
import { PwaHomeActions } from '../pwa/pwa-home-actions';
import { ParentChildHero } from './parent-child-hero';
import { ParentChildSwitcher } from './parent-child-switcher';
import {
  ParentMeritWalletPreview,
  ParentRecentActivityCard,
  ParentUrgentActionCards,
} from './parent-home-summary-cards';
import {
  formatParentDate,
  parentHomeSignals,
  type ParentDashboard,
  type ParentDashboardChild,
} from './parent-home-utils';

type ParentProfile = RouterOutputs['profile']['me'];
type RegistrationStatus = RouterOutputs['registration']['status'];

export function ParentHomeScreen({
  children,
  dashboard,
  dashboardError,
  loadingDashboard,
  onRefresh,
  onSelectChild,
  profile,
  refreshing,
  registrationStatus,
  selectedChild,
}: {
  children: readonly ParentDashboardChild[];
  dashboard: ParentDashboard | undefined;
  dashboardError: string | null;
  loadingDashboard: boolean;
  onRefresh: () => Promise<void>;
  onSelectChild: (studentId: string) => void;
  profile: ParentProfile | undefined;
  refreshing: boolean;
  registrationStatus: RegistrationStatus | undefined;
  selectedChild: ParentDashboardChild | null;
}) {
  const hasLinkedChildren = children.length > 0;
  const notices = api.notice.listForParents.useQuery(undefined, {
    enabled: hasLinkedChildren,
    retry: false,
  });
  const conversations = api.message.listConversations.useQuery(
    { kinds: ['ParentStaff'], limit: 10 },
    { enabled: hasLinkedChildren, retry: false },
  );
  const clubContext = api.club.linkedChildSignupContext.useQuery(undefined, {
    enabled: hasLinkedChildren,
    retry: false,
  });
  const invoices = api.invoice.listParent.useQuery(
    { status: 'All' },
    { enabled: hasLinkedChildren, retry: false },
  );
  const permissionSlips = api.permissionSlip.listParent.useQuery(undefined, {
    enabled: hasLinkedChildren,
    retry: false,
  });

  const selectedChildId = selectedChild?.student.id ?? null;
  const signals = parentHomeSignals({
    clubContext: clubContext.data,
    conversations: conversations.data?.items ?? [],
    invoices: invoices.data,
    notices: notices.data ?? [],
    permissionSlips: permissionSlips.data,
    selectedChildId,
  });
  const loadingSignals =
    notices.isLoading ||
    conversations.isLoading ||
    clubContext.isLoading ||
    invoices.isLoading ||
    permissionSlips.isLoading;

  async function refreshAll() {
    await Promise.all([
      onRefresh(),
      hasLinkedChildren ? notices.refetch() : Promise.resolve(),
      hasLinkedChildren ? conversations.refetch() : Promise.resolve(),
      hasLinkedChildren ? clubContext.refetch() : Promise.resolve(),
      hasLinkedChildren ? invoices.refetch() : Promise.resolve(),
      hasLinkedChildren ? permissionSlips.refetch() : Promise.resolve(),
    ]);
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          onRefresh={() => {
            void refreshAll();
          }}
          refreshing={refreshing || loadingSignals}
        />
      }
      showsVerticalScrollIndicator={false}
      style={styles.scroller}
    >
      <View style={styles.intro}>
        <Text style={styles.eyebrow}>Parent Home</Text>
        <Text style={styles.title}>Welcome{profile?.fullName ? `, ${profile.fullName}` : ''}</Text>
        <Text style={styles.subtitle}>
          {selectedChild
            ? `Parent of ${selectedChild.student.fullName}`
            : `${String(children.length)} linked children`}
        </Text>
        <Text style={styles.dateText}>{formatParentDate(dashboard?.range.to ?? new Date())}</Text>
      </View>

      {loadingDashboard && !dashboard ? <InlineSpinner label="Loading parent dashboard" /> : null}
      {dashboardError ? <ErrorText>{dashboardError}</ErrorText> : null}

      {!hasLinkedChildren && !loadingDashboard ? (
        <ParentEmptyState registrationStatus={registrationStatus} />
      ) : null}

      {selectedChild ? (
        <>
          <ParentChildSwitcher
            children={children}
            onSelect={onSelectChild}
            selectedChildId={selectedChild.student.id}
          />
          <ParentChildHero child={selectedChild} />
          <ParentUrgentActionCards signals={signals} />
          <View style={styles.featureStack}>
            <ParentRecentActivityCard child={selectedChild} />
            <ParentMeritWalletPreview child={selectedChild} />
          </View>
        </>
      ) : null}

      <PwaHomeActions />
    </ScrollView>
  );
}

function ParentEmptyState({
  registrationStatus,
}: {
  registrationStatus: RegistrationStatus | undefined;
}) {
  if (registrationStatus?.requiresRegistration) {
    return (
      <Card>
        <Text style={styles.emptyTitle}>Child registration needed</Text>
        <MutedText>Complete family registration before linked children can appear here.</MutedText>
      </Card>
    );
  }

  return (
    <Card>
      <Text style={styles.emptyTitle}>No linked children</Text>
      <MutedText>
        Linked child records will appear once Oasis connects them to this account.
      </MutedText>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 14,
    padding: 16,
    paddingBottom: 36,
  },
  dateText: {
    color: C.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  emptyTitle: {
    color: C.navy,
    fontSize: 17,
    fontWeight: '900',
  },
  eyebrow: {
    color: C.crimson,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  featureStack: {
    gap: 14,
  },
  intro: {
    gap: 3,
  },
  scroller: {
    flex: 1,
  },
  subtitle: {
    color: C.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  title: {
    color: C.navy,
    fontSize: 23,
    fontWeight: '900',
    lineHeight: 28,
  },
});

import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '../../lib/trpc';
import { C } from './mobile-theme';
import { ParentPortalScreen } from '../parent/parent-portal-screen';
import { StaffPortalScreen } from '../staff/staff-portal-screen';
import { StudentPortalScreen } from '../student/student-portal-screen';
import { TechnicalSupportPortalScreen } from '../support/technical-support-portal-screen';
import { MobileAccessRevokedScreen } from './mobile-access-revoked-screen';

type MobilePortalView = 'default' | 'parent';

export function SignedInRouter() {
  const [portalView, setPortalView] = useState<MobilePortalView>('default');
  const health = api.health.me.useQuery(undefined, { retry: false });
  useEffect(() => {
    let appState = AppState.currentState;
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (appState.match(/inactive|background/) && nextAppState === 'active') {
        void health.refetch();
      }
      appState = nextAppState;
    });
    return () => {
      subscription.remove();
    };
  }, [health.refetch]);
  const user = health.data?.user;
  const linkedChildCount = health.data?.linkedChildCount ?? 0;
  const parentVolunteerAccess = health.data?.parentVolunteerAccess ?? null;
  const hasCachedHealthRefreshError = health.isError && Boolean(health.data);
  const canSwitchToParent =
    Boolean(user) && user?.role !== 'Parent' && user?.role !== 'Student' && linkedChildCount > 0;

  function renderCachedSession(content: ReactNode) {
    return (
      <View style={styles.sessionShell}>
        {hasCachedHealthRefreshError ? (
          <View accessibilityLiveRegion="polite" accessibilityRole="alert" style={styles.refreshWarning}>
            <Text style={styles.refreshWarningText}>
              We could not refresh your access. Showing your last available information.
            </Text>
            <Pressable
              accessibilityLabel="Retry access refresh"
              accessibilityRole="button"
              disabled={health.isFetching}
              onPress={() => {
                void health.refetch();
              }}
              style={styles.refreshWarningButton}
            >
              <Text style={styles.refreshWarningButtonText}>
                {health.isFetching ? 'Refreshing…' : 'Retry refresh'}
              </Text>
            </Pressable>
          </View>
        ) : null}
        {content}
      </View>
    );
  }

  if (health.isLoading && !user) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={C.blue} />
        <Text style={styles.loadingText}>Loading session</Text>
      </View>
    );
  }

  if (health.isError && !health.data) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>We could not refresh your access. Please try again.</Text>
        <Pressable
          accessibilityRole="button"
          disabled={health.isFetching}
          onPress={() => {
            void health.refetch();
          }}
          style={styles.retryButton}
        >
          <Text style={styles.retryButtonText}>
            {health.isFetching ? 'Retrying session…' : 'Retry session'}
          </Text>
        </Pressable>
      </View>
    );
  }

  if (health.data?.accountAccessState === 'deactivated') {
    return <MobileAccessRevokedScreen />;
  }

  if (user && canSwitchToParent && portalView === 'parent') {
    return renderCachedSession(
      <ParentPortalScreen
        parentVolunteerAccess={parentVolunteerAccess}
        user={user}
        onRefreshEntitlement={health.refetch}
        onSwitchToStaff={() => {
          setPortalView('default');
        }}
      />,
    );
  }

  if (user?.role === 'Parent') {
    return renderCachedSession(
      <ParentPortalScreen
        parentVolunteerAccess={parentVolunteerAccess}
        user={user}
        onRefreshEntitlement={health.refetch}
      />,
    );
  }

  if (user?.role === 'Student') {
    return renderCachedSession(<StudentPortalScreen user={user} />);
  }

  if (
    user?.role === 'Head' ||
    user?.role === 'Principal' ||
    user?.role === 'Pastor' ||
    user?.role === 'HeadOfDiscipline' ||
    user?.role === 'ClubsAdmin' ||
    user?.role === 'Supervisor'
  ) {
    if (canSwitchToParent) {
      return renderCachedSession(
        <StaffPortalScreen
          user={user}
          onSwitchToParent={() => {
            setPortalView('parent');
          }}
        />,
      );
    }

    return renderCachedSession(<StaffPortalScreen user={user} />);
  }

  if (user?.role === 'TechnicalSupport') {
    if (canSwitchToParent) {
      return renderCachedSession(
        <TechnicalSupportPortalScreen
          user={user}
          onSwitchToParent={() => {
            setPortalView('parent');
          }}
        />,
      );
    }

    return renderCachedSession(<TechnicalSupportPortalScreen user={user} />);
  }

  if (user && linkedChildCount > 0) {
    return renderCachedSession(
      <ParentPortalScreen
        parentVolunteerAccess={parentVolunteerAccess}
        user={user}
        onRefreshEntitlement={health.refetch}
      />,
    );
  }

  return (
    <View style={styles.loading}>
      <Text style={styles.loadingText}>This mobile role is not ready yet.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    alignItems: 'center',
    backgroundColor: C.bg,
    flex: 1,
    gap: 10,
    justifyContent: 'center',
  },
  loadingText: {
    color: C.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  retryButton: {
    backgroundColor: C.blue,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  retryButtonText: {
    color: C.surface,
    fontSize: 13,
    fontWeight: '700',
  },
  refreshWarning: {
    alignItems: 'center',
    backgroundColor: C.warningBg,
    borderBottomColor: C.warning,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  refreshWarningButton: {
    backgroundColor: C.surface,
    borderColor: C.warning,
    borderRadius: 7,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  refreshWarningButtonText: {
    color: C.warning,
    fontSize: 12,
    fontWeight: '700',
  },
  refreshWarningText: {
    color: C.warning,
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  sessionShell: {
    flex: 1,
  },
});

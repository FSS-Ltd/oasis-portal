import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { api } from '../../lib/trpc';
import { C } from './mobile-theme';
import { ParentPortalScreen } from '../parent/parent-portal-screen';
import { StaffPortalScreen } from '../staff/staff-portal-screen';
import { StudentPortalScreen } from '../student/student-portal-screen';
import { TechnicalSupportPortalScreen } from '../support/technical-support-portal-screen';

export function SignedInRouter() {
  const health = api.health.me.useQuery(undefined, { retry: false });
  const user = health.data?.user;

  if (health.isLoading && !user) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={C.blue} />
        <Text style={styles.loadingText}>Loading session</Text>
      </View>
    );
  }

  if (health.isError) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>Could not load session. Please try again.</Text>
        {health.error.message ? <Text style={styles.errorDetail}>{health.error.message}</Text> : null}
      </View>
    );
  }

  if (user?.role === 'Parent') {
    return <ParentPortalScreen user={user} />;
  }

  if (user?.role === 'Student') {
    return <StudentPortalScreen user={user} />;
  }

  if (
    user?.role === 'Head' ||
    user?.role === 'Principal' ||
    user?.role === 'Pastor' ||
    user?.role === 'HeadOfDiscipline' ||
    user?.role === 'ClubsAdmin' ||
    user?.role === 'Supervisor'
  ) {
    return <StaffPortalScreen user={user} />;
  }

  if (user?.role === 'TechnicalSupport') {
    return <TechnicalSupportPortalScreen user={user} />;
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
  errorDetail: {
    color: C.textMuted,
    fontSize: 11,
    fontWeight: '500',
    paddingHorizontal: 24,
    textAlign: 'center',
  },
});

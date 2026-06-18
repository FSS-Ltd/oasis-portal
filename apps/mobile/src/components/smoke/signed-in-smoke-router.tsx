import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { api } from '../../lib/trpc';
import { C } from './mobile-theme';
import { ParentPortalSmokeScreen } from './parent-portal-smoke-screen';
import { StudentPortalSmokeScreen } from './student-portal-smoke-screen';
import { StaffPortalScreen } from '../staff/staff-portal-screen';

export function SignedInSmokeRouter() {
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

  if (user?.role === 'Parent') {
    return <ParentPortalSmokeScreen user={user} />;
  }

  if (user?.role === 'Student') {
    return <StudentPortalSmokeScreen user={user} />;
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
});

import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useClerk } from '@clerk/clerk-expo';
import { api } from '../../lib/trpc';
import { C } from './mobile-theme';
import { ParentPortalScreen } from '../parent/parent-portal-screen';
import { StaffPortalScreen } from '../staff/staff-portal-screen';
import { StudentPortalScreen } from '../student/student-portal-screen';

export function SignedInRouter() {
  const { signOut } = useClerk();
  const health = api.health.me.useQuery(undefined, { retry: false });
  const user = health.data?.user;

  useEffect(() => {
    if (health.isError) {
      void signOut();
    }
  }, [health.isError, signOut]);

  if (health.isLoading || health.isError) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={C.blue} />
        <Text style={styles.loadingText}>Loading session</Text>
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
    user?.role === 'Supervisor' ||
    user?.role === 'TechnicalSupport'
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

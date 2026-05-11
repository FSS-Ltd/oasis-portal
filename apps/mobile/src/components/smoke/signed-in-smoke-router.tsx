import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { api } from '../../lib/trpc';
import { C } from './mobile-theme';
import { ParentPortalSmokeScreen } from './parent-portal-smoke-screen';
import { SupervisorSmokeScreen } from './supervisor-smoke-screen';

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

  return <SupervisorSmokeScreen />;
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

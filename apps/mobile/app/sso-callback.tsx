import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { C } from '../src/components/core/mobile-theme';

export default function SsoCallback() {
  return (
    <View style={styles.shell}>
      <ActivityIndicator color={C.blue} />
      <Text style={styles.text}>Completing Clerk SSO</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    alignItems: 'center',
    backgroundColor: C.bg,
    flex: 1,
    gap: 10,
    justifyContent: 'center',
  },
  text: {
    color: C.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
});

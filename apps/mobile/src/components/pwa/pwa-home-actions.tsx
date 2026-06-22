import { StyleSheet, View } from 'react-native';
import { InstallAppButton } from './install-app-button';
import { PwaNotificationButton } from './pwa-notification-button';

export function PwaHomeActions() {
  return (
    <View style={styles.stack}>
      <PwaNotificationButton />
      <InstallAppButton />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 10,
  },
});

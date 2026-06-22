import { StyleSheet, View } from 'react-native';
import { PwaNotificationButton } from './pwa-notification-button';

export function PwaHomeActions() {
  return (
    <View style={styles.stack}>
      <PwaNotificationButton />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 10,
  },
});

import { Stack } from 'expo-router';
import { ClerkProvider } from '@clerk/clerk-expo';
import { tokenCache } from '@clerk/clerk-expo/token-cache';
import { StyleSheet, Text, View } from 'react-native';
import { MobileTrpcProvider } from '../src/lib/trpc-provider';
import { C } from '../src/components/core/mobile-theme';
import { PwaServiceWorkerRegistration } from '../src/components/pwa/pwa-service-worker-registration';

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

export default function RootLayout() {
  if (!publishableKey) return <MissingClerkConfig />;

  if (!tokenCache) {
    return (
      <ClerkProvider publishableKey={publishableKey}>
        <PwaServiceWorkerRegistration />
        <MobileTrpcProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </MobileTrpcProvider>
      </ClerkProvider>
    );
  }

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <PwaServiceWorkerRegistration />
      <MobileTrpcProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </MobileTrpcProvider>
    </ClerkProvider>
  );
}

function MissingClerkConfig() {
  return (
    <View style={styles.configShell}>
      <PwaServiceWorkerRegistration />
      <Text style={styles.configTitle}>Missing Clerk configuration</Text>
      <Text style={styles.configText}>
        Set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY before starting Expo.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  configShell: {
    backgroundColor: C.bg,
    flex: 1,
    gap: 8,
    justifyContent: 'center',
    padding: 20,
  },
  configText: {
    color: C.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  configTitle: {
    color: C.navy,
    fontSize: 20,
    fontWeight: '800',
  },
});

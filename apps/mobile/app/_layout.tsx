import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { ClerkProvider } from '@clerk/clerk-expo';
import { tokenCache } from '@clerk/clerk-expo/token-cache';
import { StyleSheet, Text, View } from 'react-native';
import { MobileTrpcProvider } from '../src/lib/trpc-provider';
import { C } from '../src/components/core/mobile-theme';
import { PwaServiceWorkerRegistration } from '../src/components/pwa/pwa-service-worker-registration';

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

// Cap content width so iPad, foldables and the PWA do not stretch a phone layout edge to edge.
function AppFrame({ children }: { children: ReactNode }) {
  return (
    <View style={styles.frame}>
      <StatusBar style="dark" />
      <View style={styles.column}>{children}</View>
    </View>
  );
}

function AppStack() {
  return (
    <AppFrame>
      <Stack screenOptions={{ contentStyle: { backgroundColor: C.bg }, headerShown: false }} />
    </AppFrame>
  );
}

export default function RootLayout() {
  if (!publishableKey) return <MissingClerkConfig />;

  if (!tokenCache) {
    return (
      <ClerkProvider publishableKey={publishableKey}>
        <PwaServiceWorkerRegistration />
        <MobileTrpcProvider>
          <AppStack />
        </MobileTrpcProvider>
      </ClerkProvider>
    );
  }

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <PwaServiceWorkerRegistration />
      <MobileTrpcProvider>
        <AppStack />
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
  column: {
    flex: 1,
    maxWidth: 680,
    width: '100%',
  },
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
  frame: {
    alignItems: 'center',
    backgroundColor: C.bg,
    flex: 1,
  },
});

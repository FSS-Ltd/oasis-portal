import { ClerkLoaded, ClerkLoading, SignedIn, SignedOut } from '@clerk/clerk-expo';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SignInPanel } from '../src/components/smoke/sign-in-panel';
import { SignedInSmokeRouter } from '../src/components/smoke/signed-in-smoke-router';
import { C } from '../src/components/smoke/mobile-theme';

export default function Index() {
  return (
    <>
      <ClerkLoading>
        <View style={styles.loading}>
          <ActivityIndicator color={C.blue} />
          <Text style={styles.loadingText}>Loading Clerk</Text>
        </View>
      </ClerkLoading>
      <ClerkLoaded>
        <SignedOut>
          <SignInPanel />
        </SignedOut>
        <SignedIn>
          <SignedInSmokeRouter />
        </SignedIn>
      </ClerkLoaded>
    </>
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

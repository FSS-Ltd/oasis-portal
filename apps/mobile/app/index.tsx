import { ClerkLoaded, ClerkLoading, SignedIn, SignedOut } from '@clerk/clerk-expo';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SignInPanel } from '../src/components/core/sign-in-panel';
import { SignedInRouter } from '../src/components/core/signed-in-router';
import { C } from '../src/components/core/mobile-theme';

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
          <SignedInRouter />
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

import { Stack } from 'expo-router';
import { ClerkProvider } from '@clerk/clerk-expo';
import { tokenCache } from '@clerk/clerk-expo/token-cache';

export default function RootLayout() {
  if (!tokenCache) {
    return (
      <ClerkProvider>
        <Stack />
      </ClerkProvider>
    );
  }

  return (
    <ClerkProvider tokenCache={tokenCache}>
      <Stack />
    </ClerkProvider>
  );
}

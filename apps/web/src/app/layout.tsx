import type { ReactNode } from 'react';
import { ClerkProvider } from '@clerk/nextjs';
import { hasClerkPublishableKey } from './(auth)/clerk-config';

export const metadata = {
  title: 'Oasis Learning Centre',
  description: 'Bespoke centre management platform',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  if (!hasClerkPublishableKey()) {
    return (
      <html lang="en">
        <body>{children}</body>
      </html>
    );
  }

  return (
    <ClerkProvider>
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}

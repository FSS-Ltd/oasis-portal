import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ClerkProvider } from '@clerk/nextjs';
import { hasClerkPublishableKey } from './(auth)/clerk-config';
import { InactivityLogout } from '@/components/auth/inactivity-logout';
import { TrpcProvider } from '@/components/providers/trpc-provider';
import { Toaster } from '@/components/ui/toaster';
import './globals.css';
import './landing.css';
import './landing-motion.css';

export const metadata = {
  title: 'Oasis Learning Centre',
  description: 'Bespoke centre management platform',
  icons: {
    icon: [{ url: '/oasis-favicon.svg', type: 'image/svg+xml' }],
  },
} satisfies Metadata;

export default function RootLayout({ children }: { children: ReactNode }) {
  const hasClerk = hasClerkPublishableKey();

  if (!hasClerk) {
    return (
      <html lang="en">
        <body>
          <TrpcProvider>{children}</TrpcProvider>
          <Toaster />
        </body>
      </html>
    );
  }

  return (
    <ClerkProvider>
      <html lang="en">
        <body>
          <InactivityLogout />
          <TrpcProvider enableRealtime>{children}</TrpcProvider>
          <Toaster />
        </body>
      </html>
    </ClerkProvider>
  );
}

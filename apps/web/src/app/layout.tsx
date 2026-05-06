import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ClerkProvider } from '@clerk/nextjs';
import { hasClerkPublishableKey } from './(auth)/clerk-config';
import { TrpcProvider } from '@/components/providers/trpc-provider';
import './globals.css';

export const metadata = {
  title: 'Oasis Learning Centre',
  description: 'Bespoke centre management platform',
  icons: {
    icon: [{ url: '/oasis-favicon.svg', type: 'image/svg+xml' }],
  },
} satisfies Metadata;

export default function RootLayout({ children }: { children: ReactNode }) {
  if (!hasClerkPublishableKey()) {
    return (
      <html lang="en">
        <body>
          <TrpcProvider>{children}</TrpcProvider>
        </body>
      </html>
    );
  }

  return (
    <ClerkProvider>
      <html lang="en">
        <body>
          <TrpcProvider>{children}</TrpcProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}

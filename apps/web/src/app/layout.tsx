import type { ReactNode } from 'react';

export const metadata = {
  title: 'Oasis Learning Centre',
  description: 'Bespoke centre management platform',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

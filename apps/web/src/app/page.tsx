import Link from 'next/link';

export default function HomePage() {
  return (
    <main style={{ padding: 32, fontFamily: 'system-ui, sans-serif' }}>
      <h1>Oasis Learning Centre Portal</h1>
      <p>Sign in to access your Oasis dashboard.</p>
      <Link href="/sign-in/">Sign in</Link>
    </main>
  );
}

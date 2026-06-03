import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { LandingPage } from './landing-page';
import { loadLandingPageData } from './landing-data';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const { userId } = await auth();
  if (userId) redirect('/post-sign-in');

  const data = await loadLandingPageData();
  return <LandingPage data={data} />;
}

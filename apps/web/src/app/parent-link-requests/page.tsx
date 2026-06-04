import Image from 'next/image';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import '../(admin)/admin/admin.css';
import '../registration/registration.css';
import { ParentLinkRequestsClient } from './parent-link-requests-client';

export const dynamic = 'force-dynamic';

export default async function ParentLinkRequestsPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in/');

  return (
    <main className="admin-shell registration-shell">
      <div className="registration-page admin-shell__main">
        <div className="registration-brand">
          <Image
            alt="Oasis Learning Centre"
            height={58}
            priority
            src="/oasis-logo.svg"
            width={148}
          />
        </div>
        <div className="page-header">
          <div>
            <p>Parent / carer link</p>
            <h1>Student link requests</h1>
            <p>Confirm or reject student account links sent to this Oasis Portal account.</p>
          </div>
        </div>
        <ParentLinkRequestsClient />
      </div>
    </main>
  );
}

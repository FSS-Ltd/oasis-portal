import Image from 'next/image';
import { getParentUser } from '@/components/admin/require-full-admin';
import '../(admin)/admin/admin.css';
import './registration.css';
import { RegistrationForm } from './registration-form';

export const dynamic = 'force-dynamic';

export default async function RegistrationPage() {
  await getParentUser();

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
            <p>Parent registration</p>
            <h1>Child registration</h1>
            <p>Complete the household and student records before entering the parent portal.</p>
          </div>
        </div>
        <RegistrationForm />
      </div>
    </main>
  );
}

import Image from 'next/image';
import '../(admin)/admin/admin.css';
import '../registration/registration.css';
import { StudentSelfRegistrationForm } from './student-self-registration-form';

export const dynamic = 'force-dynamic';

export default function StudentRegistrationPage() {
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
            <p>Student registration</p>
            <h1>Student access request</h1>
            <p>Use the code issued by the Learning Centre to request a student portal account.</p>
          </div>
        </div>
        <StudentSelfRegistrationForm />
      </div>
    </main>
  );
}

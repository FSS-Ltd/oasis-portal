import { MotionPage } from '@/components/admin/motion';
import { InviteUserForm } from './invite-user-form';

export default function StaffPage() {
  return (
    <MotionPage>
      <div className="page-header">
        <div>
          <h1>Staff and parents</h1>
          <p>Send Clerk invitations with the correct Oasis role and optional permission tags.</p>
        </div>
      </div>
      <InviteUserForm />
    </MotionPage>
  );
}

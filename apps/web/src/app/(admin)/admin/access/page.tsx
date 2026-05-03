import { UserCog } from 'lucide-react';
import { MotionPage } from '@/components/admin/motion';
import { getUserAccountAdminUser } from '@/components/admin/require-full-admin';
import { AccessManagementClient } from './access-management-client';

export default async function AccessManagementPage() {
  const user = await getUserAccountAdminUser();

  return (
    <MotionPage>
      <div className="page-header">
        <div>
          <p>Account access</p>
          <h1>User Access</h1>
          <p>Manage account shells, contact details, and onboarding invites.</p>
        </div>
        <span className="badge badge--blue">
          <UserCog aria-hidden="true" size={14} />
          Technical Support
        </span>
      </div>
      <AccessManagementClient canDeleteAccounts={user.role === 'Head'} currentUserId={user.id} />
    </MotionPage>
  );
}

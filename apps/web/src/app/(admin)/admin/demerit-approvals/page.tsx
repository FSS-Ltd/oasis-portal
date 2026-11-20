import { MotionPage } from '@/components/admin/motion';
import { assertFullAdmin } from '@/components/admin/require-full-admin';
import { DemeritApprovalsClient } from '@/components/behaviour/demerit-approvals-client';

export const metadata = {
  title: 'Demerit approvals · Oasis Learning Centre',
  robots: { index: false, follow: false },
};

export default async function DemeritApprovalsPage() {
  await assertFullAdmin();

  return (
    <MotionPage>
      <DemeritApprovalsClient />
    </MotionPage>
  );
}

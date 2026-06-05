import { notFound, redirect } from 'next/navigation';
import { canUseAdminOperations } from '@oasis/domain';
import { getAdminShellUser } from '@/components/admin/require-full-admin';

export default async function StaffAttendancePage() {
  const user = await getAdminShellUser();
  if (!canUseAdminOperations(user)) notFound();
  redirect('/admin/attendance?tab=staff');
}

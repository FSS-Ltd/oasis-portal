import { notFound, redirect } from 'next/navigation';
import { canExportAttendance } from '@oasis/domain';
import { getAdminShellUser } from '@/components/admin/require-full-admin';

export default async function AttendanceCenterPage() {
  const user = await getAdminShellUser();
  const canViewCenter = canExportAttendance(user);
  if (!canViewCenter) notFound();
  redirect('/admin/attendance?tab=center');
}

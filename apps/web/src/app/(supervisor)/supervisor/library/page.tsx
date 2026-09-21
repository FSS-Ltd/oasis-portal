import { notFound } from 'next/navigation';
import { canManageLibrary } from '@oasis/domain';
import { getStaffUser } from '@/components/admin/require-full-admin';
import { LibraryWorkflowClient } from '@/components/library/library-workflow-client';

export default async function SupervisorLibraryPage() {
  const user = await getStaffUser();
  if (!canManageLibrary(user)) notFound();
  return <LibraryWorkflowClient />;
}

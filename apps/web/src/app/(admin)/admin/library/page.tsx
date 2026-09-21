import { notFound } from 'next/navigation';
import { canManageLibrary } from '@oasis/domain';
import { getAdminShellUser } from '@/components/admin/require-full-admin';
import { LibraryWorkflowClient } from '@/components/library/library-workflow-client';

export default async function AdminLibraryPage() {
  const user = await getAdminShellUser();
  if (!canManageLibrary(user)) notFound();
  return <LibraryWorkflowClient />;
}

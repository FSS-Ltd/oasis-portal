import { getLinkedChildPortalUser } from '@/components/admin/require-full-admin';
import { ParentNotificationsClient } from '@/components/parent/parent-notifications-client';

export default async function ParentNotificationsPage() {
  await getLinkedChildPortalUser();

  return <ParentNotificationsClient />;
}

import { getLinkedChildPortalUser } from '@/components/admin/require-full-admin';
import { IncidentParentPortal } from '@/components/incidents/incident-parent-portal';

export default async function ParentIncidentsPage() {
  await getLinkedChildPortalUser();

  return <IncidentParentPortal />;
}

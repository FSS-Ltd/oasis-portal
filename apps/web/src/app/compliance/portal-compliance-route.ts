import type { SessionUser } from '@oasis/domain';

const portalRoutes = {
  admin: {
    'dbs-training': '/admin/compliance/dbs-training',
    medtab: '/admin/compliance/medtab',
  },
  supervisor: {
    'dbs-training': '/supervisor/compliance/dbs-training',
    medtab: '/supervisor/compliance/medtab',
  },
  'clubs-lead': {
    'dbs-training': '/clubs-lead/compliance/dbs-training',
    medtab: '/clubs-lead/compliance/medtab',
  },
} as const;

export function portalComplianceRoute(
  role: SessionUser['role'],
  page: 'dbs-training' | 'medtab' | 'incidents',
) {
  if (role === 'SafeguardingLead') return null;
  if (page === 'incidents') {
    return role === 'Supervisor' ? '/supervisor/incidents' : '/admin/incidents';
  }
  const portal =
    role === 'Supervisor' ? 'supervisor' : role === 'ClubsLead' ? 'clubs-lead' : 'admin';
  return portalRoutes[portal][page];
}

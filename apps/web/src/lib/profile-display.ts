import type { PermissionTag, Role } from '@oasis/domain';

export function roleLabel(role: Role): string {
  const labels: Record<Role, string> = {
    Head: 'Head of Centre',
    Principal: 'Principal',
    Pastor: 'Pastor',
    HeadOfDiscipline: 'Head of Discipline',
    TechnicalSupport: 'Technical Support',
    ClubsAdmin: 'Clubs Admin',
    ClubsLead: 'Clubs Lead',
    Supervisor: 'Supervisor',
    Parent: 'Parent',
    Student: 'Student',
  };
  return labels[role];
}

export function personTypeForRole(role: Role): 'parent' | 'student' | 'supervisor' {
  if (role === 'Parent') return 'parent';
  if (role === 'Student') return 'student';
  return 'supervisor';
}

export function personTypeLabel(type: 'parent' | 'student' | 'supervisor'): string {
  const labels = {
    parent: 'Parent',
    student: 'Student',
    supervisor: 'Supervisor',
  } as const;
  return labels[type];
}

export function permissionTagLabel(tag: string): string {
  const labels: Partial<Record<PermissionTag, string>> = {
    shopkeeper: 'Shopkeeper',
    shopadmin: 'Shop Admin',
    'finance-admin': 'Finance Admin',
    'leaderboard-admin': 'Leaderboard Admin',
    'attendance-exporter': 'Attendance Exporter',
    'attendance-recorder': 'Attendance Recorder',
    'audit-viewer': 'Audit Viewer',
    'sensitive-note-viewer': 'Sensitive Note Viewer',
    'behaviour-viewer': 'Behaviour Viewer',
    'student-drillthrough-viewer': 'Student Profile Viewer',
    'pace-full-access': 'Full PACE Access',
    'supervisor-all-students': 'Supervisor All Students',
    'supervisor-primary-students': 'Supervisor Primary Students',
    'calendar-manager': 'Calendar Manager',
    'parent-message-responder': 'Parent Message Responder',
    'club-lead': 'Club Lead',
  };
  return labels[tag as PermissionTag] ?? tag;
}

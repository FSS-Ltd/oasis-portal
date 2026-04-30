import { CalendarDays, ClipboardCheck, FileText, GraduationCap, Star } from 'lucide-react';
import { hasTag, isFullAdmin } from '@oasis/domain';
import { MotionPage } from '@/components/admin/motion';
import { getStaffUser } from '@/components/admin/require-full-admin';
import { SupervisorDashboardClient } from './supervisor-dashboard-client';

const quickActions = [
  {
    href: '/supervisor/attendance',
    label: 'Attendance',
    description: 'Mark the daily register',
    icon: ClipboardCheck,
  },
  {
    href: '/supervisor/behaviour',
    label: 'Behaviour',
    description: 'Log merits and demerits',
    icon: Star,
  },
  {
    href: '/supervisor/pace',
    label: 'PACE',
    description: 'Record tests and progress',
    icon: GraduationCap,
  },
  {
    href: '/supervisor/rota',
    label: 'Rota',
    description: 'Your shifts and availability',
    icon: CalendarDays,
  },
  {
    href: '/supervisor/snapshot',
    label: 'Snapshot',
    description: 'Review a child log',
    icon: FileText,
  },
] as const;

export default async function SupervisorPage() {
  const user = await getStaffUser();
  const canExportAttendance = isFullAdmin(user) || hasTag(user, 'attendance-exporter');

  return (
    <MotionPage>
      <div className="page-header">
        <div>
          <p>Supervisor workspace</p>
          <h1>Daily dashboard</h1>
          <p>Check today&apos;s position quickly, then open the focused workflow you need.</p>
        </div>
      </div>

      <section aria-label="Supervisor quick actions" className="dashboard-grid supervisor-action-grid">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <a className="panel panel__body supervisor-action" href={action.href} key={action.label}>
              <Icon aria-hidden="true" size={20} />
              <span>
                <strong>{action.label}</strong>
                <small>{action.description}</small>
              </span>
            </a>
          );
        })}
      </section>

      <SupervisorDashboardClient canExportAttendance={canExportAttendance} view="dashboard" />
    </MotionPage>
  );
}

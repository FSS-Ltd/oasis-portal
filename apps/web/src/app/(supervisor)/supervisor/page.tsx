import { CalendarDays, ClipboardCheck, GraduationCap, Star } from 'lucide-react';
import { MotionPage } from '@/components/admin/motion';
import { SupervisorDashboardClient } from './supervisor-dashboard-client';

const quickActions = [
  {
    href: '#attendance-preview',
    label: 'Attendance',
    description: "Today's active roster",
    icon: ClipboardCheck,
  },
  {
    href: '#attendance-preview',
    label: 'Behaviour',
    description: 'Entry opens in PR-2.11',
    icon: Star,
  },
  {
    href: '#attendance-preview',
    label: 'PACE',
    description: 'Entry opens in PR-2.11',
    icon: GraduationCap,
  },
  {
    href: '#rota',
    label: 'Rota',
    description: 'Your shifts and availability',
    icon: CalendarDays,
  },
] as const;

export default function SupervisorPage() {
  return (
    <MotionPage>
      <div className="page-header">
        <div>
          <p>Supervisor workspace</p>
          <h1>Daily dashboard</h1>
          <p>See today&apos;s students, your rota, weekly availability, and shift-swap options from one staff view.</p>
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

      <SupervisorDashboardClient />
    </MotionPage>
  );
}

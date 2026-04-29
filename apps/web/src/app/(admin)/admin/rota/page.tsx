import { CalendarDays, UsersRound } from 'lucide-react';
import { MotionPage } from '@/components/admin/motion';
import { RotaSchedulerClient } from './rota-scheduler-client';

export default function RotaPage() {
  return (
    <MotionPage>
      <div className="page-header">
        <div>
          <p>Staff scheduling</p>
          <h1>Rota</h1>
          <p>Schedule staff by week, compare availability, and review shift swap requests.</p>
        </div>
        <div className="page-header__actions">
          <span className="badge badge--blue">
            <CalendarDays aria-hidden="true" size={14} />
            Weekly view
          </span>
          <span className="badge badge--blue">
            <UsersRound aria-hidden="true" size={14} />
            Head only
          </span>
        </div>
      </div>
      <RotaSchedulerClient />
    </MotionPage>
  );
}

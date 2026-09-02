import { CalendarDays, UsersRound } from 'lucide-react';
import { MotionPage } from '@/components/admin/motion';
import { getAdminOperationsUser } from '@/components/admin/require-full-admin';
import { RotaSchedulerClient } from './rota-scheduler-client';

export default async function RotaPage() {
  await getAdminOperationsUser();

  return (
    <MotionPage>
      <div className="page-header">
        <div>
          <p>Supervisor scheduling</p>
          <h1>Rota</h1>
          <p>
            Plan each week, create shifts, review team availability, and handle swap requests from
            one focused workspace.
          </p>
        </div>
        <div className="page-header__actions">
          <span className="badge badge--blue">
            <CalendarDays aria-hidden="true" size={14} />
            Weekly view
          </span>
          <span className="badge badge--blue">
            <UsersRound aria-hidden="true" size={14} />
            Admin operations
          </span>
        </div>
      </div>
      <RotaSchedulerClient />
    </MotionPage>
  );
}

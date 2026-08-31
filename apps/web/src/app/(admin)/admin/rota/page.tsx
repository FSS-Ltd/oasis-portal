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
            Schedule supervisors by week, compare weekly availability and monthly unavailability,
            and review shift swap requests.
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

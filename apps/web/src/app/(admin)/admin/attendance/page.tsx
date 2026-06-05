import { notFound } from 'next/navigation';
import {
  canExportAttendance,
  canRecordStudentAttendance,
  canUseAdminOperations,
  isStaff,
} from '@oasis/domain';
import { MotionPage } from '@/components/admin/motion';
import { getAdminShellUser } from '@/components/admin/require-full-admin';
import { AttendanceTabs } from './attendance-tabs';

export default async function AttendancePage() {
  const user = await getAdminShellUser();
  const canExport = canExportAttendance(user);
  const canReadRegister = isStaff(user);
  const canRecord = canRecordStudentAttendance(user);
  const canUseStaffRegister = canUseAdminOperations(user);
  if (!canReadRegister && !canExport) notFound();

  return (
    <MotionPage>
      <div className="page-header">
        <div>
          <p>Daily register</p>
          <h1>Student attendance</h1>
          <p>Record registers, reset selected dates, and review attendance trends.</p>
        </div>
      </div>
      <AttendanceTabs
        canReadStudentRegister={canReadRegister}
        canRecordStudentAttendance={canRecord}
        canUseStaffRegister={canUseStaffRegister}
        canViewCenter={canExport}
      />
    </MotionPage>
  );
}

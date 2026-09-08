import { BookOpen } from 'lucide-react';
import { MotionPage } from '@/components/admin/motion';
import { assertFullAdmin } from '@/components/admin/require-full-admin';
import { AcademicSettingsClient } from './academic-settings-client';

export default async function AcademicSettingsPage() {
  await assertFullAdmin();

  return (
    <MotionPage>
      <div className="page-header">
        <div>
          <p>Academic setup</p>
          <h1>Academic settings</h1>
          <p>
            Configure student age bands, centre groups, subjects, and PACE test rules used across
            the portal.
          </p>
        </div>
        <span className="badge badge--blue">
          <BookOpen aria-hidden="true" size={14} />
          Head only
        </span>
      </div>
      <AcademicSettingsClient />
    </MotionPage>
  );
}

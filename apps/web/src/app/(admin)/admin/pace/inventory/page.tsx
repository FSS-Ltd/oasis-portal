import { PackageCheck } from 'lucide-react';
import { MotionPage } from '@/components/admin/motion';
import { getAcademicInventoryHeadUser } from '@/components/admin/require-full-admin';
import { PaceInventoryClient } from '@/components/pace/pace-inventory-client';

export default async function PaceInventoryPage() {
  await getAcademicInventoryHeadUser();

  return (
    <MotionPage>
      <div className="page-header">
        <div>
          <p>PACE ordering and diagnostics</p>
          <h1>PACE Inventory</h1>
          <p>
            Track each student’s PACE orders, mark delivery progress, and record diagnostic
            references.
          </p>
        </div>
        <span className="badge badge--blue">
          <PackageCheck aria-hidden="true" size={14} />
          Head only
        </span>
      </div>
      <PaceInventoryClient />
    </MotionPage>
  );
}

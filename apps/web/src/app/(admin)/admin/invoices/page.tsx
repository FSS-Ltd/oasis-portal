import { MotionPage } from '@/components/admin/motion';
import { getInvoiceManagerUser } from '@/components/admin/require-full-admin';
import { AdminInvoicesClient } from '@/components/invoices/admin-invoices-client';

export default async function AdminInvoicesPage() {
  await getInvoiceManagerUser();

  return (
    <MotionPage>
      <AdminInvoicesClient />
    </MotionPage>
  );
}

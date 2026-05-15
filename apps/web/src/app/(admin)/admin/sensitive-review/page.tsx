import { MotionPage } from '@/components/admin/motion';
import { assertFullAdmin } from '@/components/admin/require-full-admin';
import { SensitiveReviewClient } from '@/components/child-log/sensitive-review-client';

export default async function SensitiveReviewPage() {
  await assertFullAdmin();

  return (
    <MotionPage>
      <SensitiveReviewClient />
    </MotionPage>
  );
}

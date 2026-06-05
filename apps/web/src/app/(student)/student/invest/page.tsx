import { notFound } from 'next/navigation';
import { StudentInvestClient } from '@/components/student/invest/student-invest-client';
import { canUseStudentInvestPrototype } from '@/lib/student-invest-feature';

export default function StudentInvestPage() {
  if (!canUseStudentInvestPrototype()) notFound();

  return <StudentInvestClient />;
}

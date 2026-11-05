'use client';

import { displaySchoolYearLabel } from '@oasis/domain';

export function LibraryBorrowerForm({
  borrowers,
  dueOn,
  onCheckout,
  onDueOn,
  onDueInDays,
  onStudentId,
  pending,
  studentId,
}: {
  borrowers: Array<{ id: string; name: string; yearGroup: string; hasReminderRecipient: boolean }>;
  dueOn: string;
  onCheckout: () => void;
  onDueOn: (value: string) => void;
  onDueInDays: (days: number) => void;
  onStudentId: (value: string) => void;
  pending: boolean;
  studentId: string;
}) {
  return (
    <div className="library-borrower-form">
      <label className="field">
        <span className="field__label">Student</span>
        <select
          onChange={(event) => {
            onStudentId(event.target.value);
          }}
          value={studentId}
        >
          <option value="">Choose a student</option>
          {borrowers.map((student) => (
            <option key={student.id} value={student.id}>
              {student.name} · {displaySchoolYearLabel(student.yearGroup)}
              {student.hasReminderRecipient ? '' : ' · no guardian email'}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="field__label">Due date</span>
        <input
          onChange={(event) => {
            onDueOn(event.target.value);
          }}
          type="date"
          value={dueOn}
        />
      </label>
      <div className="library-loan-periods">
        {[7, 14, 21, 28].map((days) => (
          <button
            className="button button--secondary button--sm"
            key={days}
            onClick={() => {
              onDueInDays(days);
            }}
            type="button"
          >
            {days} days
          </button>
        ))}
      </div>
      <button
        className="button button--primary button--md"
        disabled={!studentId || pending}
        onClick={onCheckout}
        type="button"
      >
        {pending ? 'Checking out…' : 'Check out'}
      </button>
    </div>
  );
}

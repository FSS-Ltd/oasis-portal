'use client';

import { BookOpenCheck, CheckCircle2, Clock3 } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { friendlyErrorMessage } from '@/lib/notifications';
import { api, type RouterOutputs } from '@/lib/trpc';
import {
  formatScore,
  formatShortDate,
  scoreTone,
  statusTone,
} from '@/components/pace/pace-workflow-utils';

type StudentPace = RouterOutputs['pace']['forStudent'];
type PaceSubject = StudentPace['subjects'][number];

function currentPacePercent(subject: PaceSubject): number {
  if (subject.completedPaces.some((pace) => pace.paceNumber === subject.currentPaceNumber)) {
    return 100;
  }
  if (subject.latestFinalTest) return 72;
  if (subject.latestSelfTest) return 42;
  return subject.currentPaceStartedAt ? 18 : 8;
}

function currentPaceLabel(subject: PaceSubject): string {
  if (subject.latestFinalTest?.passed) return 'PACE test passed';
  if (subject.latestFinalTest) return 'PACE test recorded';
  if (subject.latestSelfTest) return 'Self-Test recorded';
  if (subject.currentPaceStartedAt) return 'PACE started';
  return 'Awaiting first score';
}

function PaceStatusSummary({ subject }: { subject: PaceSubject }) {
  return (
    <div className="student-pace-status">
      <Badge tone={statusTone(subject.status.tone)}>{subject.status.status}</Badge>
      {subject.status.testingLevelLabel ? <small>{subject.status.testingLevelLabel}</small> : null}
    </div>
  );
}

function SubjectProgressCard({
  paceStatusVisible,
  subject,
}: {
  paceStatusVisible: boolean;
  subject: PaceSubject;
}) {
  const percent = currentPacePercent(subject);
  const latestScore = subject.latestFinalTest ?? subject.latestSelfTest;

  return (
    <article className="student-pace-card">
      <div className="student-pace-card__head">
        <div>
          <p>{subject.code}</p>
          <h2>{subject.name}</h2>
        </div>
        {paceStatusVisible ? <PaceStatusSummary subject={subject} /> : null}
      </div>

      <div className="student-pace-current">
        <span>
          <small>Current PACE</small>
          <strong>{String(subject.currentPaceNumber)}</strong>
        </span>
        <span>
          <small>Latest score</small>
          <strong
            className={`student-pace-score student-pace-score--${scoreTone(latestScore?.score)}`}
          >
            {formatScore(latestScore?.score)}
          </strong>
        </span>
      </div>

      <div className="student-pace-progress" aria-label={`${subject.name} current PACE progress`}>
        <div style={{ width: `${String(percent)}%` }} />
      </div>
      <div className="student-pace-progress__meta">
        <span>{currentPaceLabel(subject)}</span>
        <span>{formatShortDate(subject.currentPaceStartedAt)}</span>
      </div>

      <div className="student-pace-milestones">
        <div className="student-pace-milestones__title">
          <CheckCircle2 aria-hidden="true" size={15} />
          <strong>{String(subject.completedPaceCount)} completed</strong>
        </div>
        {subject.completedPaces.length === 0 ? (
          <p>No completed PACEs recorded for this subject yet.</p>
        ) : (
          subject.completedPaces.map((pace) => (
            <span className="student-pace-milestone" key={pace.id}>
              <BookOpenCheck aria-hidden="true" size={15} />
              <strong>PACE {String(pace.paceNumber)}</strong>
              <small>{formatShortDate(pace.completedAt)}</small>
            </span>
          ))
        )}
      </div>
    </article>
  );
}

export function StudentPaceClient() {
  const wallet = api.student.wallet.useQuery(undefined, { retry: false });
  const studentId = wallet.data?.studentId ?? '';
  const pace = api.pace.forStudent.useQuery(
    { studentId },
    { enabled: studentId.length > 0, retry: false },
  );

  if (wallet.isLoading || pace.isLoading) {
    return <div className="student-inline-state">Loading PACE progress...</div>;
  }

  if (wallet.error || pace.error) {
    return (
      <EmptyState
        detail={friendlyErrorMessage(wallet.error ?? pace.error)}
        title="PACE progress unavailable"
      />
    );
  }

  if (!pace.data) {
    return <EmptyState detail="No PACE progress was returned." title="No PACE progress" />;
  }

  return (
    <div className="student-page student-pace-page">
      <section className="student-wallet-hero student-pace-hero">
        <div>
          <p>Academic Progress</p>
          <h1>PACE Progress</h1>
          <span>
            {pace.data.studentName} · {pace.data.yearGroupLabel}
          </span>
        </div>
        <div className="student-pace-hero__meta">
          <Clock3 aria-hidden="true" size={18} />
          <small>Today</small>
          <strong>{formatShortDate(new Date(`${pace.data.today.date}T00:00:00.000Z`))}</strong>
        </div>
      </section>

      {pace.data.subjects.length === 0 ? (
        <EmptyState
          detail="No subjects are assigned to your student account yet."
          title="No PACE subjects"
        />
      ) : (
        <section className="student-pace-grid" aria-label="Subject PACE progress">
          {pace.data.subjects.map((subject) => (
            <SubjectProgressCard
              key={subject.subjectId}
              paceStatusVisible={pace.data.paceStatusVisible}
              subject={subject}
            />
          ))}
        </section>
      )}
    </div>
  );
}

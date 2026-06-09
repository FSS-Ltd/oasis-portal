'use client';

import { ClipboardCheck, Image, Medal, UploadCloud } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import {
  HomeworkImageUpload,
  type HomeworkImagePayload,
} from '@/components/homework/homework-image-upload';
import { friendlyErrorMessage, showErrorToast, showSuccessToast } from '@/lib/notifications';
import { api, type RouterOutputs } from '@/lib/trpc';

type StudentHomework = RouterOutputs['homework']['studentDue'][number];
type HomeworkImage = StudentHomework['images'][number];

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

function formatDate(value: Date): string {
  return dateFormatter.format(value);
}

function isOverdue(value: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(value);
  dueDate.setHours(0, 0, 0, 0);
  return dueDate < today;
}

function imageHref(image: HomeworkImage): string {
  return `/api/homework/images/${image.id}`;
}

function HomeworkImages({ images }: { images: readonly HomeworkImage[] }) {
  if (images.length === 0) return null;

  return (
    <div className="homework-image-links" aria-label="Submitted homework images">
      {images.map((image) => (
        <a href={imageHref(image)} key={image.id} rel="noreferrer" target="_blank">
          <Image aria-hidden="true" size={15} />
          <span>{image.fileName}</span>
        </a>
      ))}
    </div>
  );
}

function AssignmentCard({
  assignment,
  onUpload,
  uploadingAssignmentId,
}: {
  assignment: StudentHomework;
  onUpload: (assignment: StudentHomework, image: HomeworkImagePayload) => void;
  uploadingAssignmentId: string | null;
}) {
  const overdue = isOverdue(assignment.dueDate);

  return (
    <article className="student-homework-card">
      <div className="student-homework-card__head">
        <div>
          <p>{assignment.submissionMethod === 'UploadImage' ? 'Upload image' : 'Hand in person'}</p>
          <h2>{assignment.title}</h2>
        </div>
        <span className={overdue ? 'homework-badge homework-badge--danger' : 'homework-badge'}>
          {overdue ? 'Overdue' : `Due ${formatDate(assignment.dueDate)}`}
        </span>
      </div>
      <p className="student-homework-card__description">{assignment.description}</p>
      <HomeworkImages images={assignment.images} />
      {assignment.submittedAt ? (
        <p className="student-homework-card__meta">
          Submitted {formatDate(assignment.submittedAt)}
        </p>
      ) : null}
      {assignment.submissionMethod === 'UploadImage' ? (
        <HomeworkImageUpload
          assignmentId={assignment.id}
          disabled={uploadingAssignmentId === assignment.id}
          label={assignment.submittedAt ? 'Upload another image' : 'Upload image'}
          onError={(message) => {
            showErrorToast(new Error(message));
          }}
          onUploaded={(image) => {
            onUpload(assignment, image);
          }}
        />
      ) : (
        <div className="student-homework-card__in-person">
          <ClipboardCheck aria-hidden="true" size={16} />
          <span>Hand this homework to your Head or supervisor.</span>
        </div>
      )}
    </article>
  );
}

function GradedCard({ assignment }: { assignment: StudentHomework }) {
  return (
    <article className="student-homework-card student-homework-card--graded">
      <div className="student-homework-card__head">
        <div>
          <p>Graded homework</p>
          <h2>{assignment.title}</h2>
        </div>
        <span className="homework-score">{String(assignment.scorePercent ?? 0)}%</span>
      </div>
      <p className="student-homework-card__description">{assignment.description}</p>
      <div className="student-homework-card__result">
        <span>
          <Medal aria-hidden="true" size={15} />
          {assignment.meritAmount > 0
            ? `${String(assignment.meritAmount)} merits awarded`
            : 'No merits awarded'}
        </span>
        {assignment.reviewedAt ? <span>Reviewed {formatDate(assignment.reviewedAt)}</span> : null}
      </div>
      {assignment.comments ? <blockquote>{assignment.comments}</blockquote> : null}
      <HomeworkImages images={assignment.images} />
    </article>
  );
}

export function StudentHomeworkClient() {
  const utils = api.useUtils();
  const due = api.homework.studentDue.useQuery(undefined, { retry: false });
  const graded = api.homework.studentGraded.useQuery(undefined, { retry: false });
  const submitUpload = api.homework.submitUpload.useMutation({
    async onSuccess() {
      showSuccessToast('Homework uploaded.');
      await Promise.all([
        utils.homework.studentDue.invalidate(),
        utils.homework.studentGraded.invalidate(),
      ]);
    },
    onError(error) {
      showErrorToast(error, 'Homework could not be uploaded.');
    },
  });

  function handleUpload(assignment: StudentHomework, image: HomeworkImagePayload): void {
    submitUpload.mutate({ assignmentId: assignment.id, image });
  }

  const loading = due.isLoading || graded.isLoading;
  const error = due.error ?? graded.error;

  if (loading) return <div className="student-inline-state">Loading homework...</div>;

  if (error) {
    return <EmptyState detail={friendlyErrorMessage(error)} title="Homework unavailable" />;
  }

  return (
    <div className="student-page student-homework-page">
      <section className="student-wallet-hero student-homework-hero">
        <div>
          <p>Homework</p>
          <h1>Assigned work</h1>
          <span>Due homework and marked submissions.</span>
        </div>
        <div className="student-homework-hero__meta">
          <UploadCloud aria-hidden="true" size={18} />
          <small>Due</small>
          <strong>{String(due.data?.length ?? 0)}</strong>
        </div>
      </section>

      <section className="student-homework-section" aria-labelledby="student-homework-due-title">
        <div className="student-dashboard-panel__head">
          <div>
            <p>Current assignments</p>
            <h2 id="student-homework-due-title">Due homework</h2>
          </div>
        </div>
        {due.data && due.data.length > 0 ? (
          <div className="student-homework-list">
            {due.data.map((assignment) => (
              <AssignmentCard
                assignment={assignment}
                key={assignment.id}
                onUpload={handleUpload}
                uploadingAssignmentId={
                  submitUpload.isPending ? submitUpload.variables.assignmentId : null
                }
              />
            ))}
          </div>
        ) : (
          <EmptyState detail="Assigned homework will appear here." title="No due homework" />
        )}
      </section>

      <section className="student-homework-section" aria-labelledby="student-homework-graded-title">
        <div className="student-dashboard-panel__head">
          <div>
            <p>Completed work</p>
            <h2 id="student-homework-graded-title">Graded homework</h2>
          </div>
        </div>
        {graded.data && graded.data.length > 0 ? (
          <div className="student-homework-list">
            {graded.data.map((assignment) => (
              <GradedCard assignment={assignment} key={assignment.id} />
            ))}
          </div>
        ) : (
          <EmptyState detail="Reviewed homework will appear here." title="No graded homework" />
        )}
      </section>
    </div>
  );
}

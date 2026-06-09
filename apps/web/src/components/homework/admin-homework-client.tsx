'use client';

import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { ClipboardList, Eye, Image, ListChecks, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Field, SelectInput, TextInput } from '@/components/ui/field';
import {
  HomeworkImageUpload,
  type HomeworkImagePayload,
} from '@/components/homework/homework-image-upload';
import { friendlyErrorMessage, showErrorToast, showSuccessToast } from '@/lib/notifications';
import { api, type RouterOutputs } from '@/lib/trpc';

type AdminAssignment = RouterOutputs['homework']['adminAssignments'][number];
type AdminHomeworkImage = AdminAssignment['images'][number];
type ReviewRow = RouterOutputs['homework']['reviewQueue'][number];
type YearGroupBand = RouterOutputs['admin']['listYearGroupBands'][number];
type AssignmentForm = {
  allYearGroupBands: boolean;
  description: string;
  dueDate: string;
  submissionMethod: 'UploadImage' | 'InPerson';
  title: string;
  yearGroupBandIds: string[];
};

const defaultAssignmentForm: AssignmentForm = {
  allYearGroupBands: true,
  description: '',
  dueDate: '',
  submissionMethod: 'UploadImage',
  title: '',
  yearGroupBandIds: [] as string[],
};

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

function defaultDueDateValue(): string {
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 7);
  dueDate.setHours(0, 0, 0, 0);
  const offsetMs = dueDate.getTimezoneOffset() * 60 * 1000;
  return new Date(dueDate.getTime() - offsetMs).toISOString().slice(0, 10);
}

function formatDate(value: Date): string {
  return dateFormatter.format(value);
}

function assignmentAudience(assignment: AdminAssignment): string {
  if (assignment.allYearGroupBands) return 'All age bands';
  return assignment.bands.map((band) => band.name).join(', ');
}

function statusClass(status: ReviewRow['reviewStatus']): string {
  if (status === 'Reviewed') return 'homework-badge homework-badge--success';
  if (status === 'Submitted') return 'homework-badge';
  return 'homework-badge homework-badge--muted';
}

function HomeworkImageLinks({ images }: { images: readonly AdminHomeworkImage[] }) {
  if (images.length === 0) return null;

  return (
    <div className="homework-image-links" aria-label="Homework images">
      {images.map((image) => (
        <a
          href={`/api/homework/images/${image.id}`}
          key={image.id}
          rel="noreferrer"
          target="_blank"
        >
          <Eye aria-hidden="true" size={15} />
          <span>{image.fileName}</span>
        </a>
      ))}
    </div>
  );
}

function BandCheckboxes({
  bands,
  disabled,
  selectedIds,
  onChange,
}: {
  bands: readonly YearGroupBand[];
  disabled: boolean;
  onChange: (ids: string[]) => void;
  selectedIds: readonly string[];
}) {
  return (
    <div className="homework-band-grid">
      {bands.map((band) => {
        const checked = selectedIds.includes(band.id);
        return (
          <label className="homework-band-option" key={band.id}>
            <input
              checked={checked}
              disabled={disabled}
              onChange={(event) => {
                onChange(
                  event.target.checked
                    ? [...selectedIds, band.id]
                    : selectedIds.filter((id) => id !== band.id),
                );
              }}
              type="checkbox"
            />
            <span>{band.name}</span>
          </label>
        );
      })}
    </div>
  );
}

export function AdminHomeworkClient() {
  const utils = api.useUtils();
  const bandsQuery = api.admin.listYearGroupBands.useQuery(undefined, { retry: false });
  const assignmentsQuery = api.homework.adminAssignments.useQuery(undefined, { retry: false });
  const reviewQueueQuery = api.homework.reviewQueue.useQuery(undefined, { retry: false });
  const [assignmentForm, setAssignmentForm] = useState<AssignmentForm>({
    ...defaultAssignmentForm,
    dueDate: defaultDueDateValue(),
  });
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>('all');
  const [selectedReviewKey, setSelectedReviewKey] = useState<string | null>(null);
  const [reviewForm, setReviewForm] = useState({
    comments: '',
    meritAmount: '0',
    scorePercent: '',
  });
  const [reviewImage, setReviewImage] = useState<HomeworkImagePayload | null>(null);

  const createAssignment = api.homework.createAssignment.useMutation({
    async onSuccess() {
      showSuccessToast('Homework assignment created.');
      setAssignmentForm({ ...defaultAssignmentForm, dueDate: defaultDueDateValue() });
      await Promise.all([
        utils.homework.adminAssignments.invalidate(),
        utils.homework.reviewQueue.invalidate(),
      ]);
    },
    onError(error) {
      showErrorToast(error, 'Homework assignment could not be created.');
    },
  });

  const reviewSubmission = api.homework.reviewSubmission.useMutation({
    async onSuccess() {
      showSuccessToast('Homework review saved.');
      setReviewImage(null);
      await Promise.all([
        utils.homework.adminAssignments.invalidate(),
        utils.homework.reviewQueue.invalidate(),
      ]);
    },
    onError(error) {
      showErrorToast(error, 'Homework review could not be saved.');
    },
  });

  const reviewRows = useMemo(() => reviewQueueQuery.data ?? [], [reviewQueueQuery.data]);
  const filteredReviewRows = useMemo(
    () =>
      selectedAssignmentId === 'all'
        ? reviewRows
        : reviewRows.filter((row) => row.assignmentId === selectedAssignmentId),
    [reviewRows, selectedAssignmentId],
  );
  const selectedReview =
    filteredReviewRows.find(
      (row) => `${row.assignmentId}:${row.student.id}` === selectedReviewKey,
    ) ??
    filteredReviewRows[0] ??
    null;

  useEffect(() => {
    if (!selectedReview) return;
    setSelectedReviewKey(`${selectedReview.assignmentId}:${selectedReview.student.id}`);
    setReviewForm({
      comments: selectedReview.assignment.comments ?? '',
      meritAmount: String(selectedReview.meritAmount),
      scorePercent: selectedReview.scorePercent === null ? '' : String(selectedReview.scorePercent),
    });
    setReviewImage(null);
  }, [selectedReview]);

  function submitAssignment(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    createAssignment.mutate({
      allYearGroupBands: assignmentForm.allYearGroupBands,
      description: assignmentForm.description,
      dueDate: new Date(`${assignmentForm.dueDate}T00:00:00`),
      submissionMethod: assignmentForm.submissionMethod,
      title: assignmentForm.title,
      yearGroupBandIds: assignmentForm.allYearGroupBands ? [] : assignmentForm.yearGroupBandIds,
    });
  }

  function submitReview(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!selectedReview) return;
    reviewSubmission.mutate({
      assignmentId: selectedReview.assignmentId,
      comments: reviewForm.comments.trim() || undefined,
      image: reviewImage ?? undefined,
      meritAmount: reviewForm.meritAmount.trim() ? Number.parseInt(reviewForm.meritAmount, 10) : 0,
      scorePercent: Number.parseInt(reviewForm.scorePercent, 10),
      studentId: selectedReview.student.id,
    });
  }

  const assignments = assignmentsQuery.data ?? [];
  const bands = bandsQuery.data ?? [];
  const loading = bandsQuery.isLoading || assignmentsQuery.isLoading || reviewQueueQuery.isLoading;
  const error = bandsQuery.error ?? assignmentsQuery.error ?? reviewQueueQuery.error;

  return (
    <div className="homework-admin-page">
      <section className="dashboard-hero">
        <p>Student portal</p>
        <h1>Homework</h1>
        <span>Create assignments, review submissions, and award homework merits.</span>
      </section>

      {error ? (
        <EmptyState detail={friendlyErrorMessage(error)} title="Homework unavailable" />
      ) : null}
      {loading ? <div className="empty-state">Loading homework...</div> : null}

      <div className="homework-admin-layout">
        <section
          className="panel panel__body homework-admin-form"
          aria-labelledby="homework-create-title"
        >
          <div className="panel__header">
            <div>
              <p className="eyebrow">Assignments</p>
              <h2 id="homework-create-title">Create homework</h2>
            </div>
            <ClipboardList aria-hidden="true" size={20} />
          </div>
          <form onSubmit={submitAssignment}>
            <Field label="Title" required>
              <TextInput
                maxLength={160}
                onChange={(event) => {
                  setAssignmentForm((current) => ({ ...current, title: event.target.value }));
                }}
                required
                value={assignmentForm.title}
              />
            </Field>
            <Field label="Due date" required>
              <TextInput
                onChange={(event) => {
                  setAssignmentForm((current) => ({ ...current, dueDate: event.target.value }));
                }}
                required
                type="date"
                value={assignmentForm.dueDate}
              />
            </Field>
            <Field label="Submission method" required>
              <SelectInput
                onChange={(event) => {
                  setAssignmentForm((current) => ({
                    ...current,
                    submissionMethod: event.target.value as 'UploadImage' | 'InPerson',
                  }));
                }}
                value={assignmentForm.submissionMethod}
              >
                <option value="UploadImage">Upload image</option>
                <option value="InPerson">Hand in person</option>
              </SelectInput>
            </Field>
            <Field label="Description" required>
              <textarea
                className="input homework-admin-textarea"
                maxLength={5000}
                onChange={(event) => {
                  setAssignmentForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }));
                }}
                required
                rows={5}
                value={assignmentForm.description}
              />
            </Field>
            <label className="homework-toggle">
              <input
                checked={assignmentForm.allYearGroupBands}
                onChange={(event) => {
                  setAssignmentForm((current) => ({
                    ...current,
                    allYearGroupBands: event.target.checked,
                  }));
                }}
                type="checkbox"
              />
              <span>Assign to all age bands</span>
            </label>
            {!assignmentForm.allYearGroupBands ? (
              <BandCheckboxes
                bands={bands}
                disabled={createAssignment.isPending}
                onChange={(yearGroupBandIds) => {
                  setAssignmentForm((current) => ({ ...current, yearGroupBandIds }));
                }}
                selectedIds={assignmentForm.yearGroupBandIds}
              />
            ) : null}
            <Button pending={createAssignment.isPending} type="submit">
              Create homework
            </Button>
          </form>
        </section>

        <section
          className="panel panel__body homework-admin-list"
          aria-labelledby="homework-list-title"
        >
          <div className="panel__header">
            <div>
              <p className="eyebrow">Current work</p>
              <h2 id="homework-list-title">Assignments</h2>
            </div>
            <ListChecks aria-hidden="true" size={20} />
          </div>
          {assignments.length > 0 ? (
            <div className="homework-admin-assignment-list">
              {assignments.map((assignment) => (
                <article className="homework-admin-assignment" key={assignment.id}>
                  <div>
                    <h3>{assignment.title}</h3>
                    <p>{assignmentAudience(assignment)}</p>
                  </div>
                  <span>{formatDate(assignment.dueDate)}</span>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              detail="Created homework assignments will appear here."
              title="No homework"
            />
          )}
        </section>
      </div>

      <section
        className="panel panel__body homework-admin-review"
        aria-labelledby="homework-review-title"
      >
        <div className="panel__header">
          <div>
            <p className="eyebrow">Review</p>
            <h2 id="homework-review-title">Submission queue</h2>
          </div>
          <Save aria-hidden="true" size={20} />
        </div>
        <div className="homework-review-toolbar">
          <Field label="Filter assignment">
            <SelectInput
              onChange={(event) => {
                setSelectedAssignmentId(event.target.value);
                setSelectedReviewKey(null);
              }}
              value={selectedAssignmentId}
            >
              <option value="all">All assignments</option>
              {assignments.map((assignment) => (
                <option key={assignment.id} value={assignment.id}>
                  {assignment.title}
                </option>
              ))}
            </SelectInput>
          </Field>
        </div>

        <div className="homework-review-layout">
          <div className="homework-review-list" role="list">
            {filteredReviewRows.length > 0 ? (
              filteredReviewRows.map((row) => {
                const reviewKey = `${row.assignmentId}:${row.student.id}`;
                return (
                  <button
                    className={
                      reviewKey === selectedReviewKey
                        ? 'homework-review-row is-selected'
                        : 'homework-review-row'
                    }
                    key={reviewKey}
                    onClick={() => {
                      setSelectedReviewKey(reviewKey);
                    }}
                    type="button"
                  >
                    <span>
                      <strong>{row.student.fullName}</strong>
                      <small>
                        {row.student.yearGroup} · {row.assignment.title}
                      </small>
                    </span>
                    <b className={statusClass(row.reviewStatus)}>{row.reviewStatus}</b>
                  </button>
                );
              })
            ) : (
              <EmptyState
                detail="Students assigned homework will appear here."
                title="No reviews"
              />
            )}
          </div>

          <form className="homework-review-detail" onSubmit={submitReview}>
            {selectedReview ? (
              <>
                <div className="homework-review-detail__title">
                  <div>
                    <p>{selectedReview.student.fullName}</p>
                    <h3>{selectedReview.assignment.title}</h3>
                    <span>
                      {selectedReview.assignment.submissionMethod === 'UploadImage'
                        ? 'Student upload'
                        : 'Handed in person'}{' '}
                      · Due {formatDate(selectedReview.assignment.dueDate)}
                    </span>
                  </div>
                  <b className={statusClass(selectedReview.reviewStatus)}>
                    {selectedReview.reviewStatus}
                  </b>
                </div>
                <p className="homework-review-detail__description">
                  {selectedReview.assignment.description}
                </p>
                <HomeworkImageLinks images={selectedReview.assignment.images} />
                {selectedReview.assignment.submissionMethod === 'InPerson' ? (
                  <div className="homework-review-upload">
                    <HomeworkImageUpload
                      assignmentId={selectedReview.assignmentId}
                      disabled={reviewSubmission.isPending}
                      label={reviewImage ? 'Replace image' : 'Upload handed-in image'}
                      onError={(message) => {
                        showErrorToast(new Error(message));
                      }}
                      onUploaded={(image) => {
                        setReviewImage(image);
                      }}
                      studentId={selectedReview.student.id}
                    />
                    {reviewImage ? (
                      <span>
                        <Image aria-hidden="true" size={15} />
                        {reviewImage.fileName}
                      </span>
                    ) : null}
                  </div>
                ) : null}
                <div className="homework-review-fields">
                  <Field label="Score" required>
                    <TextInput
                      max="100"
                      min="0"
                      onChange={(event) => {
                        setReviewForm((current) => ({
                          ...current,
                          scorePercent: event.target.value,
                        }));
                      }}
                      required
                      type="number"
                      value={reviewForm.scorePercent}
                    />
                  </Field>
                  <Field label="Merits">
                    <TextInput
                      max="500"
                      min="0"
                      onChange={(event) => {
                        setReviewForm((current) => ({
                          ...current,
                          meritAmount: event.target.value,
                        }));
                      }}
                      type="number"
                      value={reviewForm.meritAmount}
                    />
                  </Field>
                </div>
                <Field label="Comments">
                  <textarea
                    className="input homework-admin-textarea"
                    maxLength={5000}
                    onChange={(event) => {
                      setReviewForm((current) => ({
                        ...current,
                        comments: event.target.value,
                      }));
                    }}
                    rows={4}
                    value={reviewForm.comments}
                  />
                </Field>
                <Button pending={reviewSubmission.isPending} type="submit">
                  Save review
                </Button>
              </>
            ) : (
              <EmptyState
                detail="Select a student submission to review."
                title="No submission selected"
              />
            )}
          </form>
        </div>
      </section>
    </div>
  );
}

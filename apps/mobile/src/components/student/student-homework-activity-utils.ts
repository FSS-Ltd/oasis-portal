import type { RouterOutputs } from '../../lib/trpc';

export type StudentHomeworkAssignment = RouterOutputs['homework']['studentDue'][number];
export type PreparedHomeworkUpload = RouterOutputs['homework']['prepareUpload']['images'][number];
export type HomeworkBadgeVariant = 'neutral' | 'success' | 'warning' | 'danger' | 'blue';

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
});

const numberFormatter = new Intl.NumberFormat('en-GB');

export const homeworkAccessBlockedCopy = [
  'Student portal locked',
  'Off-limit day',
  'Usage limit reached',
] as const;

export function formatHomeworkDate(value: Date | string | null): string {
  if (!value) return 'No date';
  return dateFormatter.format(new Date(value));
}

export function formatHomeworkMerits(value: number): string {
  return `${numberFormatter.format(Math.round(value))} merits`;
}

export function formatHomeworkScore(value: number | null): string {
  return value === null ? 'No score' : `${String(value)}%`;
}

export function parsePositiveByteSize(value: string): number | null {
  const parsed = Number(value.trim());
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

export function isHomeworkOverdue(value: Date | string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(value);
  dueDate.setHours(0, 0, 0, 0);
  return dueDate < today;
}

export function dueBadgeVariant(assignment: StudentHomeworkAssignment): HomeworkBadgeVariant {
  if (assignment.submittedAt) return 'success';
  if (isHomeworkOverdue(assignment.dueDate)) return 'danger';
  return 'blue';
}

export function dueBadgeLabel(assignment: StudentHomeworkAssignment): string {
  if (assignment.submittedAt) return 'Submitted';
  if (isHomeworkOverdue(assignment.dueDate)) return 'Overdue';
  return `Due ${formatHomeworkDate(assignment.dueDate)}`;
}

export function submissionMethodLabel(
  method: StudentHomeworkAssignment['submissionMethod'],
): string {
  return method === 'UploadImage' ? 'Upload image' : 'Hand in person';
}

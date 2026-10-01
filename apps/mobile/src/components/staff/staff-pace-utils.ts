export const paceTestTypes = ['SelfTest', 'FinalTest'] as const;

export type PaceTestType = (typeof paceTestTypes)[number];

export type PaceFormState = {
  paceNumber: string;
  score: string;
  selectedStudentId: string;
  subjectId: string;
  testType: PaceTestType;
};

export type PaceFormErrors = Partial<Record<keyof PaceFormState, string>>;

const schoolTimeZone = 'Europe/London';

export function dateKeyInSchoolTimeZone(value: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    timeZone: schoolTimeZone,
    year: 'numeric',
  }).formatToParts(value);
  const day = parts.find((part) => part.type === 'day')?.value ?? '01';
  const month = parts.find((part) => part.type === 'month')?.value ?? '01';
  const year = parts.find((part) => part.type === 'year')?.value ?? '1970';
  return `${year}-${month}-${day}`;
}

export function dateFromKey(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function addDays(value: string, days: number): string {
  const date = dateFromKey(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function formatPaceDate(value: string): string {
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'full', timeZone: 'UTC' }).format(
    dateFromKey(value),
  );
}

export function paceTestTypeLabel(value: PaceTestType): string {
  return value === 'FinalTest' ? 'PACE Test' : 'Self-Test';
}

export function scoreValue(value: string): number | null {
  if (value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function paceNumberValue(value: string): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function scoreTone(score: number | null): 'danger' | 'success' | 'warning' {
  if (score !== null && score >= 90) return 'success';
  if (score !== null && score >= 75) return 'warning';
  return 'danger';
}

export function scoreLabel(score: number | null): string {
  if (score === null) return 'Enter a score from 0 to 100.';
  if (score >= 90) return 'Excellent';
  if (score >= 80) return 'Good';
  if (score >= 70) return 'Satisfactory';
  if (score >= 60) return 'Needs support';
  return 'Below threshold';
}

export function validatePaceForm(form: PaceFormState): PaceFormErrors {
  const errors: PaceFormErrors = {};
  const parsedScore = scoreValue(form.score);
  if (!form.selectedStudentId) errors.selectedStudentId = 'Choose a student.';
  if (!form.subjectId) errors.subjectId = 'Choose a subject.';
  if (paceNumberValue(form.paceNumber) === null) {
    errors.paceNumber = 'Enter a positive PACE number.';
  }
  if (parsedScore === null || parsedScore < 0 || parsedScore > 100) {
    errors.score = 'Enter a score between 0 and 100.';
  }
  return errors;
}

export function hasPaceFormErrors(errors: PaceFormErrors): boolean {
  return Object.keys(errors).length > 0;
}

export function paceRecordStatus(result: {
  advanced: boolean;
  advancementBlockedReason: 'GapReviewRequired' | null;
  awardedMerits: number;
  newPaceNumber: number | undefined;
}): string {
  const meritText =
    result.awardedMerits > 0
      ? ` ${String(result.awardedMerits)} merit${result.awardedMerits === 1 ? '' : 's'} awarded.`
      : '';
  return result.advanced
    ? `PACE saved and advanced to ${String(result.newPaceNumber)}.${meritText}`
    : `PACE score saved.${result.advancementBlockedReason === 'GapReviewRequired' ? ' Advancement paused for Head review.' : ''}${meritText}`;
}

import {
  demeritPolicyStageForUnits,
  demeritPolicyStageLabel,
  demeritPolicyUnitsForEntry,
  type DemeritPolicyStage,
} from '@oasis/domain/demeritPolicy';

export const behaviourTypes = ['Merit', 'Demerit', 'General'] as const;
export const behaviourVisibilities = ['General', 'Sensitive'] as const;

export type BehaviourType = (typeof behaviourTypes)[number];
export type BehaviourVisibility = (typeof behaviourVisibilities)[number];

export type BehaviourFormState = {
  amount: string;
  category: string;
  note: string;
  selectedStudentId: string;
  type: BehaviourType;
  visibility: BehaviourVisibility;
};

export type BehaviourFormErrors = Partial<Record<keyof BehaviourFormState, string>>;

export const meritCategories = [
  'Scripture Memory',
  'Academic Excellence',
  'Helpfulness',
  'Character',
  'Leadership',
  'Punctuality',
  'Creativity',
] as const;

export const demeritCategories = [
  'Conduct',
  'Diligence',
  'Respect',
  'Property',
  'Honesty',
  'Serious Misconduct',
  'Misc',
] as const;

export const generalCategories = ['Misc', 'Pastoral note', 'Parent update', 'Praise note'] as const;

export const generalMarkPolicyText = 'General marks have no merit value.';

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

export function formatBehaviourDate(value: string): string {
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'full', timeZone: 'UTC' }).format(
    dateFromKey(value),
  );
}

export function defaultCategory(type: BehaviourType): string {
  if (type === 'Merit') return meritCategories[0];
  if (type === 'Demerit') return demeritCategories[0];
  return generalCategories[0];
}

export function categoryOptions(type: BehaviourType): readonly string[] {
  if (type === 'Merit') return meritCategories;
  if (type === 'Demerit') return demeritCategories;
  return generalCategories;
}

export function behaviourVisibilitiesForType(type: BehaviourType): readonly BehaviourVisibility[] {
  return type === 'Merit' ? ['General'] : behaviourVisibilities;
}

export function behaviourAmountValue(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function meritAmountValue(value: string): number {
  return behaviourAmountValue(value);
}

export function validateBehaviourForm(form: BehaviourFormState): BehaviourFormErrors {
  const errors: BehaviourFormErrors = {};
  if (!form.selectedStudentId) errors.selectedStudentId = 'Choose a student.';
  if (!form.category.trim()) errors.category = 'Choose a category.';
  if (!form.note.trim()) errors.note = 'Add a note.';
  if (form.type === 'Merit' && behaviourAmountValue(form.amount) <= 0) {
    errors.amount = 'Enter a positive merit amount.';
  }
  if (form.type === 'Demerit' && behaviourAmountValue(form.amount) <= 0) {
    errors.amount = 'Enter a positive demerit value.';
  }
  return errors;
}

export function hasBehaviourFormErrors(errors: BehaviourFormErrors): boolean {
  return Object.keys(errors).length > 0;
}

export type DailyDemeritStatus = {
  demeritUnits: number;
  stage: DemeritPolicyStage;
  studentId: string;
};

export type DemeritStagePreview = {
  escalates: boolean;
  nextStage: DemeritPolicyStage;
  noteRequired: boolean;
  previousStage: DemeritPolicyStage;
};

function defaultDemeritStatus(studentId: string): DailyDemeritStatus {
  return {
    demeritUnits: 0,
    stage: 0,
    studentId,
  };
}

function proposedDemeritUnits(category: string, amount: string): number {
  const selectedAmount = behaviourAmountValue(amount);
  return demeritPolicyUnitsForEntry({
    category,
    meritDelta: selectedAmount > 0 ? -selectedAmount : -1,
    type: 'Demerit',
  });
}

export function previewSingleDemeritStage(
  studentId: string,
  status: DailyDemeritStatus | null | undefined,
  category: string,
  amount: string,
): DemeritStagePreview {
  const current = status ?? defaultDemeritStatus(studentId);
  const nextUnits = current.demeritUnits + proposedDemeritUnits(category, amount);
  const countStage = demeritPolicyStageForUnits(nextUnits);
  const nextStage = Math.max(current.stage, countStage) as DemeritPolicyStage;

  return {
    escalates: nextStage > current.stage,
    nextStage,
    noteRequired: nextStage >= 3,
    previousStage: current.stage,
  };
}

export function formatDemeritStage(stage: DemeritPolicyStage): string {
  return demeritPolicyStageLabel(stage);
}

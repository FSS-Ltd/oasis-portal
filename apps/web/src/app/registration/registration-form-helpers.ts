import { type FieldPath, type UseFormSetError } from 'react-hook-form';
import type { ZodIssue } from 'zod';
import {
  parentInitialRegistrationInput,
  parentRegistrationSiblingInput,
  parentRegistrationUpdateInput,
} from '@oasis/domain';
import { friendlyErrorMessage } from '@/lib/notifications';
import {
  blankStudent,
  type RegistrationFormValues,
  type RegistrationStudentFormValues,
} from './registration-form-model';

export type RegistrationFormMode = 'edit' | 'initial' | 'sibling';
type InitialRegistrationParseResult = ReturnType<typeof parentInitialRegistrationInput.safeParse>;
type RegistrationUpdateParseResult = ReturnType<typeof parentRegistrationUpdateInput.safeParse>;
type SiblingRegistrationParseResult = ReturnType<typeof parentRegistrationSiblingInput.safeParse>;

export const submitLabel = {
  edit: 'Save registration',
  initial: 'Submit registration',
  sibling: 'Add sibling',
} as const satisfies Record<RegistrationFormMode, string>;

export function formPath(value: string): FieldPath<RegistrationFormValues> {
  return value as FieldPath<RegistrationFormValues>;
}

function stripStudentId(student: RegistrationStudentFormValues) {
  const studentInput = { ...student };
  delete studentInput.studentId;
  return studentInput;
}

function sharedPayloadInput(values: RegistrationFormValues) {
  return {
    homeAddress: values.homeAddress,
    guardianContacts: values.guardianContacts.map((contact) => ({
      ...contact,
      workPhone: contact.workPhone ?? '',
      address: contact.address ?? '',
    })),
    emergencyContacts: values.emergencyContacts,
    pickupContacts: values.pickupContacts,
    agreement: {
      ...values.agreement,
    },
  };
}

export function toInitialPayloadInput(values: RegistrationFormValues): unknown {
  return {
    ...sharedPayloadInput(values),
    students: values.students.map(stripStudentId),
  };
}

export function toUpdatePayloadInput(values: RegistrationFormValues): unknown {
  return {
    ...sharedPayloadInput(values),
    students: values.students.map((student) => ({
      ...stripStudentId(student),
      studentId: student.studentId ?? '',
    })),
  };
}

export function toSiblingPayloadInput(values: RegistrationFormValues): unknown {
  return {
    ...sharedPayloadInput(values),
    student: stripStudentId(values.students[0] ?? blankStudent()),
  };
}

function issuePathParts(issue: ZodIssue, mode: RegistrationFormMode): Array<number | string> {
  if (mode === 'sibling' && issue.path[0] === 'student') {
    return ['students', 0, ...issue.path.slice(1)];
  }
  return issue.path;
}

function issuePath(issue: ZodIssue, mode: RegistrationFormMode): string {
  return issuePathParts(issue, mode).map(String).join('.');
}

function labelForIssue(issue: ZodIssue, mode: RegistrationFormMode): string {
  const path = issuePath(issue, mode);
  const last = String(issuePathParts(issue, mode).at(-1) ?? '');

  if (path === 'homeAddress') return 'Enter the home address.';
  if (path === 'agreement.guardianName') return 'Enter the parent or guardian name.';
  if (path === 'agreement.agreementDate') return 'Choose a valid agreement date.';
  if (last === 'fullName') return 'Enter the full name.';
  if (last === 'relationship') return 'Enter the relationship.';
  if (last === 'primaryPhone' || last === 'phone') return 'Enter a phone number.';
  if (last === 'email') return 'Enter a valid email address.';
  if (last === 'dob') return 'Choose a valid date of birth.';
  if (last === 'registrationLevel') return 'Choose ABC, Primary, or Secondary.';
  if (last === 'startDate') return 'Choose a valid start date.';
  if (last === 'gender') return 'Choose Male or Female, or leave gender blank.';
  if (last === 'initials') return 'Enter initials for this consent.';

  return issue.message || 'Check this field.';
}

function sectionForIssue(issue: ZodIssue, mode: RegistrationFormMode): string {
  const [root, index] = issuePathParts(issue, mode);
  if (root === 'homeAddress') return 'Household';
  if (root === 'guardianContacts') return `Guardian ${String(Number(index) + 1)}`;
  if (root === 'emergencyContacts') return `Emergency contact ${String(Number(index) + 1)}`;
  if (root === 'pickupContacts') return `Pickup contact ${String(Number(index) + 1)}`;
  if (root === 'students') return `Student ${String(Number(index) + 1)}`;
  if (root === 'agreement') return 'Agreement';
  return 'Registration form';
}

function uniqueSections(issues: ZodIssue[], mode: RegistrationFormMode): string[] {
  return [...new Set(issues.map((issue) => sectionForIssue(issue, mode)))];
}

export function cleanSubmitErrorMessage(error: unknown): string {
  const message = friendlyErrorMessage(error, '');
  if (message.includes('invalid_enum_value') || message.includes('String must contain')) {
    return 'Registration could not be saved. Please finish the required fields and try again.';
  }
  return friendlyErrorMessage(error, 'Registration could not be saved. Please try again.');
}

export function setValidationIssues({
  issues,
  mode,
  setError,
  setIncompleteSections,
}: {
  issues: ZodIssue[];
  mode: RegistrationFormMode;
  setError: UseFormSetError<RegistrationFormValues>;
  setIncompleteSections: (sections: string[]) => void;
}): void {
  setIncompleteSections(uniqueSections(issues, mode));
  issues.forEach((issue, index) => {
    const path = issuePath(issue, mode);
    if (path.length === 0) return;
    setError(
      formPath(path),
      { message: labelForIssue(issue, mode), type: 'validate' },
      { shouldFocus: index === 0 },
    );
  });
}

export function parseInitialRegistration(
  values: RegistrationFormValues,
): InitialRegistrationParseResult {
  return parentInitialRegistrationInput.safeParse(toInitialPayloadInput(values));
}

export function parseRegistrationUpdate(
  values: RegistrationFormValues,
): RegistrationUpdateParseResult {
  return parentRegistrationUpdateInput.safeParse(toUpdatePayloadInput(values));
}

export function parseSiblingRegistration(
  values: RegistrationFormValues,
): SiblingRegistrationParseResult {
  return parentRegistrationSiblingInput.safeParse(toSiblingPayloadInput(values));
}

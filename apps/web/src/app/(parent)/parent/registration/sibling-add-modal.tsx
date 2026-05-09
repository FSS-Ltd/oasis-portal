'use client';

import { type ReactNode, useMemo, useState } from 'react';
import { Plus, Send, Trash2, UserRoundPlus, X } from 'lucide-react';
import { useFieldArray, useForm, type FieldPath } from 'react-hook-form';
import type { ZodIssue } from 'zod';
import {
  REGISTRATION_CONSENT_COPY,
  REGISTRATION_CONSENT_TYPES,
  REGISTRATION_GENDER_OPTIONS,
  STANDARD_SCHOOL_YEARS,
  displaySchoolYearLabel,
  parentRegistrationSiblingsInput,
} from '@oasis/domain';
import { Button, type ButtonProps } from '@/components/ui/button';
import { Field, SelectInput, TextInput } from '@/components/ui/field';
import { api } from '@/lib/trpc';
import {
  blankStudent,
  todayDateInput,
  type RegistrationStudentFormValues,
} from '../../../registration/registration-form-model';

interface SiblingAddFormValues {
  students: RegistrationStudentFormValues[];
}

interface SiblingAddModalButtonProps {
  children?: ReactNode;
  className?: string;
  size?: ButtonProps['size'];
  variant?: ButtonProps['variant'];
}

function TextArea({
  label,
  error,
  children,
}: {
  label: string;
  error?: string | undefined;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      {children}
      {error ? <span className="field__error">{error}</span> : null}
    </label>
  );
}

function formPath(value: string): FieldPath<SiblingAddFormValues> {
  return value as FieldPath<SiblingAddFormValues>;
}

function stripStudentId(student: RegistrationStudentFormValues) {
  const studentInput = { ...student };
  delete studentInput.studentId;
  return studentInput;
}

function issuePath(issue: ZodIssue): string {
  return issue.path.map(String).join('.');
}

function fieldPathForIssue(issue: ZodIssue): string {
  const path = issuePath(issue);
  return path.startsWith('students.') ? path : '';
}

function labelForIssue(issue: ZodIssue): string {
  const last = String(issue.path.at(-1) ?? '');
  if (last === 'fullName') return 'Enter the full name.';
  if (last === 'dob') return 'Choose a valid date of birth.';
  if (last === 'yearGroup') return 'Choose a year group or check the date of birth.';
  if (last === 'startDate') return 'Choose a valid start date.';
  if (last === 'gender') return 'Choose Male or Female, or leave gender blank.';
  if (last === 'initials') return 'Enter initials for this consent.';
  return issue.message || 'Check this field.';
}

function emptyValues(): SiblingAddFormValues {
  return { students: [blankStudent()] };
}

export function SiblingAddModalButton({
  children = 'Add sibling',
  className,
  size,
  variant = 'secondary',
}: SiblingAddModalButtonProps) {
  const utils = api.useUtils();
  const [open, setOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const registrationQuery = api.registration.mine.useQuery(undefined, {
    enabled: open,
    retry: false,
  });
  const addSiblings = api.registration.addSiblings.useMutation({
    async onSuccess() {
      await Promise.all([
        utils.registration.mine.invalidate(),
        utils.childLog.parentDashboard.invalidate(),
        utils.childLog.listAccessibleStudents.invalidate(),
      ]);
      reset(emptyValues());
      setSubmitError(null);
      setOpen(false);
    },
  });

  const {
    control,
    clearErrors,
    formState: { errors },
    handleSubmit,
    register,
    reset,
    setError,
  } = useForm<SiblingAddFormValues>({
    defaultValues: emptyValues(),
  });
  const students = useFieldArray({ control, name: 'students' });
  const existingStudentCount = registrationQuery.data?.students.length ?? 0;
  const remainingSlots = Math.max(0, 6 - existingStudentCount);
  const canAppend = students.fields.length < remainingSlots;
  const modalTitle = useMemo(
    () => (students.fields.length > 1 ? 'Add siblings' : 'Add sibling'),
    [students.fields.length],
  );

  const closeModal = () => {
    reset(emptyValues());
    clearErrors();
    setSubmitError(null);
    addSiblings.reset();
    setOpen(false);
  };

  return (
    <>
      <Button
        className={className}
        onClick={() => {
          setSubmitError(null);
          addSiblings.reset();
          setOpen(true);
        }}
        size={size}
        type="button"
        variant={variant}
      >
        <UserRoundPlus aria-hidden="true" size={size === 'sm' ? 14 : 16} />
        {children}
      </Button>

      {open ? (
        <div
          aria-labelledby="sibling-add-title"
          aria-modal="true"
          className="parent-sibling-backdrop"
          role="dialog"
        >
          <form
            className="parent-sibling-modal"
            onSubmit={(event) => {
              void handleSubmit((values) => {
                setSubmitError(null);
                clearErrors();
                addSiblings.reset();

                const result = parentRegistrationSiblingsInput.safeParse({
                  students: values.students.map(stripStudentId),
                });
                if (!result.success) {
                  result.error.issues.forEach((issue, index) => {
                    const path = fieldPathForIssue(issue);
                    if (!path) {
                      setSubmitError(labelForIssue(issue));
                      return;
                    }
                    setError(
                      formPath(path),
                      { message: labelForIssue(issue), type: 'validate' },
                      { shouldFocus: index === 0 },
                    );
                  });
                  return;
                }

                addSiblings.mutate(result.data);
              })(event);
            }}
          >
            <header className="parent-sibling-modal__header">
              <div>
                <p>Parent registration</p>
                <h2 id="sibling-add-title">{modalTitle}</h2>
                <span>
                  {registrationQuery.isLoading
                    ? 'Checking available child slots...'
                    : `${String(remainingSlots)} child slot${remainingSlots === 1 ? '' : 's'} available`}
                </span>
              </div>
              <Button
                aria-label="Close add sibling"
                onClick={closeModal}
                size="sm"
                type="button"
                variant="ghost"
              >
                <X aria-hidden="true" size={16} />
              </Button>
            </header>

            <div className="parent-sibling-modal__body">
              {registrationQuery.error ? (
                <p className="status--error" role="alert">
                  {registrationQuery.error.message}
                </p>
              ) : null}
              {remainingSlots === 0 && !registrationQuery.isLoading ? (
                <p className="status--error" role="alert">
                  This registration already has the maximum number of children.
                </p>
              ) : null}

              {students.fields.map((student, index) => (
                <section className="parent-sibling-card" key={student.id}>
                  <div className="parent-sibling-card__header">
                    <div>
                      <span>Sibling {index + 1}</span>
                      <strong>Child details</strong>
                    </div>
                    {students.fields.length > 1 ? (
                      <Button
                        onClick={() => {
                          students.remove(index);
                        }}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        <Trash2 aria-hidden="true" size={15} />
                        Remove
                      </Button>
                    ) : null}
                  </div>

                  <div className="form-grid form-grid--two">
                    <Field
                      error={errors.students?.[index]?.fullName?.message}
                      label="Full name"
                      required
                    >
                      <TextInput {...register(formPath(`students.${String(index)}.fullName`))} />
                    </Field>
                    <Field label="Preferred name">
                      <TextInput
                        {...register(formPath(`students.${String(index)}.preferredName`))}
                      />
                    </Field>
                    <Field
                      error={errors.students?.[index]?.dob?.message}
                      label="Date of birth"
                      required
                    >
                      <TextInput
                        max={todayDateInput()}
                        type="date"
                        {...register(formPath(`students.${String(index)}.dob`))}
                      />
                    </Field>
                    <Field
                      error={errors.students?.[index]?.yearGroup?.message}
                      hint="Leave blank to derive from date of birth."
                      label="Year group"
                    >
                      <SelectInput {...register(formPath(`students.${String(index)}.yearGroup`))}>
                        <option value="">Choose year group</option>
                        {STANDARD_SCHOOL_YEARS.map((year) => (
                          <option key={year} value={year}>
                            {displaySchoolYearLabel(year)}
                          </option>
                        ))}
                      </SelectInput>
                    </Field>
                    <Field error={errors.students?.[index]?.startDate?.message} label="Start date">
                      <TextInput
                        type="date"
                        {...register(formPath(`students.${String(index)}.startDate`))}
                      />
                    </Field>
                    <Field error={errors.students?.[index]?.gender?.message} label="Gender">
                      <SelectInput {...register(formPath(`students.${String(index)}.gender`))}>
                        <option value="">Choose gender</option>
                        {REGISTRATION_GENDER_OPTIONS.map((gender) => (
                          <option key={gender} value={gender}>
                            {gender}
                          </option>
                        ))}
                      </SelectInput>
                    </Field>
                    <Field label="Home language">
                      <TextInput
                        {...register(formPath(`students.${String(index)}.homeLanguage`))}
                      />
                    </Field>
                  </div>

                  <div className="form-grid form-grid--two">
                    <TextArea label="Allergies">
                      <textarea
                        className="input registration-textarea"
                        {...register(formPath(`students.${String(index)}.allergies`))}
                      />
                    </TextArea>
                    <TextArea label="Medical conditions">
                      <textarea
                        className="input registration-textarea"
                        {...register(formPath(`students.${String(index)}.medicalConditions`))}
                      />
                    </TextArea>
                    <TextArea label="Medication at Centre">
                      <textarea
                        className="input registration-textarea"
                        {...register(formPath(`students.${String(index)}.medicationAtCentre`))}
                      />
                    </TextArea>
                    <TextArea label="Dietary restrictions">
                      <textarea
                        className="input registration-textarea"
                        {...register(formPath(`students.${String(index)}.dietaryRestrictions`))}
                      />
                    </TextArea>
                    <TextArea label="Learning / behavioural support">
                      <textarea
                        className="input registration-textarea"
                        {...register(formPath(`students.${String(index)}.learningSupport`))}
                      />
                    </TextArea>
                    <TextArea label="Interests / strengths">
                      <textarea
                        className="input registration-textarea"
                        {...register(formPath(`students.${String(index)}.interestsStrengths`))}
                      />
                    </TextArea>
                  </div>

                  <TextArea label="Attendance, routine, or communication notes">
                    <textarea
                      className="input registration-textarea"
                      {...register(formPath(`students.${String(index)}.studentNotes`))}
                    />
                  </TextArea>

                  <div className="registration-consents">
                    {REGISTRATION_CONSENT_TYPES.map((consentType) => {
                      const initialsError =
                        errors.students?.[index]?.consents?.[consentType]?.initials?.message;

                      return (
                        <div className="registration-consent-row" key={consentType}>
                          <span>
                            {REGISTRATION_CONSENT_COPY[consentType]}
                            <span className="field__required">Required</span>
                          </span>
                          <SelectInput
                            aria-label={`${REGISTRATION_CONSENT_COPY[consentType]} answer`}
                            {...register(
                              formPath(`students.${String(index)}.consents.${consentType}.granted`),
                              {
                                setValueAs: (value) => value === 'true',
                              },
                            )}
                          >
                            <option value="false">No</option>
                            <option value="true">Yes</option>
                          </SelectInput>
                          <div className="registration-consent-initials">
                            <TextInput
                              aria-label={`${REGISTRATION_CONSENT_COPY[consentType]} initials`}
                              aria-required="true"
                              placeholder="Required initials"
                              {...register(
                                formPath(
                                  `students.${String(index)}.consents.${consentType}.initials`,
                                ),
                              )}
                            />
                            {initialsError ? (
                              <span className="field__error">{initialsError}</span>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}

              <Button
                disabled={!canAppend || registrationQuery.isLoading}
                onClick={() => {
                  students.append(blankStudent());
                }}
                type="button"
                variant="secondary"
              >
                <Plus aria-hidden="true" size={16} />
                Add another sibling
              </Button>
            </div>

            <footer className="parent-sibling-modal__footer">
              <div>
                {submitError || addSiblings.error ? (
                  <p className="status--error" role="alert">
                    {submitError ?? addSiblings.error?.message}
                  </p>
                ) : null}
              </div>
              <Button
                onClick={closeModal}
                type="button"
                variant="ghost"
              >
                Cancel
              </Button>
              <Button
                disabled={remainingSlots === 0 || registrationQuery.isLoading}
                pending={addSiblings.isPending}
                type="submit"
              >
                <Send aria-hidden="true" size={16} />
                Save sibling{students.fields.length === 1 ? '' : 's'}
              </Button>
            </footer>
          </form>
        </div>
      ) : null}
    </>
  );
}

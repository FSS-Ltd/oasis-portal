'use client';

import { Plus, Send, Trash2, UserRoundPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import {
  REGISTRATION_CONSENT_COPY,
  REGISTRATION_CONSENT_TYPES,
  REGISTRATION_GENDER_OPTIONS,
  REGISTRATION_LEVEL_OPTIONS,
} from '@oasis/domain';
import { Button } from '@/components/ui/button';
import { Field, SelectInput, TextInput } from '@/components/ui/field';
import { friendlyErrorMessage, showErrorToast, showSuccessToast } from '@/lib/notifications';
import { api } from '@/lib/trpc';
import {
  cleanSubmitErrorMessage,
  formPath,
  parseInitialRegistration,
  parseRegistrationUpdate,
  parseSiblingRegistration,
  setValidationIssues,
  submitLabel,
  type RegistrationFormMode,
} from './registration-form-helpers';
import {
  blankRegistrationValues,
  blankStudent,
  clearRegistrationDraftValues,
  loadRegistrationDraftValues,
  registrationValuesFromServer,
  saveRegistrationDraftValues,
  siblingValuesFromServer,
  todayDateInput,
  type RegistrationFormValues,
} from './registration-form-model';

function TextArea({
  label,
  error,
  required = false,
  children,
}: {
  label: string;
  error?: string | undefined;
  required?: boolean | undefined;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span className="field__label">
        {label}
        {required ? <span className="field__required">Required</span> : null}
      </span>
      {children}
      {error ? <span className="field__error">{error}</span> : null}
    </label>
  );
}

function RequirementBadge({ optional = false }: { optional?: boolean | undefined }) {
  return (
    <span
      className={
        optional ? 'registration-badge registration-badge--optional' : 'registration-badge'
      }
    >
      {optional ? 'Optional' : 'Required'}
    </span>
  );
}

function SectionLabel({ children, optional = false }: { children: ReactNode; optional?: boolean }) {
  return (
    <div className="registration-section-label">
      <h2>{children}</h2>
      <RequirementBadge optional={optional} />
    </div>
  );
}

export function RegistrationForm({ mode = 'initial' }: { mode?: RegistrationFormMode }) {
  const router = useRouter();
  const utils = api.useUtils();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [incompleteSections, setIncompleteSections] = useState<string[]>([]);
  const statusQuery = api.registration.status.useQuery(undefined, {
    enabled: mode === 'initial',
    retry: false,
  });
  const mineQuery = api.registration.mine.useQuery(undefined, {
    enabled: mode !== 'initial',
    retry: false,
  });
  const submitRegistration = api.registration.submitInitial.useMutation({
    async onSuccess() {
      clearRegistrationDraftValues();
      await Promise.all([
        utils.registration.status.invalidate(),
        utils.childLog.listAccessibleStudents.invalidate(),
      ]);
      showSuccessToast('Registration submitted.');
      router.replace('/parent');
    },
    onError(error) {
      showErrorToast(error, 'Registration could not be submitted.');
    },
  });
  const updateRegistration = api.registration.updateMine.useMutation({
    async onSuccess() {
      showSuccessToast('Registration saved.');
      await Promise.all([
        utils.registration.mine.invalidate(),
        utils.childLog.parentDashboard.invalidate(),
        utils.childLog.listAccessibleStudents.invalidate(),
      ]);
    },
    onError(error) {
      showErrorToast(error, 'Registration could not be saved.');
    },
  });
  const addSibling = api.registration.addSibling.useMutation({
    async onSuccess() {
      await Promise.all([
        utils.registration.mine.invalidate(),
        utils.childLog.parentDashboard.invalidate(),
        utils.childLog.listAccessibleStudents.invalidate(),
      ]);
      showSuccessToast('Sibling added.');
      router.replace('/parent');
    },
    onError(error) {
      showErrorToast(error, 'Sibling could not be added.');
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
    watch,
  } = useForm<RegistrationFormValues>({
    defaultValues: mode === 'initial' ? loadRegistrationDraftValues() : blankRegistrationValues(),
  });

  const guardianContacts = useFieldArray({ control, name: 'guardianContacts' });
  const emergencyContacts = useFieldArray({ control, name: 'emergencyContacts' });
  const pickupContacts = useFieldArray({ control, name: 'pickupContacts' });
  const students = useFieldArray({ control, name: 'students' });
  const activeMutation =
    mode === 'edit' ? updateRegistration : mode === 'sibling' ? addSibling : submitRegistration;
  const submissionErrorMessage =
    submitError ?? (activeMutation.error ? cleanSubmitErrorMessage(activeMutation.error) : null);

  useEffect(() => {
    if (mode === 'initial' && statusQuery.data && !statusQuery.data.requiresRegistration) {
      router.replace('/parent');
    }
  }, [mode, router, statusQuery.data]);

  useEffect(() => {
    if (mode !== 'initial') return undefined;
    const subscription = watch((values) => {
      saveRegistrationDraftValues(values);
    });
    return () => {
      subscription.unsubscribe();
    };
  }, [mode, watch]);

  useEffect(() => {
    if (mode === 'initial' || !mineQuery.data) return;
    reset(
      mode === 'sibling'
        ? siblingValuesFromServer(mineQuery.data)
        : registrationValuesFromServer(mineQuery.data),
    );
  }, [mineQuery.data, mode, reset]);

  if (mode === 'initial' && statusQuery.isLoading) {
    return <div className="empty-state">Loading registration...</div>;
  }

  if (mode === 'initial' && statusQuery.error) {
    return (
      <div className="empty-state status--error">{friendlyErrorMessage(statusQuery.error)}</div>
    );
  }

  if (mode !== 'initial' && mineQuery.isLoading) {
    return <div className="empty-state">Loading registration...</div>;
  }

  if (mode !== 'initial' && mineQuery.error) {
    return <div className="empty-state status--error">{friendlyErrorMessage(mineQuery.error)}</div>;
  }

  if (mode !== 'initial' && mineQuery.data === null) {
    return <div className="empty-state">No submitted registration was found.</div>;
  }

  return (
    <form
      className="registration-form"
      onSubmit={(event) => {
        void handleSubmit((values) => {
          setSubmitError(null);
          setIncompleteSections([]);
          clearErrors();
          activeMutation.reset();

          if (mode === 'edit') {
            const result = parseRegistrationUpdate(values);
            if (!result.success) {
              setValidationIssues({
                issues: result.error.issues,
                mode,
                setError,
                setIncompleteSections,
              });
              return;
            }
            updateRegistration.mutate(result.data);
            return;
          }

          if (mode === 'sibling') {
            const result = parseSiblingRegistration(values);
            if (!result.success) {
              setValidationIssues({
                issues: result.error.issues,
                mode,
                setError,
                setIncompleteSections,
              });
              return;
            }
            addSibling.mutate(result.data);
            return;
          }

          const result = parseInitialRegistration(values);
          if (!result.success) {
            setValidationIssues({
              issues: result.error.issues,
              mode,
              setError,
              setIncompleteSections,
            });
            return;
          }
          submitRegistration.mutate(result.data);
        })(event);
      }}
    >
      <section className="panel">
        <div className="panel__body form-grid">
          <div className="section-title">
            <SectionLabel>Household</SectionLabel>
          </div>
          <p className="registration-draft-note">Draft saved on this device.</p>
          <Field error={errors.homeAddress?.message} label="Home address" required>
            <TextInput autoComplete="street-address" {...register('homeAddress')} />
          </Field>
        </div>
      </section>

      <section className="panel">
        <div className="panel__body form-grid">
          <div className="section-title registration-section-title">
            <SectionLabel>Parent / guardian contacts</SectionLabel>
            <Button
              disabled={guardianContacts.fields.length >= 2}
              onClick={() => {
                guardianContacts.append({
                  fullName: '',
                  relationship: '',
                  primaryPhone: '',
                  secondaryPhone: '',
                  email: '',
                  workPhone: '',
                  address: '',
                });
              }}
              type="button"
              variant="secondary"
            >
              <Plus aria-hidden="true" size={16} />
              Add contact
            </Button>
          </div>
          {guardianContacts.fields.map((contact, index) => (
            <div className="registration-subsection" key={contact.id}>
              <div className="registration-subsection__header">
                <strong>Guardian {index + 1}</strong>
                {guardianContacts.fields.length > 1 ? (
                  <Button
                    onClick={() => {
                      guardianContacts.remove(index);
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
                  error={errors.guardianContacts?.[index]?.fullName?.message}
                  label="Full name"
                  required
                >
                  <TextInput
                    autoComplete="name"
                    {...register(formPath(`guardianContacts.${String(index)}.fullName`))}
                  />
                </Field>
                <Field
                  error={errors.guardianContacts?.[index]?.relationship?.message}
                  label="Relationship"
                  required
                >
                  <TextInput
                    {...register(formPath(`guardianContacts.${String(index)}.relationship`))}
                  />
                </Field>
                <Field
                  error={errors.guardianContacts?.[index]?.primaryPhone?.message}
                  label="Primary phone"
                  required
                >
                  <TextInput
                    type="tel"
                    {...register(formPath(`guardianContacts.${String(index)}.primaryPhone`))}
                  />
                </Field>
                <Field label="Secondary phone">
                  <TextInput
                    type="tel"
                    {...register(formPath(`guardianContacts.${String(index)}.secondaryPhone`))}
                  />
                </Field>
                <Field error={errors.guardianContacts?.[index]?.email?.message} label="Email">
                  <TextInput
                    type="email"
                    {...register(formPath(`guardianContacts.${String(index)}.email`))}
                  />
                </Field>
                <Field label="Work phone">
                  <TextInput
                    type="tel"
                    {...register(formPath(`guardianContacts.${String(index)}.workPhone`))}
                  />
                </Field>
              </div>
              <Field label="Address if different">
                <TextInput {...register(formPath(`guardianContacts.${String(index)}.address`))} />
              </Field>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel__body form-grid">
          <div className="section-title registration-section-title">
            <SectionLabel>Emergency contacts</SectionLabel>
            <Button
              disabled={emergencyContacts.fields.length >= 2}
              onClick={() => {
                emergencyContacts.append({
                  fullName: '',
                  relationship: '',
                  primaryPhone: '',
                  secondaryPhone: '',
                  email: '',
                  canPickUp: false,
                });
              }}
              type="button"
              variant="secondary"
            >
              <Plus aria-hidden="true" size={16} />
              Add contact
            </Button>
          </div>
          {emergencyContacts.fields.map((contact, index) => (
            <div className="registration-subsection" key={contact.id}>
              <div className="registration-subsection__header">
                <strong>Emergency contact {index + 1}</strong>
                {emergencyContacts.fields.length > 1 ? (
                  <Button
                    onClick={() => {
                      emergencyContacts.remove(index);
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
                  error={errors.emergencyContacts?.[index]?.fullName?.message}
                  label="Full name"
                  required
                >
                  <TextInput
                    {...register(formPath(`emergencyContacts.${String(index)}.fullName`))}
                  />
                </Field>
                <Field
                  error={errors.emergencyContacts?.[index]?.relationship?.message}
                  label="Relationship"
                  required
                >
                  <TextInput
                    {...register(formPath(`emergencyContacts.${String(index)}.relationship`))}
                  />
                </Field>
                <Field
                  error={errors.emergencyContacts?.[index]?.primaryPhone?.message}
                  label="Primary phone"
                  required
                >
                  <TextInput
                    type="tel"
                    {...register(formPath(`emergencyContacts.${String(index)}.primaryPhone`))}
                  />
                </Field>
                <Field label="Secondary phone">
                  <TextInput
                    type="tel"
                    {...register(formPath(`emergencyContacts.${String(index)}.secondaryPhone`))}
                  />
                </Field>
                <Field error={errors.emergencyContacts?.[index]?.email?.message} label="Email">
                  <TextInput
                    type="email"
                    {...register(formPath(`emergencyContacts.${String(index)}.email`))}
                  />
                </Field>
                <Field label="Can pick up student?">
                  <SelectInput
                    {...register(formPath(`emergencyContacts.${String(index)}.canPickUp`), {
                      setValueAs: (value) => value === 'true',
                    })}
                  >
                    <option value="false">No</option>
                    <option value="true">Yes</option>
                  </SelectInput>
                </Field>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel__body form-grid">
          <div className="section-title registration-section-title">
            <SectionLabel optional>Authorised pickup</SectionLabel>
            <Button
              disabled={pickupContacts.fields.length >= 10}
              onClick={() => {
                pickupContacts.append({
                  fullName: '',
                  relationship: '',
                  phone: '',
                  idPasswordNote: '',
                });
              }}
              type="button"
              variant="secondary"
            >
              <Plus aria-hidden="true" size={16} />
              Add pickup
            </Button>
          </div>
          {pickupContacts.fields.length === 0 ? (
            <p className="muted">No additional pickup contacts added.</p>
          ) : null}
          {pickupContacts.fields.map((contact, index) => (
            <div className="registration-subsection" key={contact.id}>
              <div className="registration-subsection__header">
                <strong>Pickup contact {index + 1}</strong>
                <Button
                  onClick={() => {
                    pickupContacts.remove(index);
                  }}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  <Trash2 aria-hidden="true" size={15} />
                  Remove
                </Button>
              </div>
              <div className="form-grid form-grid--two">
                <Field
                  error={errors.pickupContacts?.[index]?.fullName?.message}
                  label="Full name"
                  required
                >
                  <TextInput {...register(formPath(`pickupContacts.${String(index)}.fullName`))} />
                </Field>
                <Field
                  error={errors.pickupContacts?.[index]?.relationship?.message}
                  label="Relationship"
                  required
                >
                  <TextInput
                    {...register(formPath(`pickupContacts.${String(index)}.relationship`))}
                  />
                </Field>
                <Field
                  error={errors.pickupContacts?.[index]?.phone?.message}
                  label="Phone"
                  required
                >
                  <TextInput
                    type="tel"
                    {...register(formPath(`pickupContacts.${String(index)}.phone`))}
                  />
                </Field>
                <Field label="ID / password note">
                  <TextInput
                    {...register(formPath(`pickupContacts.${String(index)}.idPasswordNote`))}
                  />
                </Field>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel__body form-grid">
          <div className="section-title registration-section-title">
            <SectionLabel>Students</SectionLabel>
            {mode === 'initial' ? (
              <Button
                disabled={students.fields.length >= 6}
                onClick={() => {
                  students.append(blankStudent());
                }}
                type="button"
                variant="secondary"
              >
                <UserRoundPlus aria-hidden="true" size={16} />
                Add sibling
              </Button>
            ) : null}
          </div>
          {students.fields.map((student, index) => (
            <div className="registration-student" key={student.id}>
              <div className="registration-student__header">
                <div>
                  <span>Student {index + 1}</span>
                  <strong>{students.fields.length > 1 ? 'Sibling record' : 'Child record'}</strong>
                </div>
                {mode === 'initial' && students.fields.length > 1 ? (
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
                  <TextInput {...register(formPath(`students.${String(index)}.preferredName`))} />
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
                  error={errors.students?.[index]?.registrationLevel?.message}
                  hint="The Head of Centre will decide the exact level."
                  label="Registration level"
                  required
                >
                  <SelectInput
                    {...register(formPath(`students.${String(index)}.registrationLevel`))}
                  >
                    <option value="">Choose level</option>
                    {REGISTRATION_LEVEL_OPTIONS.map((level) => (
                      <option key={level} value={level}>
                        {level}
                      </option>
                    ))}
                  </SelectInput>
                </Field>
                <Field
                  error={errors.students?.[index]?.startDate?.message}
                  hint="Leave blank to use today."
                  label="Start date"
                >
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
                  <TextInput {...register(formPath(`students.${String(index)}.homeLanguage`))} />
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
                <TextArea label="Settling / comfort notes">
                  <textarea
                    className="input registration-textarea"
                    {...register(formPath(`students.${String(index)}.settlingComfortNotes`))}
                  />
                </TextArea>
                <TextArea label="Additional notes">
                  <textarea
                    className="input registration-textarea"
                    {...register(formPath(`students.${String(index)}.additionalInfo`))}
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
                            formPath(`students.${String(index)}.consents.${consentType}.initials`),
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
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel__body form-grid">
          <div className="section-title">
            <SectionLabel>Agreement</SectionLabel>
          </div>
          <div className="form-grid form-grid--two">
            <Field
              error={errors.agreement?.guardianName?.message}
              label="Parent / guardian name"
              required
            >
              <TextInput {...register('agreement.guardianName')} />
            </Field>
            <Field error={errors.agreement?.agreementDate?.message} label="Date" required>
              <TextInput
                max={todayDateInput()}
                type="date"
                {...register('agreement.agreementDate')}
              />
            </Field>
          </div>
          {incompleteSections.length > 0 ? (
            <div className="registration-error-summary" role="alert">
              <strong>Registration is incomplete.</strong>
              <span>Please finish the required details in {incompleteSections.join(', ')}.</span>
            </div>
          ) : null}
          {submissionErrorMessage ? (
            <p className="status--error" role="alert">
              {submissionErrorMessage}
            </p>
          ) : null}
          <div>
            <Button pending={activeMutation.isPending} type="submit">
              <Send aria-hidden="true" size={16} />
              {submitLabel[mode]}
            </Button>
          </div>
        </div>
      </section>
    </form>
  );
}

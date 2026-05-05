'use client';

import { Plus, Send, Trash2, UserRoundPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';
import { useFieldArray, useForm, type FieldPath } from 'react-hook-form';
import {
  REGISTRATION_CONSENT_COPY,
  REGISTRATION_CONSENT_TYPES,
  REGISTRATION_GENDER_OPTIONS,
  STANDARD_SCHOOL_YEARS,
  displaySchoolYearLabel,
  parentInitialRegistrationInput,
  type ParentInitialRegistrationInput,
} from '@oasis/domain';
import { Button } from '@/components/ui/button';
import { Field, SelectInput, TextInput } from '@/components/ui/field';
import { api } from '@/lib/trpc';
import {
  blankRegistrationValues,
  blankStudent,
  todayDateInput,
  type RegistrationFormValues,
} from './registration-form-model';

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

function formPath(value: string): FieldPath<RegistrationFormValues> {
  return value as FieldPath<RegistrationFormValues>;
}

function toPayload(values: RegistrationFormValues): ParentInitialRegistrationInput {
  return parentInitialRegistrationInput.parse({
    ...values,
    guardianContacts: values.guardianContacts.map((contact) => ({
      ...contact,
      workPhone: contact.workPhone ?? '',
      address: contact.address ?? '',
    })),
    students: values.students.map((student) => ({
      ...student,
      dob: new Date(student.dob),
      startDate: new Date(student.startDate),
    })),
    agreement: {
      ...values.agreement,
      agreementDate: new Date(values.agreement.agreementDate),
    },
  });
}

export function RegistrationForm() {
  const router = useRouter();
  const utils = api.useUtils();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const statusQuery = api.registration.status.useQuery(undefined, { retry: false });
  const submitRegistration = api.registration.submitInitial.useMutation({
    async onSuccess() {
      await Promise.all([
        utils.registration.status.invalidate(),
        utils.childLog.listAccessibleStudents.invalidate(),
      ]);
      router.replace('/parent');
    },
  });

  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<RegistrationFormValues>({
    defaultValues: blankRegistrationValues(),
  });

  const guardianContacts = useFieldArray({ control, name: 'guardianContacts' });
  const emergencyContacts = useFieldArray({ control, name: 'emergencyContacts' });
  const pickupContacts = useFieldArray({ control, name: 'pickupContacts' });
  const students = useFieldArray({ control, name: 'students' });

  useEffect(() => {
    if (statusQuery.data && !statusQuery.data.requiresRegistration) {
      router.replace('/parent');
    }
  }, [router, statusQuery.data]);

  if (statusQuery.isLoading) {
    return <div className="empty-state">Loading registration...</div>;
  }

  if (statusQuery.error) {
    return <div className="empty-state status--error">{statusQuery.error.message}</div>;
  }

  return (
    <form
      className="registration-form"
      onSubmit={(event) => {
        void handleSubmit((values) => {
          setSubmitError(null);
          try {
            submitRegistration.mutate(toPayload(values));
          } catch (err) {
            setSubmitError(err instanceof Error ? err.message : 'Registration could not be saved.');
          }
        })(event);
      }}
    >
      <section className="panel">
        <div className="panel__body form-grid">
          <div className="section-title">
            <h2>Household</h2>
          </div>
          <Field error={errors.homeAddress?.message} label="Home address">
            <TextInput autoComplete="street-address" {...register('homeAddress')} />
          </Field>
        </div>
      </section>

      <section className="panel">
        <div className="panel__body form-grid">
          <div className="section-title registration-section-title">
            <h2>Parent / guardian contacts</h2>
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
                >
                  <TextInput
                    autoComplete="name"
                    {...register(formPath(`guardianContacts.${String(index)}.fullName`))}
                  />
                </Field>
                <Field
                  error={errors.guardianContacts?.[index]?.relationship?.message}
                  label="Relationship"
                >
                  <TextInput
                    {...register(formPath(`guardianContacts.${String(index)}.relationship`))}
                  />
                </Field>
                <Field
                  error={errors.guardianContacts?.[index]?.primaryPhone?.message}
                  label="Primary phone"
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
            <h2>Emergency contacts</h2>
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
                >
                  <TextInput
                    {...register(formPath(`emergencyContacts.${String(index)}.fullName`))}
                  />
                </Field>
                <Field
                  error={errors.emergencyContacts?.[index]?.relationship?.message}
                  label="Relationship"
                >
                  <TextInput
                    {...register(formPath(`emergencyContacts.${String(index)}.relationship`))}
                  />
                </Field>
                <Field
                  error={errors.emergencyContacts?.[index]?.primaryPhone?.message}
                  label="Primary phone"
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
            <h2>Authorised pickup</h2>
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
                <Field error={errors.pickupContacts?.[index]?.fullName?.message} label="Full name">
                  <TextInput {...register(formPath(`pickupContacts.${String(index)}.fullName`))} />
                </Field>
                <Field
                  error={errors.pickupContacts?.[index]?.relationship?.message}
                  label="Relationship"
                >
                  <TextInput
                    {...register(formPath(`pickupContacts.${String(index)}.relationship`))}
                  />
                </Field>
                <Field error={errors.pickupContacts?.[index]?.phone?.message} label="Phone">
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
            <h2>Students</h2>
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
          </div>
          {students.fields.map((student, index) => (
            <div className="registration-student" key={student.id}>
              <div className="registration-student__header">
                <div>
                  <span>Student {index + 1}</span>
                  <strong>{students.fields.length > 1 ? 'Sibling record' : 'Child record'}</strong>
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
                <Field error={errors.students?.[index]?.fullName?.message} label="Full name">
                  <TextInput {...register(formPath(`students.${String(index)}.fullName`))} />
                </Field>
                <Field label="Preferred name">
                  <TextInput {...register(formPath(`students.${String(index)}.preferredName`))} />
                </Field>
                <Field error={errors.students?.[index]?.dob?.message} label="Date of birth">
                  <TextInput
                    max={todayDateInput()}
                    type="date"
                    {...register(formPath(`students.${String(index)}.dob`))}
                  />
                </Field>
                <Field error={errors.students?.[index]?.yearGroup?.message} label="Year group">
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
                  <SelectInput
                    {...register(formPath(`students.${String(index)}.gender`), {
                      required: 'Choose Male or Female',
                    })}
                  >
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
                {REGISTRATION_CONSENT_TYPES.map((consentType) => (
                  <div className="registration-consent-row" key={consentType}>
                    <span>{REGISTRATION_CONSENT_COPY[consentType]}</span>
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
                    <TextInput
                      aria-label={`${REGISTRATION_CONSENT_COPY[consentType]} initials`}
                      placeholder="Initials"
                      {...register(
                        formPath(`students.${String(index)}.consents.${consentType}.initials`),
                      )}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel__body form-grid">
          <div className="section-title">
            <h2>Agreement</h2>
          </div>
          <div className="form-grid form-grid--two">
            <Field error={errors.agreement?.guardianName?.message} label="Parent / guardian name">
              <TextInput {...register('agreement.guardianName')} />
            </Field>
            <Field error={errors.agreement?.agreementDate?.message} label="Date">
              <TextInput
                max={todayDateInput()}
                type="date"
                {...register('agreement.agreementDate')}
              />
            </Field>
          </div>
          {submitError || submitRegistration.error ? (
            <p className="status--error" role="alert">
              {submitError ?? submitRegistration.error?.message}
            </p>
          ) : null}
          <div>
            <Button pending={submitRegistration.isPending} type="submit">
              <Send aria-hidden="true" size={16} />
              Submit registration
            </Button>
          </div>
        </div>
      </section>
    </form>
  );
}

'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Send } from 'lucide-react';
import { useForm } from 'react-hook-form';
import {
  STANDARD_SCHOOL_YEARS,
  displaySchoolYearLabel,
  submitStudentSelfRegistrationInput,
  type SubmitStudentSelfRegistrationInput,
} from '@oasis/domain';
import { Button } from '@/components/ui/button';
import { Field, SelectInput, TextInput } from '@/components/ui/field';
import { showErrorToast, showSuccessToast } from '@/lib/notifications';
import { api } from '@/lib/trpc';

type FormValues = SubmitStudentSelfRegistrationInput;

function todayDateInput(): string {
  return new Date().toISOString().slice(0, 10);
}

export function StudentSelfRegistrationForm() {
  const submitRegistration = api.registration.submitStudentSelfRegistration.useMutation({
    onSuccess() {
      showSuccessToast('Registration request submitted.');
      reset({
        firstName: '',
        lastName: '',
        dob: new Date(),
        email: '',
        yearGroup: 'Year 1',
        registrationCode: '',
      });
    },
    onError(error) {
      showErrorToast(error, 'Registration request could not be submitted.');
    },
  });
  const {
    formState: { errors },
    handleSubmit,
    register,
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(submitStudentSelfRegistrationInput),
    defaultValues: {
      firstName: '',
      lastName: '',
      dob: new Date(),
      email: '',
      yearGroup: 'Year 1',
      registrationCode: '',
    },
  });

  return (
    <form
      className="registration-form"
      onSubmit={(event) => {
        void handleSubmit((values) => {
          submitRegistration.mutate(values);
        })(event);
      }}
    >
      <section className="registration-section">
        <div className="registration-section-label">
          <h2>Student details</h2>
          <span className="registration-badge">Required</span>
        </div>
        <div className="form-grid form-grid--two">
          <Field error={errors.firstName?.message} label="First name" required>
            <TextInput autoComplete="given-name" {...register('firstName')} />
          </Field>
          <Field error={errors.lastName?.message} label="Last name" required>
            <TextInput autoComplete="family-name" {...register('lastName')} />
          </Field>
        </div>
        <div className="form-grid form-grid--two">
          <Field error={errors.dob?.message} label="Date of birth" required>
            <TextInput
              max={todayDateInput()}
              type="date"
              {...register('dob', {
                setValueAs: (value) => new Date(String(value)),
              })}
            />
          </Field>
          <Field error={errors.yearGroup?.message} label="Age band" required>
            <SelectInput {...register('yearGroup')}>
              {STANDARD_SCHOOL_YEARS.map((year) => (
                <option key={year} value={year}>
                  {displaySchoolYearLabel(year)}
                </option>
              ))}
            </SelectInput>
          </Field>
        </div>
        <div className="form-grid form-grid--two">
          <Field error={errors.email?.message} label="Email" required>
            <TextInput autoComplete="email" type="email" {...register('email')} />
          </Field>
          <Field error={errors.registrationCode?.message} label="Registration code" required>
            <TextInput autoComplete="one-time-code" {...register('registrationCode')} />
          </Field>
        </div>
      </section>

      {submitRegistration.data ? (
        <div className="empty-state" role="status">
          Registration request received. A Centre Manager will review it before access is issued.
        </div>
      ) : null}

      <div className="registration-actions">
        <Button pending={submitRegistration.isPending} type="submit">
          <Send aria-hidden="true" size={16} />
          Submit request
        </Button>
      </div>
    </form>
  );
}

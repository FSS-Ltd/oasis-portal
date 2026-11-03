'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { resolveSchoolYearForDob, standardSchoolYearSchema } from '@oasis/domain';
import { api } from '@/lib/trpc';
import { useSchoolNow } from '@/lib/realtime/school-clock';
import { friendlyErrorMessage, showErrorToast, showSuccessToast } from '@/lib/notifications';
import { Button } from '@/components/ui/button';
import { Field, TextInput } from '@/components/ui/field';
import { StudentLevelField } from '@/components/students/student-level-field';

const schema = z.object({
  fullName: z.string().trim().min(1, 'Enter the student name'),
  email: z.string().trim().email('Enter a valid email address'),
  dob: z.string().min(1, 'Enter the date of birth'),
  yearGroupOverride: standardSchoolYearSchema.nullable(),
  enrolmentDate: z.string().min(1, 'Enter the Oasis start date'),
  address: z.string().trim().optional(),
});

type FormValues = z.input<typeof schema>;

export function NewStudentForm() {
  const router = useRouter();
  const schoolNow = useSchoolNow();
  const utils = api.useUtils();
  const createStudent = api.student.create.useMutation({
    async onSuccess(result) {
      await utils.student.list.invalidate();
      showSuccessToast(
        result.invitationEmailStatus === 'Sent'
          ? 'Student created and signup email sent.'
          : 'Student created. Signup email could not be sent.',
      );
      router.push(`/admin/students/${result.id}`);
    },
    onError(error) {
      showErrorToast(error, 'Student could not be created.');
    },
  });
  const {
    formState: { errors },
    handleSubmit,
    register,
    setValue,
    watch,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: '',
      email: '',
      dob: '',
      yearGroupOverride: null,
      enrolmentDate: new Date().toISOString().slice(0, 10),
      address: '',
    },
  });
  const dobValue = watch('dob');
  const yearGroupOverride = watch('yearGroupOverride');
  const derivedYear = resolveSchoolYearForDob(dobValue, schoolNow);

  return (
    <form
      className="panel"
      onSubmit={(event) => {
        void handleSubmit((values) => {
          createStudent.mutate({
            fullName: values.fullName,
            email: values.email,
            dob: new Date(values.dob),
            yearGroupOverride: values.yearGroupOverride,
            enrolmentDate: new Date(values.enrolmentDate),
            address: values.address || undefined,
          });
        })(event);
      }}
    >
      <div className="panel__body form-grid">
        <div className="form-grid form-grid--two" style={{ alignItems: 'start' }}>
          <Field error={errors.fullName?.message} label="Full name">
            <TextInput autoComplete="name" {...register('fullName')} />
          </Field>
          <Field error={errors.email?.message} label="Email">
            <TextInput autoComplete="email" type="email" {...register('email')} />
          </Field>
          <Field error={errors.dob?.message} label="Date of birth">
            <TextInput type="date" {...register('dob')} />
          </Field>
          <StudentLevelField
            error={errors.yearGroupOverride?.message}
            onChange={(year) => {
              setValue('yearGroupOverride', year, { shouldDirty: true, shouldValidate: true });
            }}
            override={yearGroupOverride}
            suggestedYear={derivedYear}
          />
          <Field error={errors.enrolmentDate?.message} label="Oasis start date">
            <TextInput type="date" {...register('enrolmentDate')} />
          </Field>
        </div>
        <Field error={errors.address?.message} label="Address">
          <TextInput autoComplete="street-address" {...register('address')} />
        </Field>
        {createStudent.error ? (
          <p className="status--error" role="alert">
            {friendlyErrorMessage(createStudent.error)}
          </p>
        ) : null}
        <div>
          <Button pending={createStudent.isPending} type="submit">
            <Save aria-hidden="true" size={16} />
            Create student
          </Button>
        </div>
      </div>
    </form>
  );
}

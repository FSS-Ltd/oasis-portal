'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { api } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Field, TextInput } from '@/components/ui/field';

const schema = z.object({
  fullName: z.string().trim().min(1, 'Enter the student name'),
  dob: z.string().min(1, 'Enter the date of birth'),
  yearGroup: z.string().trim().min(1, 'Enter the year group'),
  enrolmentDate: z.string().min(1, 'Enter the enrolment date'),
  address: z.string().trim().optional(),
});

type FormValues = z.infer<typeof schema>;

export function NewStudentForm() {
  const router = useRouter();
  const utils = api.useUtils();
  const createStudent = api.student.create.useMutation({
    async onSuccess(result) {
      await utils.student.list.invalidate();
      router.push(`/admin/students/${result.id}`);
    },
  });
  const {
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: '',
      dob: '',
      yearGroup: '',
      enrolmentDate: new Date().toISOString().slice(0, 10),
      address: '',
    },
  });

  return (
    <form
      className="panel"
      onSubmit={handleSubmit((values) =>
        createStudent.mutate({
          fullName: values.fullName,
          dob: new Date(values.dob),
          yearGroup: values.yearGroup,
          enrolmentDate: new Date(values.enrolmentDate),
          address: values.address || undefined,
        }),
      )}
    >
      <div className="panel__body form-grid">
        <div className="form-grid form-grid--two">
          <Field error={errors.fullName?.message} label="Full name">
            <TextInput autoComplete="name" {...register('fullName')} />
          </Field>
          <Field error={errors.yearGroup?.message} label="Year group">
            <TextInput placeholder="Year 8" {...register('yearGroup')} />
          </Field>
          <Field error={errors.dob?.message} label="Date of birth">
            <TextInput type="date" {...register('dob')} />
          </Field>
          <Field error={errors.enrolmentDate?.message} label="Enrolment date">
            <TextInput type="date" {...register('enrolmentDate')} />
          </Field>
        </div>
        <Field error={errors.address?.message} label="Address">
          <TextInput autoComplete="street-address" {...register('address')} />
        </Field>
        {createStudent.error ? (
          <p className="status--error" role="alert">
            {createStudent.error.message}
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

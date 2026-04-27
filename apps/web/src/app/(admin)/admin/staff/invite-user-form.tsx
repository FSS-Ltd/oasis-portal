'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Send } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { PERMISSION_TAGS, ROLES } from '@oasis/domain';
import { api } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Field, SelectInput, TextInput } from '@/components/ui/field';

const schema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  role: z.enum(ROLES),
  tag: z.enum(PERMISSION_TAGS).or(z.literal('')),
  redirectUrl: z.string().trim().url('Enter a valid URL').or(z.literal('')).optional(),
});

type FormValues = z.infer<typeof schema>;

export function InviteUserForm() {
  const inviteUser = api.admin.inviteUser.useMutation();
  const {
    formState: { errors },
    handleSubmit,
    register,
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: '',
      role: 'Parent',
      tag: '',
      redirectUrl: '',
    },
  });

  return (
    <form
      className="panel"
      onSubmit={handleSubmit((values) =>
        inviteUser.mutate(
          {
            email: values.email,
            role: values.role,
            tags: values.tag ? [values.tag] : [],
            redirectUrl: values.redirectUrl || undefined,
          },
          {
            onSuccess: () => {
              reset({ email: '', role: values.role, tag: '', redirectUrl: values.redirectUrl });
            },
          },
        ),
      )}
    >
      <div className="panel__body form-grid">
        <div className="form-grid form-grid--two">
          <Field error={errors.email?.message} label="Email">
            <TextInput autoComplete="email" type="email" {...register('email')} />
          </Field>
          <Field error={errors.role?.message} label="Role">
            <SelectInput {...register('role')}>
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </SelectInput>
          </Field>
        </div>
        <div className="form-grid form-grid--two">
          <Field error={errors.tag?.message} label="Permission tag">
            <SelectInput {...register('tag')}>
              <option value="">No extra tag</option>
              {PERMISSION_TAGS.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field error={errors.redirectUrl?.message} label="Redirect URL">
            <TextInput
              placeholder="https://portal.example.com/admin/students"
              {...register('redirectUrl')}
            />
          </Field>
        </div>
        {inviteUser.error ? (
          <p className="status--error" role="alert">
            {inviteUser.error.message}
          </p>
        ) : null}
        {inviteUser.data ? (
          <p className="status--success">
            Invitation sent. Status: {inviteUser.data.status}
            {inviteUser.data.url ? ` - ${inviteUser.data.url}` : ''}
          </p>
        ) : null}
        <div>
          <Button pending={inviteUser.isPending} type="submit">
            <Send aria-hidden="true" size={16} />
            Send invitation
          </Button>
        </div>
      </div>
    </form>
  );
}

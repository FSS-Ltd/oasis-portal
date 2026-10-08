'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, Send } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { PERMISSION_TAGS, ROLES } from '@oasis/domain';
import { api } from '@/lib/trpc';
import { permissionTagLabel, roleLabel } from '@/lib/profile-display';
import { Button } from '@/components/ui/button';
import { Field, SelectInput, TextInput } from '@/components/ui/field';
import { showErrorToast, showSuccessToast } from '@/lib/notifications';

const schema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  role: z.enum(ROLES),
  tag: z.enum(PERMISSION_TAGS).or(z.literal('')),
});

type FormValues = z.infer<typeof schema>;

export function InviteUserForm() {
  const utils = api.useUtils();
  const inviteUser = api.admin.inviteUser.useMutation({
    async onSuccess() {
      await Promise.all([
        utils.admin.listUsers.invalidate(),
        utils.admin.listUserInvitations.invalidate(),
      ]);
      showSuccessToast('Invitation email sent.');
    },
    onError(error) {
      showErrorToast(error, 'Invitation email could not be sent.');
    },
  });
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
    },
  });

  return (
    <form
      className="panel"
      onSubmit={(event) => {
        void handleSubmit((values) => {
          inviteUser.mutate(
            {
              email: values.email,
              role: values.role,
              tags: values.tag ? [values.tag] : [],
            },
            {
              onSuccess: () => {
                reset({ email: '', role: values.role, tag: '' });
              },
            },
          );
        })(event);
      }}
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
                  {roleLabel(role)}
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
                  {permissionTagLabel(tag)}
                </option>
              ))}
            </SelectInput>
          </Field>
        </div>
        {inviteUser.data ? (
          <div className="invite-result" role="status">
            <div className="invite-result__summary">
              <span className="invite-result__icon">
                <CheckCircle2 aria-hidden="true" />
              </span>
              <div>
                <strong>Invitation email sent</strong>
                <span>The recipient can accept the invite from their inbox.</span>
              </div>
              <span className="badge badge--green">{inviteUser.data.emailStatus}</span>
            </div>
          </div>
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

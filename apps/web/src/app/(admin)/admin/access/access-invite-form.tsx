'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, Clipboard, ExternalLink, Send } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Field, SelectInput, TextInput } from '@/components/ui/field';
import { roleLabel } from '@/lib/profile-display';
import { api } from '@/lib/trpc';
import { ACCESS_INVITE_ROLES } from './access-account-model';

const schema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  role: z.enum(ACCESS_INVITE_ROLES),
  redirectUrl: z.string().trim().url('Enter a valid URL').or(z.literal('')).optional(),
});

type FormValues = z.infer<typeof schema>;

export function AccessInviteForm() {
  const utils = api.useUtils();
  const [copiedInviteUrl, setCopiedInviteUrl] = useState(false);
  const inviteUser = api.admin.inviteUser.useMutation({
    async onSuccess() {
      await utils.admin.listUserAccounts.invalidate();
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
      redirectUrl: '',
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
              tags: [],
              redirectUrl: values.redirectUrl || undefined,
            },
            {
              onSuccess: () => {
                setCopiedInviteUrl(false);
                reset({ email: '', role: values.role, redirectUrl: values.redirectUrl });
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
              {ACCESS_INVITE_ROLES.map((role) => (
                <option key={role} value={role}>
                  {roleLabel(role)}
                </option>
              ))}
            </SelectInput>
          </Field>
        </div>
        <Field error={errors.redirectUrl?.message} label="Redirect URL">
          <TextInput
            placeholder="https://portal.example.com/post-sign-in"
            {...register('redirectUrl')}
          />
        </Field>
        {inviteUser.error ? (
          <p className="status--error" role="alert">
            {inviteUser.error.message}
          </p>
        ) : null}
        {inviteUser.data ? (
          <div className="invite-result" role="status">
            <div className="invite-result__summary">
              <span className="invite-result__icon">
                <CheckCircle2 aria-hidden="true" size={18} />
              </span>
              <div>
                <strong>Invitation sent</strong>
                <span>The invite is ready for the recipient.</span>
              </div>
              <span className="badge badge--green">{inviteUser.data.status}</span>
            </div>
            {inviteUser.data.url ? (
              <div className="invite-result__link-row">
                <code className="invite-result__url">{inviteUser.data.url}</code>
                <div className="invite-result__actions">
                  <Button
                    onClick={() => {
                      void navigator.clipboard.writeText(inviteUser.data.url ?? '').then(() => {
                        setCopiedInviteUrl(true);
                      });
                    }}
                    size="sm"
                    type="button"
                    variant="secondary"
                  >
                    <Clipboard aria-hidden="true" size={14} />
                    {copiedInviteUrl ? 'Copied' : 'Copy'}
                  </Button>
                  <a
                    className="button button--secondary button--sm"
                    href={inviteUser.data.url}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <ExternalLink aria-hidden="true" size={14} />
                    Open
                  </a>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
        <div>
          <Button pending={inviteUser.isPending} type="submit">
            <Send aria-hidden="true" size={16} />
            Send invite
          </Button>
        </div>
      </div>
    </form>
  );
}

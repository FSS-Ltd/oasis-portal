'use client';

import { useState } from 'react';
import { MailPlus } from 'lucide-react';
import { api } from '@/lib/trpc';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Field, TextInput } from '@/components/ui/field';

export function SpouseInvitePanel() {
  const utils = api.useUtils();
  const [email, setEmail] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const inviteStatus = api.profile.spouseInviteStatus.useQuery(undefined, { retry: false });
  const inviteSpouse = api.profile.inviteSpouse.useMutation({
    async onSuccess() {
      setEmail('');
      setFormError(null);
      setSent(true);
      await utils.profile.spouseInviteStatus.invalidate();
    },
  });

  function sendInvite() {
    setSent(false);
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setFormError('Enter an email address.');
      return;
    }
    setFormError(null);
    inviteSpouse.mutate({ email: trimmedEmail });
  }

  if (inviteStatus.isLoading) {
    return <div className="empty-state">Loading spouse invite status...</div>;
  }

  if (inviteStatus.error) {
    return <EmptyState detail={inviteStatus.error.message} title="Spouse invite unavailable" />;
  }

  const status = inviteStatus.data;
  if (!status || status.linkedChildCount === 0) return null;

  if (status.spouseLinked) {
    return (
      <EmptyState
        detail="A parent or spouse account is already linked to this family."
        title="Spouse already linked"
      />
    );
  }

  if (status.pendingInvitation) {
    return (
      <div className="spouse-invite-status">
        <div>
          <strong>{status.pendingInvitation.email}</strong>
          <span>Invite sent for this family.</span>
        </div>
        <Badge tone={status.pendingInvitation.emailStatus === 'Sent' ? 'green' : 'amber'}>
          {status.pendingInvitation.emailStatus}
        </Badge>
      </div>
    );
  }

  return (
    <section className="spouse-invite-form" aria-labelledby="spouse-invite-title">
      <div className="section-title">
        <div>
          <p className="muted">Family access</p>
          <h2 id="spouse-invite-title">Invite Spouse</h2>
        </div>
      </div>
      <div className="spouse-invite-row">
        <Field label="Spouse email" required>
          <TextInput
            autoComplete="email"
            disabled={!status.canInvite || inviteSpouse.isPending}
            onChange={(event) => {
              setEmail(event.target.value);
            }}
            type="email"
            value={email}
          />
        </Field>
        <Button
          disabled={!status.canInvite}
          onClick={sendInvite}
          pending={inviteSpouse.isPending}
          type="button"
        >
          <MailPlus aria-hidden="true" size={16} />
          Send Invite
        </Button>
      </div>
      {sent ? <p className="status--success">Spouse invite sent.</p> : null}
      {formError ? <p className="status--error">{formError}</p> : null}
      {inviteSpouse.error ? <p className="status--error">{inviteSpouse.error.message}</p> : null}
    </section>
  );
}

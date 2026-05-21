'use client';

import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { Mail, MapPin, Phone, Save, UserCheck, UserX } from 'lucide-react';
import { ConfirmationDialog } from '@/components/admin/confirmation-dialog';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, TextInput } from '@/components/ui/field';
import { friendlyErrorMessage, showErrorToast, showSuccessToast } from '@/lib/notifications';
import { roleLabel } from '@/lib/profile-display';
import { api } from '@/lib/trpc';
import {
  accountForm,
  formatAccountDate,
  statusTone,
  type AccessAccount,
} from './access-account-model';

interface AccessAccountPanelProps {
  account: AccessAccount;
  currentUserId: string;
}

export function AccessAccountPanel({ account, currentUserId }: AccessAccountPanelProps) {
  const utils = api.useUtils();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(accountForm(account));
  const [statusAction, setStatusAction] = useState<'deactivate' | 'reactivate' | null>(null);
  const updateProfile = api.admin.updateUserAccountProfile.useMutation({
    async onSuccess() {
      await utils.admin.listUserAccounts.invalidate();
      setEditing(false);
      showSuccessToast('Profile saved.');
    },
    onError(error) {
      showErrorToast(error, 'Profile could not be saved.');
    },
  });
  const updateStatus = api.admin.updateUserAccountStatus.useMutation({
    async onSuccess() {
      await Promise.all([
        utils.admin.listUserAccounts.invalidate(),
        utils.admin.listUsers.invalidate(),
      ]);
      setStatusAction(null);
      showSuccessToast('Account status updated.');
    },
    onError(error) {
      showErrorToast(error, 'Account status could not be updated.');
    },
  });
  const isSelf = account.id === currentUserId;

  useEffect(() => {
    setForm(accountForm(account));
    setEditing(false);
    setStatusAction(null);
  }, [account]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.fullName.trim()) return;
    updateProfile.mutate({
      userId: account.id,
      fullName: form.fullName,
      phone: form.phone,
      address: form.address,
    });
  }

  return (
    <>
      <form className="person-profile person-profile--supervisor" onSubmit={handleSubmit}>
        <section className="profile-hero">
          <Avatar className="profile-hero__avatar" name={account.fullName} />
          <div className="profile-hero__body">
            <div>
              <h2>{account.fullName}</h2>
              <p>{roleLabel(account.role)}</p>
            </div>
            <div className="profile-hero__badges">
              <span>{roleLabel(account.role)}</span>
              <span>{account.active ? 'Active' : 'Inactive'}</span>
              <span>Joined {formatAccountDate(account.createdAt)}</span>
            </div>
          </div>
          <div className="profile-hero__actions">
            {editing ? (
              <>
                <Button
                  onClick={() => {
                    setForm(accountForm(account));
                    setEditing(false);
                  }}
                  type="button"
                  variant="secondary"
                >
                  Cancel
                </Button>
                <Button pending={updateProfile.isPending} type="submit">
                  <Save aria-hidden="true" size={16} />
                  Save
                </Button>
              </>
            ) : (
              <Button
                onClick={() => {
                  setEditing(true);
                }}
                type="button"
                variant="secondary"
              >
                Edit Profile
              </Button>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel__body form-grid">
            <div className="form-grid form-grid--two">
              <Field label="Full name">
                <TextInput
                  disabled={!editing}
                  onChange={(event) => {
                    setForm((current) => ({ ...current, fullName: event.target.value }));
                  }}
                  value={form.fullName}
                />
              </Field>
              <Field label="Account email">
                <TextInput disabled type="email" value={account.email} />
              </Field>
            </div>
            <div className="form-grid form-grid--two">
              <Field label="Phone">
                <TextInput
                  disabled={!editing}
                  onChange={(event) => {
                    setForm((current) => ({ ...current, phone: event.target.value }));
                  }}
                  type="tel"
                  value={form.phone}
                />
              </Field>
              <Field label="Address">
                <TextInput
                  disabled={!editing}
                  onChange={(event) => {
                    setForm((current) => ({ ...current, address: event.target.value }));
                  }}
                  value={form.address}
                />
              </Field>
            </div>
            <div className="profile-field-list">
              <div className="profile-field-row">
                <span>Role</span>
                <strong>{roleLabel(account.role)}</strong>
              </div>
              <div className="profile-field-row">
                <span>Status</span>
                <Badge tone={statusTone(account.active)}>
                  {account.active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <div className="profile-field-row">
                <span>Updated</span>
                <strong>{formatAccountDate(account.updatedAt)}</strong>
              </div>
            </div>
            <div className="profile-contact-strip">
              <span>
                <Mail aria-hidden="true" size={15} />
                {account.email}
              </span>
              <span>
                <Phone aria-hidden="true" size={15} />
                {account.phone ?? 'No phone recorded'}
              </span>
              <span>
                <MapPin aria-hidden="true" size={15} />
                {account.address ?? 'No address recorded'}
              </span>
            </div>
            {updateProfile.error ? (
              <p className="status--error" role="alert">
                {friendlyErrorMessage(updateProfile.error)}
              </p>
            ) : null}
          </div>
        </section>

        <section className="panel">
          <div className="panel__body form-grid">
            <div className="section-title">
              <div>
                <h2>Account status</h2>
                <p className="muted">Control whether this person can sign in.</p>
              </div>
            </div>
            <div className="lifecycle-actions">
              {account.active ? (
                <Button
                  disabled={isSelf}
                  onClick={() => {
                    setStatusAction('deactivate');
                  }}
                  pending={updateStatus.isPending}
                  type="button"
                  variant="danger"
                >
                  <UserX aria-hidden="true" size={16} />
                  Deactivate
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    setStatusAction('reactivate');
                  }}
                  pending={updateStatus.isPending}
                  type="button"
                  variant="secondary"
                >
                  <UserCheck aria-hidden="true" size={16} />
                  Reactivate
                </Button>
              )}
            </div>
            {isSelf && account.active ? (
              <p className="muted">Your own account cannot be deactivated here.</p>
            ) : null}
            {updateStatus.error ? (
              <p className="status--error" role="alert">
                {friendlyErrorMessage(updateStatus.error)}
              </p>
            ) : null}
          </div>
        </section>
      </form>
      <ConfirmationDialog
        confirmLabel={statusAction === 'deactivate' ? 'Deactivate account' : 'Reactivate account'}
        errorMessage={updateStatus.error ? friendlyErrorMessage(updateStatus.error) : undefined}
        onCancel={() => {
          if (!updateStatus.isPending) setStatusAction(null);
        }}
        onConfirm={() => {
          if (!statusAction) return;
          updateStatus.mutate({ userId: account.id, active: statusAction === 'reactivate' });
        }}
        open={statusAction !== null}
        pending={updateStatus.isPending}
        title={
          statusAction === 'deactivate'
            ? `Deactivate ${account.fullName}?`
            : `Reactivate ${account.fullName}?`
        }
        variant={statusAction === 'reactivate' ? 'primary' : 'danger'}
      >
        <p>
          {statusAction === 'deactivate'
            ? 'This will stop the account from signing in while preserving audit history and linked records.'
            : 'This will allow the account to sign in again if their Clerk access is valid.'}
        </p>
      </ConfirmationDialog>
    </>
  );
}

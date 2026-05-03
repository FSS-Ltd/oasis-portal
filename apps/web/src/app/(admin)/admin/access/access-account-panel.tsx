'use client';

import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { Mail, MapPin, Phone, Save, Trash2, UserCheck, UserX } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { Field, TextInput } from '@/components/ui/field';
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
  canDeleteAccounts: boolean;
  currentUserId: string;
}

export function AccessAccountPanel({
  account,
  canDeleteAccounts,
  currentUserId,
}: AccessAccountPanelProps) {
  const utils = api.useUtils();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(accountForm(account));
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const updateProfile = api.admin.updateUserAccountProfile.useMutation({
    async onSuccess() {
      await utils.admin.listUserAccounts.invalidate();
      setEditing(false);
    },
  });
  const updateStatus = api.admin.updateUserAccountStatus.useMutation({
    async onSuccess() {
      await utils.admin.listUserAccounts.invalidate();
    },
  });
  const deleteAccount = api.admin.deleteUserAccount.useMutation({
    async onSuccess() {
      await Promise.all([
        utils.admin.listUserAccounts.invalidate(),
        utils.admin.listUsers.invalidate(),
      ]);
      setDeleteOpen(false);
      setDeleteConfirmation('');
    },
  });
  const isSelf = account.id === currentUserId;

  useEffect(() => {
    setForm(accountForm(account));
    setEditing(false);
    setDeleteOpen(false);
    setDeleteConfirmation('');
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
                {updateProfile.error.message}
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
            <div className="profile-hero__actions">
              {account.active ? (
                <Button
                  disabled={isSelf}
                  onClick={() => {
                    updateStatus.mutate({ userId: account.id, active: false });
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
                    updateStatus.mutate({ userId: account.id, active: true });
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
                {updateStatus.error.message}
              </p>
            ) : null}
          </div>
        </section>

        {canDeleteAccounts ? (
          <section className="panel">
            <div className="panel__body form-grid">
              <div className="section-title">
                <div>
                  <h2>Delete account</h2>
                  <p className="muted">Remove sign-in access and scrub local profile data.</p>
                </div>
              </div>
              <div className="profile-hero__actions">
                <Button
                  disabled={isSelf}
                  onClick={() => {
                    setDeleteOpen(true);
                  }}
                  type="button"
                  variant="danger"
                >
                  <Trash2 aria-hidden="true" size={16} />
                  Delete Account
                </Button>
              </div>
              {isSelf ? <p className="muted">Your own account cannot be deleted here.</p> : null}
            </div>
          </section>
        ) : null}
      </form>
      {deleteOpen ? (
        <ConfirmationDialog
          body={
            <>
              <p>
                This will delete sign-in access for <strong>{account.fullName}</strong>, scrub local
                profile PII, and keep historical audit references intact.
              </p>
              <p>This cannot be restored from the portal.</p>
            </>
          }
          confirmLabel="Delete Account"
          confirmation={deleteConfirmation}
          errorMessage={deleteAccount.error?.message}
          expectedConfirmation="DELETE"
          onCancel={() => {
            setDeleteOpen(false);
            setDeleteConfirmation('');
          }}
          onConfirm={() => {
            deleteAccount.mutate({ userId: account.id, confirmation: 'DELETE' });
          }}
          onConfirmationChange={setDeleteConfirmation}
          pending={deleteAccount.isPending}
          title="Delete User Account"
        />
      ) : null}
    </>
  );
}

'use client';

import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { Mail, MapPin, Phone, Save, ShieldCheck, UserCheck, UserX } from 'lucide-react';
import { ADULT_USER_ACCOUNT_ROLES, PERMISSION_TAGS, type PermissionTag } from '@oasis/domain';
import { ConfirmationDialog } from '@/components/admin/confirmation-dialog';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, SelectInput, TextInput } from '@/components/ui/field';
import { friendlyErrorMessage, showErrorToast, showSuccessToast } from '@/lib/notifications';
import { permissionTagLabel, roleLabel } from '@/lib/profile-display';
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

function toPermissionTags(tags: readonly string[]): PermissionTag[] {
  return PERMISSION_TAGS.filter((tag) => tags.includes(tag));
}

function togglePermissionTag(tags: readonly string[], tag: PermissionTag): PermissionTag[] {
  const next = new Set(tags);
  if (next.has(tag)) {
    next.delete(tag);
  } else {
    next.add(tag);
  }
  return toPermissionTags([...next]);
}

function isAdultUserAccountRole(value: string): value is (typeof ADULT_USER_ACCOUNT_ROLES)[number] {
  return ADULT_USER_ACCOUNT_ROLES.some((role) => role === value);
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
  const updateRole = api.admin.updateUserRole.useMutation({
    async onSuccess() {
      await utils.admin.listUserAccounts.invalidate();
      showSuccessToast('Role updated.');
    },
    onError(error) {
      showErrorToast(error, 'Role could not be updated.');
    },
  });
  const updateTags = api.admin.updateUserTags.useMutation({
    async onSuccess() {
      await Promise.all([
        utils.admin.listUserAccounts.invalidate(),
        utils.admin.listUsers.invalidate(),
      ]);
      showSuccessToast('Permission tags updated.');
    },
    onError(error) {
      showErrorToast(error, 'Permission tags could not be updated.');
    },
  });
  const isSelf = account.id === currentUserId;
  const roleOptions = isAdultUserAccountRole(account.role)
    ? ADULT_USER_ACCOUNT_ROLES
    : [account.role, ...ADULT_USER_ACCOUNT_ROLES];

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

  function handleRoleChange(value: string) {
    if (!isAdultUserAccountRole(value)) return;
    updateRole.mutate({ userId: account.id, role: value });
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
                {isSelf ? (
                  <strong>{roleLabel(account.role)}</strong>
                ) : (
                  <SelectInput
                    disabled={updateRole.isPending}
                    onChange={(event) => {
                      handleRoleChange(event.target.value);
                    }}
                    value={account.role}
                  >
                    {roleOptions.map((role) => (
                      <option disabled={!isAdultUserAccountRole(role)} key={role} value={role}>
                        {roleLabel(role)}
                      </option>
                    ))}
                  </SelectInput>
                )}
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
            {updateRole.error ? (
              <p className="status--error" role="alert">
                {friendlyErrorMessage(updateRole.error)}
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
                  Deactivate account
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
                  Reactivate account
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

        <section className="panel">
          <div className="panel__body form-grid">
            <div className="section-title">
              <div>
                <h2>Permission tags</h2>
                <p className="muted">Grant or revoke operational access without changing role.</p>
              </div>
            </div>
            <div className="tag-toggle-list">
              {PERMISSION_TAGS.map((tag) => {
                const checked = account.tags.includes(tag);
                return (
                  <label className={checked ? 'tag-toggle is-checked' : 'tag-toggle'} key={tag}>
                    <input
                      checked={checked}
                      disabled={!account.active || updateTags.isPending}
                      onChange={() => {
                        updateTags.mutate({
                          userId: account.id,
                          tags: togglePermissionTag(account.tags, tag),
                        });
                      }}
                      type="checkbox"
                    />
                    <ShieldCheck aria-hidden="true" size={14} />
                    <span>{permissionTagLabel(tag)}</span>
                  </label>
                );
              })}
            </div>
            {!account.active ? (
              <p className="muted">Reactivate the account before changing permission tags.</p>
            ) : null}
            {updateTags.error ? (
              <p className="status--error" role="alert">
                {friendlyErrorMessage(updateTags.error)}
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

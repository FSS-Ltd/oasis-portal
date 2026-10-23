'use client';

import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Mail, MapPin, Phone, Save, ShieldCheck } from 'lucide-react';
import {
  ADULT_USER_ACCOUNT_ROLES,
  PERMISSION_TAGS,
  canAssignPermissionTag,
  displaySchoolYearLabel,
  type Role,
} from '@oasis/domain';
import { api } from '@/lib/trpc';
import { friendlyErrorMessage, showErrorToast, showSuccessToast } from '@/lib/notifications';
import { permissionTagLabel, personTypeLabel, roleLabel } from '@/lib/profile-display';
import { AccountAccessPanel } from './account-access-panel';
import { Avatar } from '@/components/ui/avatar';
import type { AdultComplianceBadgeSummary } from '@oasis/domain';
import { ComplianceBadges } from '@/components/compliance/compliance-badges';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Field, SelectInput, TextInput } from '@/components/ui/field';
import { StaffAttendanceHistoryPanel } from './attendance-history-panel';
import {
  childLabel,
  statusTone,
  toggleTag,
  userForm,
  userTabs,
  type UserProfileTab,
  type UserRow,
} from './people-profile-model';

interface UserProfilePanelProps {
  complianceSummary: AdultComplianceBadgeSummary | null;
  currentUserId: string;
  currentUserRole: Role;
  kind: 'parent' | 'supervisor';
  onAccountAccessChanged: () => void;
  user: UserRow;
}

type AdultUserAccountRole = (typeof ADULT_USER_ACCOUNT_ROLES)[number];

function canShowChildrenTab(kind: 'parent' | 'supervisor', linkedChildCount: number): boolean {
  return kind === 'parent' || linkedChildCount > 0;
}

function isAdultUserAccountRole(value: string): value is AdultUserAccountRole {
  return ADULT_USER_ACCOUNT_ROLES.some((role) => role === value);
}

function canChangeUserRole(currentUserRole: Role, isSelf: boolean): boolean {
  return currentUserRole === 'Head' && !isSelf;
}

export function UserProfilePanel({
  complianceSummary,
  currentUserId,
  currentUserRole,
  kind,
  onAccountAccessChanged,
  user,
}: UserProfilePanelProps) {
  const utils = api.useUtils();
  const [activeTab, setActiveTab] = useState<UserProfileTab>('personal');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(userForm(user));
  const updateUser = api.admin.updateUserProfile.useMutation({
    async onSuccess() {
      await utils.admin.listUsers.invalidate();
      setEditing(false);
      showSuccessToast('Profile saved.');
    },
    onError(error) {
      showErrorToast(error, 'Profile could not be saved.');
    },
  });
  const updateTags = api.admin.updateUserTags.useMutation({
    async onSuccess() {
      await utils.admin.listUsers.invalidate();
      showSuccessToast('Permission tags updated.');
    },
    onError(error) {
      showErrorToast(error, 'Permission tags could not be updated.');
    },
  });
  const updateRole = api.admin.updateUserRole.useMutation({
    async onSuccess() {
      await utils.admin.listUsers.invalidate();
      showSuccessToast('Role updated.');
    },
    onError(error) {
      showErrorToast(error, 'Role could not be updated.');
    },
  });
  const isSelf = user.id === currentUserId;
  const canChangeRole = canChangeUserRole(currentUserRole, isSelf);
  const visibleTabs = userTabs[kind].filter(
    (tab) => tab.id !== 'children' || canShowChildrenTab(kind, user.children.length),
  );

  useEffect(() => {
    setForm(userForm(user));
    setEditing(false);
    setActiveTab('personal');
  }, [user]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.fullName.trim() || !form.email.trim()) return;
    updateUser.mutate({
      userId: user.id,
      fullName: form.fullName,
      email: currentUserRole === 'Head' ? form.email : undefined,
      dob: kind === 'supervisor' ? form.dob || null : undefined,
      phone: form.phone,
      address: form.address,
    });
  }

  function handleRoleChange(value: string) {
    if (!isAdultUserAccountRole(value)) return;
    updateRole.mutate({ userId: user.id, role: value });
  }

  return (
    <>
      <form className={`person-profile person-profile--${kind}`} onSubmit={handleSubmit}>
        <section className="profile-hero">
          <Avatar className="profile-hero__avatar" name={user.fullName} />
          <div className="profile-hero__body">
            <div>
              <div className="profile-hero__identity">
                <h2>{user.fullName}</h2>
                <ComplianceBadges summary={complianceSummary} />
              </div>
              <p>{kind === 'parent' ? 'Parent / Guardian' : roleLabel(user.role)}</p>
            </div>
            <div className="profile-hero__badges">
              <span>{personTypeLabel(kind)}</span>
              <span>{user.active ? 'Active' : 'Inactive'}</span>
              {kind === 'parent' ? <span>{childLabel(user.children.length)}</span> : null}
              {kind === 'supervisor'
                ? user.tags.map((tag) => <span key={tag}>{permissionTagLabel(tag)}</span>)
                : null}
            </div>
          </div>
          <div className="profile-hero__actions">
            {editing ? (
              <>
                <Button
                  onClick={() => {
                    setForm(userForm(user));
                    setEditing(false);
                  }}
                  type="button"
                  variant="secondary"
                >
                  Cancel
                </Button>
                <Button pending={updateUser.isPending} type="submit">
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

        <div className="profile-tabs" role="tablist">
          {visibleTabs.map((tab) => (
            <button
              aria-selected={activeTab === tab.id}
              className={activeTab === tab.id ? 'is-selected' : undefined}
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
              }}
              role="tab"
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'personal' ? (
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
                  <TextInput
                    disabled={!editing || currentUserRole !== 'Head'}
                    onChange={(event) => {
                      setForm((current) => ({ ...current, email: event.target.value }));
                    }}
                    type="email"
                    value={form.email}
                  />
                </Field>
              </div>
              <div className="profile-field-list">
                {kind === 'supervisor' ? (
                  <Field label="Date of birth">
                    <TextInput
                      disabled={!editing}
                      onChange={(event) => {
                        setForm((current) => ({ ...current, dob: event.target.value }));
                      }}
                      type="date"
                      value={form.dob}
                    />
                  </Field>
                ) : null}
                <Field label="Role">
                  {canChangeRole ? (
                    <SelectInput
                      disabled={updateRole.isPending}
                      onChange={(event) => {
                        handleRoleChange(event.target.value);
                      }}
                      value={user.role}
                    >
                      {ADULT_USER_ACCOUNT_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {roleLabel(role)}
                        </option>
                      ))}
                    </SelectInput>
                  ) : (
                    <TextInput disabled value={roleLabel(user.role)} />
                  )}
                </Field>
                <div className="profile-field-row">
                  <span>Status</span>
                  <Badge tone={statusTone(user.active)}>
                    {user.active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                {updateRole.error ? (
                  <p className="status--error" role="alert">
                    {friendlyErrorMessage(updateRole.error)}
                  </p>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        {activeTab === 'role' && kind === 'supervisor' ? (
          <section className="panel">
            <div className="panel__body form-grid">
              <div className="profile-field-list">
                <div className="profile-field-row">
                  <span>Role</span>
                  {canChangeRole ? (
                    <SelectInput
                      disabled={updateRole.isPending}
                      onChange={(event) => {
                        handleRoleChange(event.target.value);
                      }}
                      value={user.role}
                    >
                      {ADULT_USER_ACCOUNT_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {roleLabel(role)}
                        </option>
                      ))}
                    </SelectInput>
                  ) : (
                    <strong>{roleLabel(user.role)}</strong>
                  )}
                </div>
                <div className="profile-field-row profile-field-row--stacked">
                  <span>Permission tags</span>
                  <div className="tag-toggle-list">
                    {PERMISSION_TAGS.filter((tag) => canAssignPermissionTag(user.role, tag)).map(
                      (tag) => {
                        const checked = user.tags.includes(tag);
                        return (
                          <label
                            className={checked ? 'tag-toggle is-checked' : 'tag-toggle'}
                            key={tag}
                          >
                            <input
                              checked={checked}
                              disabled={
                                (user.role === 'SafeguardingLead' && tag !== 'compliance-admin') ||
                                updateTags.isPending
                              }
                              onChange={() => {
                                updateTags.mutate({
                                  userId: user.id,
                                  tags: toggleTag(user.tags, tag),
                                });
                              }}
                              type="checkbox"
                            />
                            <ShieldCheck aria-hidden="true" size={14} />
                            <span>{permissionTagLabel(tag)}</span>
                          </label>
                        );
                      },
                    )}
                  </div>
                </div>
              </div>
              {updateTags.error ? (
                <p className="status--error" role="alert">
                  {friendlyErrorMessage(updateTags.error)}
                </p>
              ) : null}
              {updateRole.error ? (
                <p className="status--error" role="alert">
                  {friendlyErrorMessage(updateRole.error)}
                </p>
              ) : null}
            </div>
          </section>
        ) : null}

        {activeTab === 'contact' ? (
          <section className="panel">
            <div className="panel__body form-grid">
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
              <div className="profile-contact-strip">
                <span>
                  <Mail aria-hidden="true" size={15} />
                  {user.email}
                </span>
                <span>
                  <Phone aria-hidden="true" size={15} />
                  {user.phone ?? 'No phone recorded'}
                </span>
                <span>
                  <MapPin aria-hidden="true" size={15} />
                  {user.address ?? 'No address recorded'}
                </span>
              </div>
              {updateUser.error ? (
                <p className="status--error" role="alert">
                  {friendlyErrorMessage(updateUser.error)}
                </p>
              ) : null}
            </div>
          </section>
        ) : null}

        {activeTab === 'children' && canShowChildrenTab(kind, user.children.length) ? (
          <section className="panel">
            <div className="panel__body people-linked-list">
              {user.children.length === 0 ? (
                <EmptyState
                  detail={`Link this ${kind === 'parent' ? 'parent' : 'account'} from a student profile.`}
                  title="No children linked"
                />
              ) : (
                user.children.map((child) => (
                  <Link
                    className="people-linked-row"
                    href={`/admin/students/${child.id}`}
                    key={child.id}
                  >
                    <Avatar name={child.fullName} />
                    <span>
                      <strong>{child.fullName}</strong>
                      <small>{displaySchoolYearLabel(child.yearGroup)}</small>
                    </span>
                    <Badge tone={statusTone(child.active)}>
                      {child.active ? 'Active' : 'Archived'}
                    </Badge>
                  </Link>
                ))
              )}
            </div>
          </section>
        ) : null}

        {activeTab === 'attendance' && kind === 'supervisor' ? (
          <StaffAttendanceHistoryPanel staffUserId={user.id} />
        ) : null}

        <AccountAccessPanel
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          key={user.id}
          onAccessChanged={onAccountAccessChanged}
          user={user}
        />
      </form>
    </>
  );
}

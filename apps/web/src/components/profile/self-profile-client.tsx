'use client';

import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { Save, ShieldCheck } from 'lucide-react';
import { api, type RouterOutputs } from '@/lib/trpc';
import { roleLabel, permissionTagLabel } from '@/lib/profile-display';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Field, TextInput } from '@/components/ui/field';

type Profile = RouterOutputs['profile']['me'];
type ProfileTab = 'account' | 'access' | 'security';

interface SelfProfileClientProps {
  accent?: 'crimson' | 'navy';
}

const tabs: readonly { id: ProfileTab; label: string }[] = [
  { id: 'account', label: 'My Account' },
  { id: 'access', label: 'Role & Access' },
  { id: 'security', label: 'Security' },
];

function profileForm(profile: Profile) {
  return {
    fullName: profile.fullName,
    email: profile.email,
    phone: profile.phone ?? '',
    address: profile.address ?? '',
  };
}

function formatDate(value: Date | string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

export function SelfProfileClient({ accent = 'navy' }: SelfProfileClientProps) {
  const [activeTab, setActiveTab] = useState<ProfileTab>('account');
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', address: '' });
  const utils = api.useUtils();
  const profileQuery = api.profile.me.useQuery(undefined, { retry: false });
  const updateProfile = api.profile.updateMe.useMutation({
    async onSuccess() {
      await utils.profile.me.invalidate();
      setEditing(false);
      setSaved(true);
      window.setTimeout(() => {
        setSaved(false);
      }, 2500);
    },
  });

  useEffect(() => {
    if (!profileQuery.data) return;
    setForm(profileForm(profileQuery.data));
  }, [profileQuery.data]);

  if (profileQuery.isLoading) {
    return <div className="empty-state">Loading profile...</div>;
  }

  if (profileQuery.error || !profileQuery.data) {
    return (
      <EmptyState
        detail={profileQuery.error?.message ?? 'Your profile could not be loaded.'}
        title="Profile unavailable"
      />
    );
  }

  const profile = profileQuery.data;
  const canSubmit = editing && form.fullName.trim().length > 0 && form.email.trim().length > 0;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    updateProfile.mutate({
      fullName: form.fullName,
      email: form.email,
      phone: form.phone,
      address: form.address,
    });
  }

  return (
    <form className={`self-profile self-profile--${accent}`} onSubmit={handleSubmit}>
      <section className="profile-hero">
        <Avatar className="profile-hero__avatar" name={profile.fullName} />
        <div className="profile-hero__body">
          <div>
            <h1>{profile.fullName}</h1>
            <p>{roleLabel(profile.role)} · Oasis Learning Centre</p>
          </div>
          <div className="profile-hero__badges">
            <span>{profile.active ? 'Active' : 'Inactive'}</span>
            {profile.requires2fa ? <span>2FA Active</span> : null}
            {profile.tags.map((tag) => (
              <span key={tag}>{permissionTagLabel(tag)}</span>
            ))}
          </div>
        </div>
        <div className="profile-hero__actions">
          {editing ? (
            <>
              <Button
                onClick={() => {
                  setForm(profileForm(profile));
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
          {saved ? <Badge tone="green">Saved</Badge> : null}
        </div>
      </section>

      <div className="profile-tabs" role="tablist">
        {tabs.map((tab) => (
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

      {activeTab === 'account' ? (
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
                  disabled={!editing}
                  onChange={(event) => {
                    setForm((current) => ({ ...current, email: event.target.value }));
                  }}
                  type="email"
                  value={form.email}
                />
              </Field>
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
            {updateProfile.error ? (
              <p className="status--error" role="alert">
                {updateProfile.error.message}
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      {activeTab === 'access' ? (
        <section className="panel">
          <div className="panel__body profile-field-list">
            <div className="profile-field-row">
              <span>Role</span>
              <strong>{roleLabel(profile.role)}</strong>
            </div>
            <div className="profile-field-row">
              <span>Status</span>
              <strong>{profile.active ? 'Active' : 'Inactive'}</strong>
            </div>
            <div className="profile-field-row profile-field-row--stacked">
              <span>Permission tags</span>
              <div className="badge-list">
                {profile.tags.length > 0 ? (
                  profile.tags.map((tag) => <Badge key={tag}>{permissionTagLabel(tag)}</Badge>)
                ) : (
                  <span className="muted">No permission tags assigned</span>
                )}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === 'security' ? (
        <section className="panel">
          <div className="panel__body profile-field-list">
            <div className="profile-field-row">
              <span>Two-factor authentication</span>
              <strong>{profile.requires2fa ? 'Active' : 'Managed by sign-in provider'}</strong>
            </div>
            <div className="profile-field-row">
              <span>Account email</span>
              <strong>{profile.email}</strong>
            </div>
            <div className="profile-field-row">
              <span>Profile created</span>
              <strong>{formatDate(profile.createdAt)}</strong>
            </div>
            <div className="profile-field-row">
              <span>Last updated</span>
              <strong>{formatDate(profile.updatedAt)}</strong>
            </div>
            <div className="profile-security-note">
              <ShieldCheck aria-hidden="true" size={18} />
              <span>Password and sign-in methods are managed through Clerk.</span>
            </div>
          </div>
        </section>
      ) : null}
    </form>
  );
}

'use client';

import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Mail, MapPin, Phone, Save, ShieldCheck } from 'lucide-react';
import { PERMISSION_TAGS } from '@oasis/domain';
import { api } from '@/lib/trpc';
import { permissionTagLabel, personTypeLabel, roleLabel } from '@/lib/profile-display';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Field, TextInput } from '@/components/ui/field';
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
  kind: 'parent' | 'supervisor';
  user: UserRow;
}

export function UserProfilePanel({ kind, user }: UserProfilePanelProps) {
  const utils = api.useUtils();
  const [activeTab, setActiveTab] = useState<UserProfileTab>('personal');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(userForm(user));
  const updateUser = api.admin.updateUserProfile.useMutation({
    async onSuccess() {
      await utils.admin.listUsers.invalidate();
      setEditing(false);
    },
  });
  const updateTags = api.admin.updateUserTags.useMutation({
    async onSuccess() {
      await utils.admin.listUsers.invalidate();
    },
  });

  useEffect(() => {
    setForm(userForm(user));
    setEditing(false);
    setActiveTab('personal');
  }, [user]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.fullName.trim()) return;
    updateUser.mutate({
      userId: user.id,
      fullName: form.fullName,
      phone: form.phone,
      address: form.address,
    });
  }

  return (
    <form className={`person-profile person-profile--${kind}`} onSubmit={handleSubmit}>
      <section className="profile-hero">
        <Avatar className="profile-hero__avatar" name={user.fullName} />
        <div className="profile-hero__body">
          <div>
            <h2>{user.fullName}</h2>
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
        {userTabs[kind].map((tab) => (
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
                <TextInput disabled type="email" value={user.email} />
              </Field>
            </div>
            <div className="profile-field-list">
              <div className="profile-field-row">
                <span>Role</span>
                <strong>{roleLabel(user.role)}</strong>
              </div>
              <div className="profile-field-row">
                <span>Status</span>
                <Badge tone={statusTone(user.active)}>{user.active ? 'Active' : 'Inactive'}</Badge>
              </div>
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
                <strong>{roleLabel(user.role)}</strong>
              </div>
              <div className="profile-field-row profile-field-row--stacked">
                <span>Permission tags</span>
                <div className="tag-toggle-list">
                  {PERMISSION_TAGS.map((tag) => {
                    const checked = user.tags.includes(tag);
                    return (
                      <label className={checked ? 'tag-toggle is-checked' : 'tag-toggle'} key={tag}>
                        <input
                          checked={checked}
                          disabled={updateTags.isPending}
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
                  })}
                </div>
              </div>
            </div>
            {updateTags.error ? (
              <p className="status--error" role="alert">
                {updateTags.error.message}
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
                {updateUser.error.message}
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      {activeTab === 'children' && kind === 'parent' ? (
        <section className="panel">
          <div className="panel__body people-linked-list">
            {user.children.length === 0 ? (
              <EmptyState detail="Link this parent from a student profile." title="No children linked" />
            ) : (
              user.children.map((child) => (
                <Link className="people-linked-row" href={`/admin/students/${child.id}`} key={child.id}>
                  <Avatar name={child.fullName} />
                  <span>
                    <strong>{child.fullName}</strong>
                    <small>{child.yearGroup}</small>
                  </span>
                  <Badge tone={statusTone(child.active)}>{child.active ? 'Active' : 'Inactive'}</Badge>
                </Link>
              ))
            )}
          </div>
        </section>
      ) : null}
    </form>
  );
}

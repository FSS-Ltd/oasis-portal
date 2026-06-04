'use client';

import { type FormEvent, useMemo, useState } from 'react';
import { Bell, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Field, SelectInput, TextInput } from '@/components/ui/field';
import {
  friendlyErrorMessage,
  showErrorToast,
  showSuccessToast,
} from '@/lib/notifications';
import { api } from '@/lib/trpc';

const audiences = [
  { value: 'All', label: 'All students' },
  { value: 'Primary', label: 'Primary' },
  { value: 'Secondary', label: 'Secondary' },
  { value: 'Student', label: 'Individual student' },
] as const;

type Audience = (typeof audiences)[number]['value'];

const emptyForm = {
  audience: 'All' as Audience,
  studentId: '',
  title: '',
  body: '',
};

export function StudentNotificationAdminClient() {
  const utils = api.useUtils();
  const [form, setForm] = useState(emptyForm);
  const students = api.student.list.useQuery(
    { includeInactive: false },
    { enabled: form.audience === 'Student', retry: false },
  );
  const studentOptions = useMemo(() => students.data ?? [], [students.data]);
  const announce = api.studentNotification.announce.useMutation({
    async onSuccess(result) {
      showSuccessToast(`Announcement sent to ${String(result.recipientCount)} students.`);
      setForm((current) => ({ ...current, title: '', body: '' }));
      await utils.studentNotification.invalidate();
    },
    onError(error) {
      showErrorToast(error, 'Announcement could not be sent.');
    },
  });

  function updateField(field: keyof typeof emptyForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    announce.mutate({
      audience: form.audience,
      title: form.title,
      body: form.body,
      ...(form.audience === 'Student' ? { studentId: form.studentId } : {}),
    });
  }

  return (
    <div className="student-notification-admin-page">
      <section className="dashboard-hero">
        <p>Student portal</p>
        <h1>Student notifications</h1>
        <span>Send Learning Centre announcements into student notification centres.</span>
      </section>

      <div className="student-notification-admin-layout">
        <section
          className="panel panel__body student-notification-admin-form"
          aria-labelledby="student-notification-form-title"
        >
          <div className="panel__header">
            <div>
              <p className="eyebrow">Announcement</p>
              <h2 id="student-notification-form-title">Send update</h2>
            </div>
            <Send aria-hidden="true" size={20} />
          </div>

          <form onSubmit={submit}>
            <Field label="Audience" required>
              <SelectInput
                onChange={(event) => {
                  updateField('audience', event.target.value);
                  if (event.target.value !== 'Student') updateField('studentId', '');
                }}
                required
                value={form.audience}
              >
                {audiences.map((audience) => (
                  <option key={audience.value} value={audience.value}>
                    {audience.label}
                  </option>
                ))}
              </SelectInput>
            </Field>

            {form.audience === 'Student' ? (
              <Field label="Student" required>
                <SelectInput
                  disabled={students.isLoading}
                  onChange={(event) => {
                    updateField('studentId', event.target.value);
                  }}
                  required
                  value={form.studentId}
                >
                  <option value="">Select a student</option>
                  {studentOptions.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.fullName}
                    </option>
                  ))}
                </SelectInput>
              </Field>
            ) : null}

            <Field label="Title" required>
              <TextInput
                maxLength={120}
                onChange={(event) => {
                  updateField('title', event.target.value);
                }}
                required
                value={form.title}
              />
            </Field>
            <Field label="Message" required>
              <textarea
                className="input student-notification-admin-textarea"
                maxLength={1000}
                onChange={(event) => {
                  updateField('body', event.target.value);
                }}
                required
                rows={6}
                value={form.body}
              />
            </Field>
            {students.error && form.audience === 'Student' ? (
              <p className="status--error">{friendlyErrorMessage(students.error)}</p>
            ) : null}
            <Button pending={announce.isPending} type="submit">
              Send announcement
            </Button>
          </form>
        </section>

        <section
          className="panel panel__body student-notification-admin-preview"
          aria-labelledby="student-notification-preview-title"
        >
          <div className="panel__header">
            <div>
              <p className="eyebrow">Student view</p>
              <h2 id="student-notification-preview-title">Preview</h2>
            </div>
            <Bell aria-hidden="true" size={20} />
          </div>
          {form.title.trim().length === 0 && form.body.trim().length === 0 ? (
            <EmptyState detail="Draft text appears here before sending." title="No draft yet" />
          ) : (
            <article className="student-notification-admin-preview-card">
              <span>Announcement</span>
              <h3>{form.title || 'Announcement title'}</h3>
              <p>{form.body || 'Announcement message'}</p>
            </article>
          )}
        </section>
      </div>
    </div>
  );
}

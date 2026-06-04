'use client';

import { type FormEvent, useEffect, useState } from 'react';
import { BookOpenText, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Field, TextInput } from '@/components/ui/field';
import { friendlyErrorMessage, showErrorToast, showSuccessToast } from '@/lib/notifications';
import { api } from '@/lib/trpc';

const emptyForm = {
  weeklyTheme: '',
  memoryVerseReference: '',
  memoryVerseText: '',
  reflectionPrompt: '',
  verseOfDayReference: '',
  verseOfDayText: '',
};

type FaithCornerForm = typeof emptyForm;

function formatDate(value: Date | null): string {
  if (!value) return 'Not published yet';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(value);
}

export function FaithCornerAdminClient() {
  const utils = api.useUtils();
  const current = api.faithCorner.currentForAdmin.useQuery(undefined, { retry: false });
  const [form, setForm] = useState<FaithCornerForm>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!current.data?.ready || !current.data.memoryVerse) return;
    setForm({
      weeklyTheme: current.data.weeklyTheme,
      memoryVerseReference: current.data.memoryVerse.reference,
      memoryVerseText: current.data.memoryVerse.text,
      reflectionPrompt: current.data.reflectionPrompt ?? '',
      verseOfDayReference: current.data.verseOfDay?.reference ?? '',
      verseOfDayText: current.data.verseOfDay?.text ?? '',
    });
  }, [current.data]);

  const publish = api.faithCorner.publish.useMutation({
    async onSuccess() {
      setFormError(null);
      showSuccessToast('Faith Corner published.');
      await utils.faithCorner.currentForAdmin.invalidate();
    },
    onError(error) {
      showErrorToast(error, 'Faith Corner could not be published.');
    },
  });

  function updateField(field: keyof FaithCornerForm, value: string) {
    setForm((currentForm) => ({ ...currentForm, [field]: value }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const hasVerseReference = form.verseOfDayReference.trim().length > 0;
    const hasVerseText = form.verseOfDayText.trim().length > 0;
    if (hasVerseReference !== hasVerseText) {
      setFormError('Verse of the day reference and text must be provided together.');
      return;
    }

    publish.mutate({
      weeklyTheme: form.weeklyTheme,
      memoryVerseReference: form.memoryVerseReference,
      memoryVerseText: form.memoryVerseText,
      reflectionPrompt: form.reflectionPrompt,
      verseOfDayReference: hasVerseReference ? form.verseOfDayReference : null,
      verseOfDayText: hasVerseText ? form.verseOfDayText : null,
    });
  }

  return (
    <div className="faith-corner-admin-page">
      <section className="dashboard-hero">
        <p>Student portal</p>
        <h1>Faith Corner</h1>
        <span>Publish weekly Scripture memory and reflection content for students.</span>
      </section>

      <div className="faith-corner-admin-layout">
        <section className="panel panel__body faith-corner-admin-form" aria-labelledby="faith-corner-form-title">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Managed content</p>
              <h2 id="faith-corner-form-title">Weekly publication</h2>
            </div>
            <Sparkles aria-hidden="true" size={20} />
          </div>

          <form onSubmit={submit}>
            <Field label="Weekly theme" required>
              <TextInput
                maxLength={120}
                onChange={(event) => {
                  updateField('weeklyTheme', event.target.value);
                }}
                required
                value={form.weeklyTheme}
              />
            </Field>
            <Field label="Memory verse reference" required>
              <TextInput
                maxLength={80}
                onChange={(event) => {
                  updateField('memoryVerseReference', event.target.value);
                }}
                placeholder="John 3:16"
                required
                value={form.memoryVerseReference}
              />
            </Field>
            <Field label="Memory verse text" required>
              <textarea
                className="input faith-corner-textarea"
                maxLength={1000}
                onChange={(event) => {
                  updateField('memoryVerseText', event.target.value);
                }}
                required
                rows={5}
                value={form.memoryVerseText}
              />
            </Field>
            <Field label="Reflection prompt" required>
              <textarea
                className="input faith-corner-textarea"
                maxLength={1000}
                onChange={(event) => {
                  updateField('reflectionPrompt', event.target.value);
                }}
                required
                rows={4}
                value={form.reflectionPrompt}
              />
            </Field>
            <div className="faith-corner-form-grid">
              <Field label="Verse of the day reference">
                <TextInput
                  maxLength={80}
                  onChange={(event) => {
                    updateField('verseOfDayReference', event.target.value);
                  }}
                  placeholder="Optional"
                  value={form.verseOfDayReference}
                />
              </Field>
              <Field label="Verse of the day text">
                <textarea
                  className="input faith-corner-textarea"
                  maxLength={1000}
                  onChange={(event) => {
                    updateField('verseOfDayText', event.target.value);
                  }}
                  rows={3}
                  value={form.verseOfDayText}
                />
              </Field>
            </div>
            {formError ? <p className="status--error">{formError}</p> : null}
            <Button pending={publish.isPending} type="submit">
              Publish Faith Corner
            </Button>
          </form>
        </section>

        <section className="panel panel__body faith-corner-preview" aria-labelledby="faith-corner-preview-title">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Current student view</p>
              <h2 id="faith-corner-preview-title">Preview</h2>
            </div>
            <BookOpenText aria-hidden="true" size={20} />
          </div>
          {current.isLoading ? <div className="empty-state">Loading Faith Corner...</div> : null}
          {current.error ? (
            <EmptyState detail={friendlyErrorMessage(current.error)} title="Preview unavailable" />
          ) : null}
          {current.data?.ready && current.data.memoryVerse ? (
            <article className="faith-corner-preview-card">
              <small>Published {formatDate(current.data.publishedAt)}</small>
              <h3>{current.data.weeklyTheme}</h3>
              <strong>{current.data.memoryVerse.reference}</strong>
              <p>{current.data.memoryVerse.text}</p>
              <span>{current.data.reflectionPrompt}</span>
              {current.data.verseOfDay ? (
                <div>
                  <strong>{current.data.verseOfDay.reference}</strong>
                  <p>{current.data.verseOfDay.text}</p>
                </div>
              ) : (
                <em>No verse of the day set.</em>
              )}
            </article>
          ) : null}
          {current.data && !current.data.ready ? (
            <EmptyState detail="Publish content before students see Faith Corner." title="No content" />
          ) : null}
        </section>
      </div>
    </div>
  );
}

'use client';

import { type FormEvent, useEffect, useState } from 'react';
import { BookOpenText, Check, MessageCircle, Sparkles, X } from 'lucide-react';
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
  const pendingComments = api.faithCorner.pendingCommentsForAdmin.useQuery(undefined, { retry: false });
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
  const reviewComment = api.faithCorner.reviewComment.useMutation({
    async onSuccess() {
      showSuccessToast('Faith Corner comment reviewed.');
      await Promise.all([
        utils.faithCorner.pendingCommentsForAdmin.invalidate(),
        utils.faithCorner.currentForAdmin.invalidate(),
      ]);
    },
    onError(error) {
      showErrorToast(error, 'Faith Corner comment could not be reviewed.');
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

        <section
          className="panel panel__body faith-corner-admin-moderation"
          aria-labelledby="faith-corner-comments-title"
        >
          <div className="panel__header">
            <div>
              <p className="eyebrow">Student comments</p>
              <h2 id="faith-corner-comments-title">Awaiting approval</h2>
            </div>
            <MessageCircle aria-hidden="true" size={20} />
          </div>

          {pendingComments.isLoading ? <div className="empty-state">Loading comments...</div> : null}
          {pendingComments.error ? (
            <EmptyState detail={friendlyErrorMessage(pendingComments.error)} title="Comments unavailable" />
          ) : null}
          {pendingComments.data?.length === 0 ? (
            <EmptyState detail="New student comments will appear here before they are visible to children." title="No pending comments" />
          ) : null}
          {pendingComments.data && pendingComments.data.length > 0 ? (
            <div className="faith-corner-comment-review-list">
              {pendingComments.data.map((comment) => (
                <article className="faith-corner-comment-review" key={comment.id}>
                  <div>
                    <small>{comment.weeklyTheme}</small>
                    <h3>{comment.authorFirstName}</h3>
                    <time dateTime={comment.createdAt.toISOString()}>{formatDate(comment.createdAt)}</time>
                  </div>
                  <p>{comment.body}</p>
                  <div className="faith-corner-comment-review__actions">
                    <Button
                      onClick={() => {
                        reviewComment.mutate({ commentId: comment.id, status: 'Approved' });
                      }}
                      pending={reviewComment.isPending}
                      type="button"
                    >
                      <Check aria-hidden="true" size={16} />
                      Approve
                    </Button>
                    <Button
                      onClick={() => {
                        reviewComment.mutate({ commentId: comment.id, status: 'Rejected' });
                      }}
                      pending={reviewComment.isPending}
                      type="button"
                      variant="secondary"
                    >
                      <X aria-hidden="true" size={16} />
                      Reject
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

'use client';

import { type FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, CheckCircle2, Send } from 'lucide-react';
import { api, type RouterOutputs } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Field, SelectInput, TextInput } from '@/components/ui/field';
import { friendlyErrorMessage, showErrorToast, showSuccessToast } from '@/lib/notifications';
import {
  NoticeAttachmentLinks,
  NoticeAttachmentPicker,
  type NoticeAttachmentPayload,
} from './noticeboard-attachments';

type Notice = RouterOutputs['notice']['listForAdmin'][number];
type NoticePostResult = RouterOutputs['notice']['post'];
type NoticeAudience = Notice['audience'];
type NoticeboardMode = 'admin' | 'supervisor' | 'parent';

interface StaffNoticeboardProps {
  mode: NoticeboardMode;
}

const audienceLabels: Record<NoticeAudience, string> = {
  Both: 'Parents and supervisors',
  Parents: 'Parents',
  Supervisors: 'Supervisors',
};

const pageCopy: Record<
  NoticeboardMode,
  {
    eyebrow: string;
    heading: string;
    listTitle: string;
    listDescription: string;
    loading: string;
    empty: string;
    ariaLabel: string;
  }
> = {
  admin: {
    eyebrow: 'Centre communications',
    heading: 'Noticeboard',
    listTitle: 'Published Notices',
    listDescription: 'Active notices, newest first.',
    loading: 'Loading notices...',
    empty: 'No active notices.',
    ariaLabel: 'Published notices',
  },
  supervisor: {
    eyebrow: 'Staff communications',
    heading: 'Staff Noticeboard',
    listTitle: 'Staff Notices',
    listDescription: 'Active notices for supervisors, newest first.',
    loading: 'Loading staff notices...',
    empty: 'No active staff notices.',
    ariaLabel: 'Staff notices',
  },
  parent: {
    eyebrow: 'Family communications',
    heading: 'Noticeboard',
    listTitle: 'Parent Notices',
    listDescription: 'Active notices for parents, newest first.',
    loading: 'Loading parent notices...',
    empty: 'No active parent notices.',
    ariaLabel: 'Parent notices',
  },
};

const noticeDateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  month: 'short',
  year: 'numeric',
});

function formatDateTime(value: Date | string): string {
  return noticeDateTimeFormatter.format(new Date(value));
}

function emailCountLabel(count: number): string {
  return count === 1 ? '1 email' : `${String(count)} emails`;
}

function noticePostSuccessMessage(summary: NoticePostResult['emailSummary']): string {
  if (summary.recipientCount === 0) return 'Notice posted. No email recipients found.';
  const optedOutText =
    summary.skippedOptOutCount > 0
      ? ` ${String(summary.skippedOptOutCount)} opted out of email notifications.`
      : '';
  if (summary.failedCount > 0) {
    return `Notice posted. ${emailCountLabel(summary.sentCount)} sent, ${emailCountLabel(summary.failedCount)} failed.${optedOutText}`;
  }
  return `Notice posted. ${emailCountLabel(summary.sentCount)} sent.${optedOutText}`;
}

function ReadSummaryBadge({ summary }: { summary: NonNullable<Notice['readSummary']> }) {
  return (
    <span className="noticeboard-read-summary">
      <button
        aria-label={`${String(summary.read)} of ${String(summary.total)} recipients have read this notice`}
        className="noticeboard-read-summary__trigger"
        type="button"
      >
        {String(summary.read)}/{String(summary.total)} read
      </button>
      <span className="noticeboard-read-summary__tooltip" role="tooltip">
        {summary.recipients.map((recipient) => (
          <span className="noticeboard-read-summary__row" key={recipient.userId}>
            <span
              className={
                recipient.read
                  ? 'noticeboard-read-summary__icon is-read'
                  : 'noticeboard-read-summary__icon'
              }
            >
              <Check aria-hidden="true" size={14} strokeWidth={3.2} />
            </span>
            <span>
              <strong>{recipient.fullName}</strong>
              <small>{recipient.read ? 'Read' : 'Unread'}</small>
            </span>
          </span>
        ))}
      </span>
    </span>
  );
}

function NoticeCard({
  notice,
  onMarkRead,
  onViewAttachment,
  pending,
}: {
  notice: Notice;
  onMarkRead: (noticeId: string) => void;
  onViewAttachment?: ((noticeId: string) => void) | undefined;
  pending: boolean;
}) {
  const readSummary = notice.readSummary;
  const handleViewAttachment =
    !notice.read && !readSummary && onViewAttachment
      ? () => {
          onViewAttachment(notice.id);
        }
      : undefined;

  return (
    <article className={notice.read ? 'noticeboard-card' : 'noticeboard-card is-unread'}>
      <div className="noticeboard-card__head">
        <div>
          <span className="badge-list">
            {readSummary ? null : (
              <span className={notice.read ? 'badge badge--green' : 'badge badge--blue'}>
                {notice.read ? 'Read' : 'Unread'}
              </span>
            )}
            <span className="badge">{audienceLabels[notice.audience]}</span>
          </span>
          <h2>{notice.title}</h2>
        </div>
        {readSummary ? <ReadSummaryBadge summary={readSummary} /> : null}
        {!notice.read && !readSummary ? (
          <Button
            aria-label={`Mark ${notice.title} as read`}
            onClick={() => {
              onMarkRead(notice.id);
            }}
            pending={pending}
            size="sm"
            type="button"
            variant="secondary"
          >
            <CheckCircle2 aria-hidden="true" size={15} />
            Mark read
          </Button>
        ) : null}
      </div>
      <p>{notice.body}</p>
      <NoticeAttachmentLinks
        attachments={notice.attachments}
        onViewAttachment={handleViewAttachment}
      />
      <footer>
        <span>Posted {formatDateTime(notice.createdAt)}</span>
        {notice.expiresAt ? <span>Expires {formatDateTime(notice.expiresAt)}</span> : null}
      </footer>
    </article>
  );
}

export function StaffNoticeboard({ mode }: StaffNoticeboardProps) {
  const router = useRouter();
  const utils = api.useUtils();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<NoticeAudience>('Supervisors');
  const [expiresAt, setExpiresAt] = useState('');
  const [attachments, setAttachments] = useState<NoticeAttachmentPayload[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingReadId, setPendingReadId] = useState<string | null>(null);

  const copy = pageCopy[mode];
  const canPost = mode === 'admin';
  const adminNoticesQuery = api.notice.listForAdmin.useQuery(undefined, {
    enabled: mode === 'admin',
    retry: false,
  });
  const staffNoticesQuery = api.notice.listForStaff.useQuery(undefined, {
    enabled: mode === 'supervisor',
    retry: false,
  });
  const parentNoticesQuery = api.notice.listForParents.useQuery(undefined, {
    enabled: mode === 'parent',
    retry: false,
  });
  const noticesQuery =
    mode === 'admin'
      ? adminNoticesQuery
      : mode === 'parent'
        ? parentNoticesQuery
        : staffNoticesQuery;
  const postNotice = api.notice.post.useMutation({
    onSuccess: async (result) => {
      setTitle('');
      setBody('');
      setAudience('Supervisors');
      setExpiresAt('');
      setAttachments([]);
      setFormError(null);
      showSuccessToast(noticePostSuccessMessage(result.emailSummary));
      await refreshNoticeState();
    },
    onError(error) {
      showErrorToast(error, 'Notice could not be posted.');
    },
  });
  const markRead = api.notice.markRead.useMutation({
    onError(error) {
      showErrorToast(error, 'Notice could not be marked as read.');
    },
    onSettled: () => {
      setPendingReadId(null);
    },
    onSuccess: async () => {
      await refreshNoticeState();
    },
  });

  const notices: Notice[] = noticesQuery.data ?? [];
  const unreadCount = notices.filter((notice) => !notice.read).length;

  async function submitNotice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();

    if (!trimmedTitle || !trimmedBody) {
      setFormError('Title and message are required.');
      return;
    }

    const expiry = expiresAt ? new Date(expiresAt) : undefined;
    if (expiry && expiry <= new Date()) {
      setFormError('Expiry must be in the future.');
      return;
    }

    setFormError(null);
    try {
      await postNotice.mutateAsync({
        title: trimmedTitle,
        body: trimmedBody,
        audience,
        attachments,
        ...(expiry ? { expiresAt: expiry } : {}),
      });
    } catch {
      // The mutation error is shown by the notification layer.
    }
  }

  function handleMarkRead(noticeId: string): void {
    setPendingReadId(noticeId);
    markRead.mutate({ noticeId });
  }

  async function refreshNoticeState(): Promise<void> {
    await utils.notice.listForAdmin.invalidate();
    await utils.notice.listForStaff.invalidate();
    await utils.notice.listForParents.invalidate();
    router.refresh();
  }

  function handleViewAttachment(): void {
    if (mode !== 'parent') return;
    window.setTimeout(() => {
      void refreshNoticeState();
    }, 750);
  }

  return (
    <div className="noticeboard-page">
      <div className="dashboard-hero">
        <p>{copy.eyebrow}</p>
        <h1>{copy.heading}</h1>
        {unreadCount > 0 ? (
          <span>
            {unreadCount === 1 ? '1 unread notice' : `${String(unreadCount)} unread notices`}
          </span>
        ) : null}
      </div>

      <div
        className={canPost ? 'noticeboard-layout' : 'noticeboard-layout noticeboard-layout--single'}
      >
        {canPost ? (
          <section
            className="panel panel__body noticeboard-composer"
            aria-labelledby="notice-composer-title"
          >
            <div className="section-title">
              <div>
                <h2 id="notice-composer-title">Post a Notice</h2>
                <p className="muted">Publish an active notice for supervisors, parents, or both.</p>
              </div>
            </div>
            <form
              className="noticeboard-form"
              onSubmit={(event) => {
                void submitNotice(event);
              }}
            >
              <Field label="Title" required>
                <TextInput
                  aria-label="Notice title"
                  maxLength={160}
                  onChange={(event) => {
                    setTitle(event.target.value);
                  }}
                  placeholder="Notice title"
                  required
                  value={title}
                />
              </Field>
              <Field label="Message" required>
                <textarea
                  aria-label="Notice body"
                  className="input textarea"
                  maxLength={4000}
                  onChange={(event) => {
                    setBody(event.target.value);
                  }}
                  placeholder="Notice body"
                  required
                  rows={6}
                  value={body}
                />
              </Field>
              <Field label="Audience" required>
                <SelectInput
                  aria-label="Notice audience"
                  onChange={(event) => {
                    setAudience(event.target.value as NoticeAudience);
                  }}
                  required
                  value={audience}
                >
                  <option value="Supervisors">Supervisors</option>
                  <option value="Parents">Parents</option>
                  <option value="Both">Parents and supervisors</option>
                </SelectInput>
              </Field>
              <Field label="Expiry" hint="Optional">
                <TextInput
                  aria-label="Notice expiry"
                  onChange={(event) => {
                    setExpiresAt(event.target.value);
                  }}
                  type="datetime-local"
                  value={expiresAt}
                />
              </Field>
              <Field label="Attachments" hint="Optional">
                <NoticeAttachmentPicker
                  attachments={attachments}
                  disabled={postNotice.isPending}
                  onAttachmentsChange={(nextAttachments) => {
                    setAttachments(nextAttachments);
                    setFormError(null);
                  }}
                  onError={setFormError}
                />
              </Field>
              <Button pending={postNotice.isPending} type="submit">
                <Send aria-hidden="true" size={16} />
                Post to Noticeboard
              </Button>
              {formError ? <p className="status--error">{formError}</p> : null}
            </form>
          </section>
        ) : null}

        <section
          className="panel panel__body noticeboard-list-panel"
          aria-labelledby="noticeboard-list-title"
        >
          <div className="section-title">
            <div>
              <h2 id="noticeboard-list-title">{copy.listTitle}</h2>
              <p className="muted">{copy.listDescription}</p>
            </div>
            {unreadCount > 0 ? (
              <span className="badge badge--blue">{String(unreadCount)} unread</span>
            ) : null}
          </div>

          {noticesQuery.isLoading ? <div className="empty-state">{copy.loading}</div> : null}
          {noticesQuery.error ? (
            <p className="status--error">{friendlyErrorMessage(noticesQuery.error)}</p>
          ) : null}
          {!noticesQuery.isLoading && notices.length === 0 ? (
            <div className="empty-state">{copy.empty}</div>
          ) : null}
          <div className="noticeboard-list" aria-label={copy.ariaLabel}>
            {notices.map((notice) => (
              <NoticeCard
                key={notice.id}
                notice={notice}
                onMarkRead={handleMarkRead}
                onViewAttachment={mode === 'parent' ? handleViewAttachment : undefined}
                pending={pendingReadId === notice.id}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

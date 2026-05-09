'use client';

import { type FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Send } from 'lucide-react';
import { api, type RouterOutputs } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Field, TextInput } from '@/components/ui/field';

type StaffNotice = RouterOutputs['notice']['listForStaff'][number];

interface StaffNoticeboardProps {
  canPost: boolean;
}

function formatDateTime(value: Date | string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function NoticeCard({
  notice,
  onMarkRead,
  pending,
}: {
  notice: StaffNotice;
  onMarkRead: (noticeId: string) => void;
  pending: boolean;
}) {
  return (
    <article className={notice.read ? 'noticeboard-card' : 'noticeboard-card is-unread'}>
      <div className="noticeboard-card__head">
        <div>
          <span className={notice.read ? 'badge badge--green' : 'badge badge--blue'}>
            {notice.read ? 'Read' : 'Unread'}
          </span>
          <h2>{notice.title}</h2>
        </div>
        {!notice.read ? (
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
      <footer>
        <span>Posted {formatDateTime(notice.createdAt)}</span>
        {notice.expiresAt ? <span>Expires {formatDateTime(notice.expiresAt)}</span> : null}
      </footer>
    </article>
  );
}

export function StaffNoticeboard({ canPost }: StaffNoticeboardProps) {
  const router = useRouter();
  const utils = api.useUtils();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formStatus, setFormStatus] = useState<string | null>(null);
  const [pendingReadId, setPendingReadId] = useState<string | null>(null);

  const noticesQuery = api.notice.listForStaff.useQuery(undefined, { retry: false });
  const postNotice = api.notice.post.useMutation({
    onSuccess: async () => {
      setTitle('');
      setBody('');
      setExpiresAt('');
      setFormError(null);
      setFormStatus('Notice posted.');
      await utils.notice.listForStaff.invalidate();
    },
  });
  const markRead = api.notice.markRead.useMutation({
    onSettled: () => {
      setPendingReadId(null);
    },
    onSuccess: async () => {
      await utils.notice.listForStaff.invalidate();
      router.refresh();
    },
  });

  const notices = noticesQuery.data ?? [];
  const unreadCount = notices.filter((notice) => !notice.read).length;

  async function submitNotice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();

    setFormStatus(null);
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
        ...(expiry ? { expiresAt: expiry } : {}),
      });
    } catch {
      // The mutation error is rendered from React Query state below the form.
    }
  }

  function handleMarkRead(noticeId: string): void {
    setPendingReadId(noticeId);
    markRead.mutate({ noticeId });
  }

  return (
    <div className="noticeboard-page">
      <div className="dashboard-hero">
        <p>Staff communications</p>
        <h1>Staff Noticeboard</h1>
        <span>
          {unreadCount === 1 ? '1 unread notice' : `${String(unreadCount)} unread notices`}
        </span>
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
                <p className="muted">Publish an active notice for staff readers.</p>
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
              <Button pending={postNotice.isPending} type="submit">
                <Send aria-hidden="true" size={16} />
                Post to Noticeboard
              </Button>
              {formStatus ? <p className="status--success">{formStatus}</p> : null}
              {formError ? <p className="status--error">{formError}</p> : null}
              {postNotice.error ? (
                <p className="status--error">{postNotice.error.message}</p>
              ) : null}
            </form>
          </section>
        ) : null}

        <section
          className="panel panel__body noticeboard-list-panel"
          aria-labelledby="staff-notices-title"
        >
          <div className="section-title">
            <div>
              <h2 id="staff-notices-title">Staff Notices</h2>
              <p className="muted">Active notices, newest first.</p>
            </div>
            <span className="badge badge--blue">{String(unreadCount)} unread</span>
          </div>

          {noticesQuery.isLoading ? (
            <div className="empty-state">Loading staff notices...</div>
          ) : null}
          {noticesQuery.error ? (
            <p className="status--error">{noticesQuery.error.message}</p>
          ) : null}
          {markRead.error ? <p className="status--error">{markRead.error.message}</p> : null}
          {!noticesQuery.isLoading && notices.length === 0 ? (
            <div className="empty-state">No active staff notices.</div>
          ) : null}
          <div className="noticeboard-list" aria-label="Staff notices">
            {notices.map((notice) => (
              <NoticeCard
                key={notice.id}
                notice={notice}
                onMarkRead={handleMarkRead}
                pending={pendingReadId === notice.id}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

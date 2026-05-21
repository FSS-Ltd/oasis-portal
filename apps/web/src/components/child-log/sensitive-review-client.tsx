'use client';

import { useState, type FormEvent } from 'react';
import { Check, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { api, type RouterOutputs } from '@/lib/trpc';
import { SnapshotBadge } from './snapshot-widgets';

type ReviewItem = RouterOutputs['childLog']['sensitiveReviewQueue'][number];

function formatDateTime(value: Date | string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  }).format(new Date(value));
}

function itemTitle(item: ReviewItem): string {
  if (item.kind === 'note') return 'Sensitive Note';
  if (item.reviewReason === 'Policy escalation') return 'Policy Escalation Demerit';
  if (item.type === 'General') return 'Sensitive General Mark';
  if (item.type === 'Demerit') return 'Sensitive Demerit';
  return `Sensitive ${item.type}`;
}

function ReviewRow({ item }: { item: ReviewItem }) {
  const utils = api.useUtils();
  const [comment, setComment] = useState(item.headComment ?? '');
  const reviewItem = api.childLog.reviewSensitiveItem.useMutation({
    onSuccess: async () => {
      await utils.childLog.sensitiveReviewQueue.invalidate();
    },
  });

  async function markSeen(nextComment?: string): Promise<void> {
    await reviewItem.mutateAsync({
      id: item.id,
      kind: item.kind,
      ...(nextComment === undefined ? {} : { comment: nextComment }),
    });
  }

  async function submitComment(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    await markSeen(comment);
  }

  return (
    <article className="panel panel__body sensitive-review-row">
      <header>
        <div>
          <h3>{item.student.fullName}</h3>
          <p>
            {itemTitle(item)} · {item.category} · {formatDateTime(item.createdAt)}
          </p>
        </div>
        <SnapshotBadge tone={item.seenAt ? 'green' : 'amber'}>
          {item.seenAt ? 'Reviewed' : 'Pending Review'}
        </SnapshotBadge>
      </header>
      <div className="sensitive-review-row__meta">
        <span>Author: {item.author.fullName}</span>
        {item.seenAt ? (
          <span>
            Seen by {item.seenByName ?? 'Head'} · {formatDateTime(item.seenAt)}
          </span>
        ) : null}
      </div>
      {item.body ? <p>{item.body}</p> : <p className="muted">No note text recorded.</p>}
      {item.kind === 'mark' ? (
        <div className="sensitive-review-row__meta">
          <span>Merit value: {item.meritDelta === 0 ? 'None' : item.meritDelta}</span>
        </div>
      ) : null}
      <form
        className="sensitive-review-comment"
        onSubmit={(event) => {
          void submitComment(event);
        }}
      >
        <textarea
          aria-label={`Head comment for ${item.student.fullName}`}
          className="input textarea"
          maxLength={3000}
          onChange={(event) => {
            setComment(event.target.value);
          }}
          placeholder="Optional Head comment..."
          rows={3}
          value={comment}
        />
        <div className="lifecycle-actions">
          <Button pending={reviewItem.isPending} type="submit">
            <MessageSquare aria-hidden="true" size={16} />
            Comment + mark seen
          </Button>
          <Button
            disabled={reviewItem.isPending}
            onClick={() => {
              void markSeen();
            }}
            type="button"
            variant="secondary"
          >
            <Check aria-hidden="true" size={16} />
            Mark seen
          </Button>
        </div>
        {reviewItem.error ? <p className="status--error">{reviewItem.error.message}</p> : null}
      </form>
    </article>
  );
}

export function SensitiveReviewClient() {
  const reviewQuery = api.childLog.sensitiveReviewQueue.useQuery(undefined, { retry: false });
  const items = reviewQuery.data ?? [];
  const unseen = items.filter((item) => !item.seenAt);
  const seen = items.filter((item) => item.seenAt);

  return (
    <div className="snapshot-page sensitive-review-page">
      <div className="snapshot-page__header">
        <h1>Sensitive Review</h1>
        <p>Review sensitive supervisor notes and marks.</p>
      </div>

      {reviewQuery.isLoading ? <EmptyState>Loading sensitive review...</EmptyState> : null}
      {reviewQuery.error ? <p className="status--error">{reviewQuery.error.message}</p> : null}

      <section className="snapshot-tab-panel snapshot-list-panel">
        <h2>Needs review</h2>
        {!reviewQuery.isLoading && unseen.length === 0 ? (
          <EmptyState detail="Reviewed sensitive items remain below." title="No items waiting" />
        ) : null}
        {unseen.map((item) => (
          <ReviewRow item={item} key={`${item.kind}-${item.id}`} />
        ))}
      </section>

      <section className="snapshot-tab-panel snapshot-list-panel">
        <h2>Seen</h2>
        {seen.length === 0 ? <EmptyState>No seen sensitive items yet.</EmptyState> : null}
        {seen.map((item) => (
          <ReviewRow item={item} key={`${item.kind}-${item.id}`} />
        ))}
      </section>
    </div>
  );
}

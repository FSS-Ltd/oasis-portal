'use client';

import { type FormEvent, useState } from 'react';
import { BookOpenText, Heart, MessageCircle, Send, Sparkles } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { friendlyErrorMessage, showErrorToast, showSuccessToast } from '@/lib/notifications';
import { api, type RouterOutputs } from '@/lib/trpc';

type FaithCornerComment = RouterOutputs['faithCorner']['listComments'][number];

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(value);
}

export function StudentFaithClient() {
  const utils = api.useUtils();
  const faith = api.faithCorner.currentForStudent.useQuery(undefined, { retry: false });
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentBody, setCommentBody] = useState('');
  const [commentError, setCommentError] = useState<string | null>(null);
  const comments = api.faithCorner.listComments.useQuery(undefined, {
    enabled: commentsOpen && Boolean(faith.data?.ready),
    retry: false,
  });
  const toggleCurrentLike = api.faithCorner.toggleCurrentLike.useMutation({
    async onSuccess() {
      await Promise.all([
        utils.faithCorner.currentForStudent.invalidate(),
        utils.student.dashboard.invalidate(),
      ]);
    },
    onError(error) {
      showErrorToast(error, 'Faith Corner like could not be updated.');
    },
  });
  const submitComment = api.faithCorner.submitComment.useMutation({
    async onSuccess() {
      setCommentBody('');
      setCommentError(null);
      showSuccessToast('Comment sent for approval.');
      await Promise.all([
        utils.faithCorner.currentForStudent.invalidate(),
        utils.faithCorner.listComments.invalidate(),
      ]);
    },
    onError(error) {
      showErrorToast(error, 'Comment could not be sent.');
    },
  });
  const toggleCommentLike = api.faithCorner.toggleCommentLike.useMutation({
    async onSuccess() {
      await utils.faithCorner.listComments.invalidate();
    },
    onError(error) {
      showErrorToast(error, 'Comment like could not be updated.');
    },
  });

  function submitReflectionComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = commentBody.trim();
    if (body.length === 0) {
      setCommentError('Write a comment before sending it for approval.');
      return;
    }
    submitComment.mutate({ body });
  }

  if (faith.isLoading) {
    return <div className="student-inline-state">Loading Faith Corner...</div>;
  }

  if (faith.error) {
    return (
      <EmptyState detail={friendlyErrorMessage(faith.error)} title="Faith Corner unavailable" />
    );
  }

  if (!faith.data?.ready || !faith.data.memoryVerse) {
    return (
      <EmptyState
        detail="Managed Faith Corner content will appear here when it is published."
        title="Faith Corner is not ready"
      />
    );
  }

  return (
    <div className="student-page student-faith-page">
      <section className="student-wallet-hero student-faith-hero">
        <div>
          <p>Faith Corner</p>
          <h1>{faith.data.weeklyTheme}</h1>
          <span>Weekly Scripture memory and reflection for the Learning Centre.</span>
        </div>
        <div className="student-faith-hero__meta">
          <Sparkles aria-hidden="true" size={18} />
          <small>Published</small>
          <strong>{faith.data.publishedAt ? formatDate(faith.data.publishedAt) : 'Current'}</strong>
        </div>
      </section>

      <section className="student-faith-actions" aria-label="Faith Corner reactions">
        <button
          aria-pressed={faith.data.likedByCurrentStudent}
          className={
            faith.data.likedByCurrentStudent
              ? 'student-faith-action is-active'
              : 'student-faith-action'
          }
          disabled={toggleCurrentLike.isPending}
          onClick={() => {
            toggleCurrentLike.mutate();
          }}
          type="button"
        >
          <Heart
            aria-hidden="true"
            fill={faith.data.likedByCurrentStudent ? 'currentColor' : 'none'}
            size={18}
          />
          <span>{faith.data.likeCount}</span>
        </button>
        <button
          aria-expanded={commentsOpen}
          className={commentsOpen ? 'student-faith-action is-active' : 'student-faith-action'}
          onClick={() => {
            setCommentsOpen((open) => !open);
          }}
          type="button"
        >
          <MessageCircle aria-hidden="true" size={18} />
          <span>{faith.data.commentCount}</span>
        </button>
      </section>

      <div className="student-faith-layout">
        <section className="student-faith-card" aria-labelledby="student-memory-verse-title">
          <div className="student-dashboard-panel__head">
            <div>
              <p>Memory verse</p>
              <h2 id="student-memory-verse-title">{faith.data.memoryVerse.reference}</h2>
            </div>
            <BookOpenText aria-hidden="true" size={20} />
          </div>
          <blockquote>{faith.data.memoryVerse.text}</blockquote>
          <small>{faith.data.memoryVerse.translation}</small>
        </section>

        <section className="student-faith-card" aria-labelledby="student-reflection-title">
          <div className="student-dashboard-panel__head">
            <div>
              <p>Reflection</p>
              <h2 id="student-reflection-title">Prompt</h2>
            </div>
          </div>
          <p>{faith.data.reflectionPrompt}</p>
        </section>

        {faith.data.verseOfDay ? (
          <section
            className="student-faith-card student-faith-card--wide"
            aria-labelledby="student-verse-day-title"
          >
            <div className="student-dashboard-panel__head">
              <div>
                <p>Verse of the day</p>
                <h2 id="student-verse-day-title">{faith.data.verseOfDay.reference}</h2>
              </div>
            </div>
            <blockquote>{faith.data.verseOfDay.text}</blockquote>
            <small>{faith.data.verseOfDay.translation}</small>
          </section>
        ) : (
          <section
            className="student-faith-card student-faith-card--wide"
            aria-labelledby="student-verse-day-title"
          >
            <div className="student-dashboard-panel__head">
              <div>
                <p>Verse of the day</p>
                <h2 id="student-verse-day-title">Not set</h2>
              </div>
            </div>
            <p>A verse of the day has not been published for this week.</p>
          </section>
        )}
      </div>

      {commentsOpen ? (
        <section className="student-faith-comments" aria-labelledby="student-faith-comments-title">
          <div className="student-dashboard-panel__head">
            <div>
              <p>Discussion</p>
              <h2 id="student-faith-comments-title">Comments</h2>
            </div>
            <MessageCircle aria-hidden="true" size={20} />
          </div>

          <form className="student-faith-comment-form" onSubmit={submitReflectionComment}>
            <label htmlFor="student-faith-comment">Your comment</label>
            <textarea
              id="student-faith-comment"
              maxLength={500}
              onChange={(event) => {
                setCommentBody(event.target.value);
                if (commentError) setCommentError(null);
              }}
              placeholder="Share a short response to this devotion..."
              rows={3}
              value={commentBody}
            />
            {commentError ? <p className="student-faith-comment-error">{commentError}</p> : null}
            <button
              className="student-faith-submit"
              disabled={submitComment.isPending || commentBody.trim().length === 0}
              type="submit"
            >
              <Send aria-hidden="true" size={16} />
              <span>{submitComment.isPending ? 'Sending...' : 'Send for approval'}</span>
            </button>
          </form>

          {comments.isLoading ? (
            <div className="student-inline-state">Loading comments...</div>
          ) : null}
          {comments.error ? (
            <EmptyState
              detail={friendlyErrorMessage(comments.error)}
              title="Comments unavailable"
            />
          ) : null}
          {comments.data?.length === 0 ? (
            <p className="student-dashboard-muted">No approved comments yet.</p>
          ) : null}
          {comments.data && comments.data.length > 0 ? (
            <div className="student-faith-comment-list">
              {comments.data.map((comment) => (
                <FaithCommentRow
                  comment={comment}
                  key={comment.id}
                  onLike={() => {
                    toggleCommentLike.mutate({ commentId: comment.id });
                  }}
                  pending={toggleCommentLike.isPending}
                />
              ))}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function FaithCommentRow({
  comment,
  onLike,
  pending,
}: {
  comment: FaithCornerComment;
  onLike: () => void;
  pending: boolean;
}) {
  const canLike = comment.status === 'Approved';
  return (
    <article className="student-faith-comment">
      <div>
        <strong>{comment.authorFirstName}</strong>
        {comment.status !== 'Approved' ? (
          <span className={`student-faith-comment__status is-${comment.status.toLowerCase()}`}>
            {comment.status}
          </span>
        ) : null}
      </div>
      <p>{comment.body}</p>
      <button
        aria-pressed={comment.likedByCurrentStudent}
        className={
          comment.likedByCurrentStudent
            ? 'student-faith-comment__like is-active'
            : 'student-faith-comment__like'
        }
        disabled={!canLike || pending}
        onClick={onLike}
        type="button"
      >
        <Heart
          aria-hidden="true"
          fill={comment.likedByCurrentStudent ? 'currentColor' : 'none'}
          size={15}
        />
        <span>{comment.likeCount}</span>
      </button>
    </article>
  );
}

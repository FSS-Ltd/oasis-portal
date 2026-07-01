import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api } from '../../lib/trpc';
import { C } from '../core/mobile-theme';
import {
  Badge,
  ErrorText,
  Field,
  InlineSpinner,
  MutedText,
  SectionTitle,
  MobileButton,
} from '../core/mobile-ui';
import {
  trimComment,
  type FaithCornerComment,
  type StudentFaithCorner,
} from './student-clubs-faith-utils';

interface StudentFaithCommentsPanelProps {
  comments: readonly FaithCornerComment[] | undefined;
  commentsError: string | null;
  commentsLoading: boolean;
  faith: StudentFaithCorner;
  onRefreshFaith: () => Promise<void>;
}

export function StudentFaithCommentsPanel({
  comments,
  commentsError,
  commentsLoading,
  faith,
  onRefreshFaith,
}: StudentFaithCommentsPanelProps) {
  const utils = api.useUtils();
  const [commentBody, setCommentBody] = useState('');
  const [commentError, setCommentError] = useState<string | null>(null);
  const toggleCurrentLike = api.faithCorner.toggleCurrentLike.useMutation();
  const submitComment = api.faithCorner.submitComment.useMutation();
  const toggleCommentLike = api.faithCorner.toggleCommentLike.useMutation();

  async function refreshFaithData() {
    await Promise.all([
      utils.faithCorner.currentForStudent.invalidate(),
      utils.faithCorner.listComments.invalidate(),
      onRefreshFaith(),
    ]);
  }

  async function toggleFaithLike() {
    try {
      await toggleCurrentLike.mutateAsync();
      await refreshFaithData();
    } catch {
      setCommentError('Faith Corner like could not be updated.');
    }
  }

  async function sendComment() {
    const body = trimComment(commentBody);
    if (!body) {
      setCommentError('Write a comment before sending it for approval.');
      return;
    }

    try {
      await submitComment.mutateAsync({ body });
      setCommentBody('');
      setCommentError('Comment sent for approval.');
      await refreshFaithData();
    } catch (cause) {
      setCommentError(cause instanceof Error ? cause.message : 'Comment could not be sent.');
    }
  }

  async function toggleComment(commentId: string) {
    try {
      await toggleCommentLike.mutateAsync({ commentId });
      await Promise.all([utils.faithCorner.listComments.invalidate(), onRefreshFaith()]);
    } catch {
      setCommentError('Comment like could not be updated.');
    }
  }

  return (
    <>
      <View style={styles.actionRow}>
        <MobileButton
          compact
          disabled={toggleCurrentLike.isPending}
          label={faith.likedByCurrentStudent ? 'Liked' : 'Like'}
          onPress={() => {
            void toggleFaithLike();
          }}
          variant={faith.likedByCurrentStudent ? 'success' : 'secondary'}
        />
        <Badge variant="blue">{String(faith.commentCount)} Comments</Badge>
      </View>

      <View style={styles.commentForm}>
        <SectionTitle>Comments</SectionTitle>
        <Field
          label="Your comment"
          multiline
          onChangeText={(value) => {
            setCommentBody(value);
            if (commentError) setCommentError(null);
          }}
          placeholder="Share a short response to this devotion..."
          value={commentBody}
        />
        <MobileButton
          disabled={submitComment.isPending || commentBody.trim().length === 0}
          label={submitComment.isPending ? 'Sending...' : 'Send for approval'}
          onPress={() => {
            void sendComment();
          }}
          variant="primary"
        />
        {commentError ? <MutedText>{commentError}</MutedText> : null}
      </View>

      {commentsLoading ? <InlineSpinner label="Loading Faith Corner comments" /> : null}
      {commentsError ? (
        <>
          <SectionTitle>Faith Corner unavailable</SectionTitle>
          <ErrorText>{commentsError}</ErrorText>
        </>
      ) : null}
      {comments && comments.length === 0 ? <MutedText>No approved comments yet.</MutedText> : null}
      {comments?.map((comment) => (
        <FaithCommentRow
          comment={comment}
          key={comment.id}
          onLike={() => {
            void toggleComment(comment.id);
          }}
          pending={toggleCommentLike.isPending}
        />
      ))}
    </>
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
    <View style={styles.commentCard}>
      <View style={styles.commentHead}>
        <Text style={styles.commentAuthor}>{comment.authorFirstName}</Text>
        {comment.status !== 'Approved' ? (
          <Badge variant="warning">Comment pending approval</Badge>
        ) : null}
      </View>
      <Text style={styles.description}>{comment.body}</Text>
      <View style={styles.actionRow}>
        <MobileButton
          compact
          disabled={!canLike || pending}
          label={comment.likedByCurrentStudent ? 'Liked' : 'Like'}
          onPress={onLike}
          variant={comment.likedByCurrentStudent ? 'success' : 'secondary'}
        />
        <MutedText>{String(comment.likeCount)} likes</MutedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  commentAuthor: {
    color: C.navy,
    fontSize: 13,
    fontWeight: '900',
  },
  commentCard: {
    backgroundColor: C.bg,
    borderColor: C.borderLight,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
    padding: 12,
  },
  commentForm: {
    borderColor: C.borderLight,
    borderRadius: 10,
    borderWidth: 1,
    gap: 10,
    padding: 12,
  },
  commentHead: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  description: {
    color: C.textPrimary,
    fontSize: 13,
    lineHeight: 19,
  },
});

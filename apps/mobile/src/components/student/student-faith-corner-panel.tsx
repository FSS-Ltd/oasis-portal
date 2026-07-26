import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { C } from '../core/mobile-theme';
import { Badge, Card, ErrorText, InlineSpinner, MutedText, SectionTitle } from '../core/mobile-ui';
import { StudentFaithCommentsPanel } from './student-faith-comments-panel';
import {
  clubsFaithBlockedCopy,
  formatStudentDate,
  type FaithCornerComment,
  type StudentFaithCorner,
} from './student-clubs-faith-utils';

interface StudentFaithCornerPanelProps {
  comments: readonly FaithCornerComment[] | undefined;
  commentsError: string | null;
  commentsLoading: boolean;
  faith: StudentFaithCorner | undefined;
  faithError: string | null;
  loading: boolean;
  onRefreshFaith: () => Promise<void>;
}

export function StudentFaithCornerPanel({
  comments,
  commentsError,
  commentsLoading,
  faith,
  faithError,
  loading,
  onRefreshFaith,
}: StudentFaithCornerPanelProps) {
  if (loading && !faith) {
    return (
      <Card style={styles.stateCard}>
        <InlineSpinner label="Loading Faith Corner" />
      </Card>
    );
  }

  if (faithError && !faith) {
    return (
      <Card style={styles.stateCard}>
        <SectionTitle>Faith Corner unavailable</SectionTitle>
        <MutedText>This account cannot open Faith Corner right now.</MutedText>
        <MutedText>{clubsFaithBlockedCopy.join(' · ')}</MutedText>
        <ErrorText>{faithError}</ErrorText>
      </Card>
    );
  }

  if (!faith?.ready || !faith.memoryVerse) {
    return (
      <Card style={styles.stateCard}>
        <SectionTitle>Faith Corner is not ready</SectionTitle>
        <MutedText>Managed Faith Corner content will appear here when it is published.</MutedText>
      </Card>
    );
  }

  return (
    <Card style={styles.faithCard}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>Faith Corner</Text>
          <SectionTitle>{faith.weeklyTheme}</SectionTitle>
          <MutedText>
            Published {faith.publishedAt ? formatStudentDate(faith.publishedAt) : 'Current'}
          </MutedText>
        </View>
        <Badge variant={faith.likedByCurrentStudent ? 'success' : 'blue'}>
          {String(faith.likeCount)} likes
        </Badge>
      </View>

      <FaithBlock title="Memory verse" heading={faith.memoryVerse.reference}>
        <Text style={styles.verseText}>{faith.memoryVerse.text}</Text>
        <MutedText>{faith.memoryVerse.translation}</MutedText>
      </FaithBlock>

      {faith.reflectionPrompt ? (
        <FaithBlock title="Reflection" heading="Prompt">
          <Text style={styles.description}>{faith.reflectionPrompt}</Text>
        </FaithBlock>
      ) : null}

      <FaithBlock title="Verse of the day" heading={faith.verseOfDay?.reference ?? 'Not set'}>
        {faith.verseOfDay ? (
          <>
            <Text style={styles.verseText}>{faith.verseOfDay.text}</Text>
            <MutedText>{faith.verseOfDay.translation}</MutedText>
          </>
        ) : (
          <MutedText>A verse of the day has not been published for this week.</MutedText>
        )}
      </FaithBlock>

      <StudentFaithCommentsPanel
        comments={comments}
        commentsError={commentsError}
        commentsLoading={commentsLoading}
        faith={faith}
        onRefreshFaith={onRefreshFaith}
      />
    </Card>
  );
}

function FaithBlock({
  children,
  heading,
  title,
}: {
  children: ReactNode;
  heading: string;
  title: 'Memory verse' | 'Reflection' | 'Verse of the day';
}) {
  return (
    <View style={styles.faithBlock}>
      <Text style={styles.eyebrow}>{title}</Text>
      <Text style={styles.blockHeading}>{heading}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  blockHeading: {
    color: C.navy,
    fontSize: 14,
    fontWeight: '900',
  },
  description: {
    color: C.textPrimary,
    fontSize: 13,
    lineHeight: 19,
  },
  eyebrow: {
    color: C.crimson,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  faithBlock: {
    backgroundColor: C.bg,
    borderColor: C.borderLight,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
    padding: 12,
  },
  faithCard: {
    gap: 14,
    padding: 16,
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  headerCopy: {
    flex: 1,
    gap: 4,
  },
  stateCard: {
    gap: 10,
    padding: 16,
  },
  verseText: {
    color: C.navy,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
  },
});

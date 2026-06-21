import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { api } from '../../lib/trpc';
import { C } from '../core/mobile-theme';
import { Badge, Card, MutedText, SectionTitle } from '../core/mobile-ui';
import { StudentFaithCornerPanel } from './student-faith-corner-panel';

export function StudentFaithCornerScreen() {
  const faith = api.faithCorner.currentForStudent.useQuery(undefined, { retry: false });
  const comments = api.faithCorner.listComments.useQuery(undefined, {
    enabled: faith.data?.ready === true,
    retry: false,
  });

  async function refreshFaith() {
    await Promise.all([
      faith.refetch(),
      faith.data?.ready === true ? comments.refetch() : Promise.resolve(),
    ]);
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.stack}
    >
      <Card style={styles.heroCard}>
        <View style={styles.heroTop}>
          <View style={styles.copy}>
            <Text style={styles.eyebrow}>Faith Corner</Text>
            <SectionTitle>{faith.data?.weeklyTheme ?? 'Faith Corner'}</SectionTitle>
          </View>
          <Badge variant={faith.data?.ready ? 'crimson' : 'neutral'}>
            {faith.data?.ready ? 'Published' : 'Pending'}
          </Badge>
        </View>
        <MutedText>Weekly Scripture memory and reflection for the Learning Centre.</MutedText>
      </Card>

      <StudentFaithCornerPanel
        comments={comments.data}
        commentsError={comments.error?.message ?? null}
        commentsLoading={comments.isLoading}
        faith={faith.data}
        faithError={faith.error?.message ?? null}
        loading={faith.isLoading}
        onRefreshFaith={refreshFaith}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  copy: {
    flex: 1,
    gap: 3,
  },
  eyebrow: {
    color: C.crimson,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  heroCard: {
    gap: 10,
    padding: 16,
  },
  heroTop: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  stack: {
    gap: 14,
  },
});

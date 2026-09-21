import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { type RouterOutputs } from '../../lib/trpc';
import { C } from '../core/mobile-theme';
import { Card, MutedText, SectionTitle } from '../core/mobile-ui';

type LibrarySummary = RouterOutputs['library']['parentSummary'];

function loanStatus(dueOn: Date, today: string): string {
  const due = dueOn.toISOString().slice(0, 10);
  if (due < today) return 'Overdue';
  if (due === today) return 'Due today';
  return `Due ${new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: 'UTC' }).format(dueOn)}`;
}

export function ParentLibraryScreen({
  data,
  loading,
}: {
  data: LibrarySummary | undefined;
  loading: boolean;
}) {
  if (loading) return <MutedText>Loading library…</MutedText>;
  if (!data) return <MutedText>Library records are unavailable.</MutedText>;
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Card>
        <SectionTitle>Books on loan</SectionTitle>
        <MutedText>Due and overdue books remain here until a librarian checks them in.</MutedText>
      </Card>
      <Card>
        <SectionTitle>Current loans</SectionTitle>
        {data.active.length === 0 ? (
          <MutedText>No books are currently on loan.</MutedText>
        ) : (
          data.active.map((loan) => (
            <View key={loan.id} style={styles.loan}>
              <Text style={styles.title}>{loan.book.title}</Text>
              <MutedText>
                {loan.book.author} · {loan.student.name}
              </MutedText>
              <Text
                accessibilityLabel={`Loan status: ${loanStatus(loan.dueOn, data.today)}`}
                style={styles.status}
              >
                {loanStatus(loan.dueOn, data.today)}
              </Text>
            </View>
          ))
        )}
      </Card>
      <Card>
        <SectionTitle>Recently returned</SectionTitle>
        {data.recentReturns.length === 0 ? (
          <MutedText>Returned books will appear here.</MutedText>
        ) : (
          data.recentReturns.map((loan) => (
            <View key={loan.id} style={styles.loan}>
              <Text style={styles.title}>{loan.book.title}</Text>
              <MutedText>{loan.student.name}</MutedText>
            </View>
          ))
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { gap: 14, padding: 14, paddingBottom: 26 },
  loan: { borderTopColor: C.borderLight, borderTopWidth: 1, gap: 3, paddingTop: 12 },
  status: { color: C.crimson, fontSize: 14, fontWeight: '800' },
  title: { color: C.navy, fontSize: 16, fontWeight: '800' },
});

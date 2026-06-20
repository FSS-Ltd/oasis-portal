import { StyleSheet, Text, View } from 'react-native';
import { type RouterOutputs } from '../../lib/trpc';
import { C } from '../core/mobile-theme';
import { Badge, Card, MutedText } from '../core/mobile-ui';

type RecentEntry = RouterOutputs['behaviour']['recentEntries']['entries'][number];

export function BehaviourRecentPanel({
  entries,
  error,
  loading,
}: {
  entries: RecentEntry[];
  error: string | null;
  loading: boolean;
}) {
  return (
    <Card style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.cardTitle}>Today's entries</Text>
        <Badge variant="blue">{String(entries.length)}</Badge>
      </View>
      {loading ? <MutedText>Loading recent entries...</MutedText> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {!loading && !error && entries.length === 0 ? (
        <MutedText>No behaviour entries have been logged today.</MutedText>
      ) : null}
      {entries.slice(0, 6).map((entry) => (
        <View key={entry.id} style={styles.entryRow}>
          <View style={styles.rowBody}>
            <View style={styles.entryHeader}>
              <Text style={styles.studentName}>{entry.studentName}</Text>
              <Badge variant={entry.type === 'Merit' ? 'success' : 'danger'}>
                {entry.meritDelta > 0 ? `+${String(entry.meritDelta)}` : String(entry.meritDelta)}
              </Badge>
              {entry.visibility === 'Sensitive' ? <Badge variant="warning">Sensitive</Badge> : null}
            </View>
            <Text style={styles.entryMeta}>{entry.category}</Text>
            {entry.note ? <Text style={styles.note}>{entry.note}</Text> : null}
          </View>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 10,
    padding: 16,
  },
  cardTitle: {
    color: C.navy,
    fontSize: 14,
    fontWeight: '900',
  },
  entryHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  entryMeta: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },
  entryRow: {
    borderTopColor: C.borderLight,
    borderTopWidth: 1,
    paddingTop: 10,
  },
  errorText: {
    color: C.danger,
    fontSize: 12,
    fontWeight: '700',
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  note: {
    color: C.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  rowBody: {
    gap: 4,
  },
  studentName: {
    color: C.navy,
    fontSize: 13,
    fontWeight: '900',
  },
});

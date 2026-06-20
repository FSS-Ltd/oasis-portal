import { Pressable, StyleSheet, Text, View } from 'react-native';
import { C } from '../core/mobile-theme';
import {
  Badge,
  Card,
  InlineSpinner,
  MutedText,
  SectionTitle,
  MobileButton,
} from '../core/mobile-ui';
import {
  formatParentSlipDate,
  parentPermissionSlipCategoryLabels,
  paymentBadgeVariant,
  paymentLabel,
  responseBadgeVariant,
  responseLabel,
  rowActionLabel,
  type ParentPermissionSlipRow,
  type ParentPermissionSlipTab,
} from './parent-permission-slips-utils';

interface ParentPermissionSlipsListProps {
  completedCount: number;
  loading: boolean;
  outstandingCount: number;
  rows: readonly ParentPermissionSlipRow[];
  tab: ParentPermissionSlipTab;
  onOpen: (row: ParentPermissionSlipRow) => void;
  onSelectTab: (tab: ParentPermissionSlipTab) => void;
}

export function ParentPermissionSlipsList({
  completedCount,
  loading,
  onOpen,
  onSelectTab,
  outstandingCount,
  rows,
  tab,
}: ParentPermissionSlipsListProps) {
  return (
    <View style={styles.stack}>
      <View style={styles.segmented}>
        <MobileButton
          compact
          label={`Outstanding · ${String(outstandingCount)}`}
          onPress={() => {
            onSelectTab('outstanding');
          }}
          variant={tab === 'outstanding' ? 'primary' : 'secondary'}
        />
        <MobileButton
          compact
          label={`Completed · ${String(completedCount)}`}
          onPress={() => {
            onSelectTab('completed');
          }}
          variant={tab === 'completed' ? 'primary' : 'secondary'}
        />
      </View>

      {loading ? <InlineSpinner label="Loading permission slips" /> : null}
      {!loading && rows.length === 0 ? (
        <Card style={styles.emptyCard}>
          <SectionTitle>
            {tab === 'outstanding'
              ? 'No permission slips are waiting for your response.'
              : 'No completed permission slips yet.'}
          </SectionTitle>
          <MutedText>
            {tab === 'outstanding'
              ? 'Trips and activities that need a decision will appear here.'
              : 'Signed, declined, and expired slips will appear here.'}
          </MutedText>
        </Card>
      ) : null}

      {rows.map((row) => (
        <Pressable
          accessibilityRole="button"
          key={`${row.slip.id}:${row.recipient.studentId}`}
          onPress={() => {
            onOpen(row);
          }}
        >
          <Card style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.badges}>
                <Badge variant={row.slip.inactive ? 'neutral' : 'blue'}>
                  {parentPermissionSlipCategoryLabels[row.slip.category]}
                </Badge>
                <Badge variant={responseBadgeVariant(row.recipient.responseStatus)}>
                  {responseLabel(row.recipient.responseStatus)}
                </Badge>
                <Badge variant={paymentBadgeVariant(row.recipient.paymentStatus)}>
                  {paymentLabel(row.recipient.paymentStatus)}
                </Badge>
              </View>
              <Text style={styles.action}>{rowActionLabel(row)}</Text>
            </View>
            <Text style={styles.title}>{row.slip.title}</Text>
            <Text style={styles.meta}>
              {row.recipient.student.fullName} · Respond by{' '}
              {formatParentSlipDate(row.slip.deadline)}
              {row.slip.cost ? ` · ${row.slip.cost}` : ''}
            </Text>
          </Card>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  action: {
    color: C.blue,
    fontSize: 12,
    fontWeight: '800',
  },
  badges: {
    alignItems: 'flex-start',
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    minWidth: 0,
  },
  card: {
    gap: 9,
    padding: 16,
  },
  cardHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  emptyCard: {
    gap: 8,
    padding: 16,
  },
  meta: {
    color: C.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  segmented: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  stack: {
    gap: 12,
  },
  title: {
    color: C.navy,
    fontSize: 17,
    fontWeight: '900',
  },
});

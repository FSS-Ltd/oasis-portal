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
  filterCountLabel,
  formatInvoiceDate,
  formatPence,
  invoiceStatusBadgeVariant,
  invoiceStatusLabel,
  invoiceTitle,
  parentInvoiceStatusFilters,
  studentNames,
  type ParentInvoice,
  type ParentInvoiceStatusFilter,
} from './parent-fees-invoices-utils';

interface ParentFeesInvoicesListProps {
  filter: ParentInvoiceStatusFilter;
  invoices: readonly ParentInvoice[];
  loading: boolean;
  onOpen: (invoice: ParentInvoice) => void;
  onSelectFilter: (filter: ParentInvoiceStatusFilter) => void;
}

export function ParentFeesInvoicesList({
  filter,
  invoices,
  loading,
  onOpen,
  onSelectFilter,
}: ParentFeesInvoicesListProps) {
  return (
    <View style={styles.stack}>
      <View style={styles.segmented}>
        {parentInvoiceStatusFilters.map((status) => (
          <MobileButton
            compact
            key={status}
            label={invoiceStatusLabel(status)}
            onPress={() => {
              onSelectFilter(status);
            }}
            variant={filter === status ? 'primary' : 'secondary'}
          />
        ))}
      </View>

      {loading ? <InlineSpinner label="Loading fees" /> : null}
      {!loading && invoices.length === 0 ? (
        <Card style={styles.emptyCard}>
          <SectionTitle>No invoices match this view.</SectionTitle>
          <MutedText>No linked invoice balance is waiting in this status.</MutedText>
        </Card>
      ) : null}

      {invoices.map((invoice) => (
        <Pressable
          accessibilityRole="button"
          key={invoice.id}
          onPress={() => {
            onOpen(invoice);
          }}
        >
          <Card style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.rowBody}>
                <Text style={styles.invoiceNumber}>{invoiceTitle(invoice)}</Text>
                <Text style={styles.meta}>
                  {invoice.term ?? 'School fees'} · Due {formatInvoiceDate(invoice.dueOn)}
                </Text>
              </View>
              <Badge variant={invoiceStatusBadgeVariant(invoice.displayStatus)}>
                {invoiceStatusLabel(invoice.displayStatus)}
              </Badge>
            </View>
            <View style={styles.footer}>
              <View style={styles.rowBody}>
                <Text style={styles.amount}>{formatPence(invoice.totalAmountPence)}</Text>
                <Text style={styles.meta}>{studentNames(invoice)}</Text>
              </View>
              <Text style={styles.action}>View details</Text>
            </View>
          </Card>
        </Pressable>
      ))}

      {!loading && invoices.length > 0 ? (
        <MutedText>{filterCountLabel(invoices.length)} in this view.</MutedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  action: {
    color: C.blue,
    fontSize: 12,
    fontWeight: '900',
  },
  amount: {
    color: C.navy,
    fontSize: 18,
    fontWeight: '900',
  },
  card: {
    gap: 12,
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
  footer: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  invoiceNumber: {
    color: C.navy,
    fontSize: 16,
    fontWeight: '900',
  },
  meta: {
    color: C.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  rowBody: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  segmented: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  stack: {
    gap: 12,
  },
});

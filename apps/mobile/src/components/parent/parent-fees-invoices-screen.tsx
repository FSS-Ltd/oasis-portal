import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { C } from '../core/mobile-theme';
import { Card, ErrorText, MutedText, SectionTitle } from '../core/mobile-ui';
import { ParentFeesInvoicesDetail } from './parent-fees-invoices-detail';
import { ParentFeesInvoicesList } from './parent-fees-invoices-list';
import {
  formatInvoiceDate,
  formatPence,
  invoiceMatchesStatus,
  type ParentFeesInvoicesData,
  type ParentInvoice,
  type ParentInvoiceStatusFilter,
} from './parent-fees-invoices-utils';

interface ParentFeesInvoicesScreenProps {
  data: ParentFeesInvoicesData | undefined;
  error: string | null;
  loading: boolean;
}

export function ParentFeesInvoicesScreen({ data, error, loading }: ParentFeesInvoicesScreenProps) {
  const [filter, setFilter] = useState<ParentInvoiceStatusFilter>('All');
  const [selected, setSelected] = useState<ParentInvoice | null>(null);
  const invoices = data?.invoices ?? [];
  const stats = data?.stats;
  const yearSummary = data?.yearSummary;
  const visibleInvoices = useMemo(
    () => invoices.filter((invoice) => invoiceMatchesStatus(invoice, filter)),
    [filter, invoices],
  );

  if (selected) {
    return (
      <ParentFeesInvoicesDetail
        invoice={selected}
        onBack={() => {
          setSelected(null);
        }}
      />
    );
  }

  return (
    <View style={styles.stack}>
      <Card style={styles.heroCard}>
        <Text style={styles.eyebrow}>Fees/Invoices</Text>
        <SectionTitle>Current Balance</SectionTitle>
        <Text style={styles.balance}>
          {formatPence(stats?.grossOutstandingAmountPence ?? stats?.outstandingAmountPence ?? 0)}
        </Text>
        <MutedText>{yearSummary?.cycleLabel ?? 'No linked invoice balance'}</MutedText>
        <View style={styles.summaryGrid}>
          <SummaryPill
            label="Outstanding"
            value={formatPence(
              stats?.grossRemainingAmountPence ?? stats?.remainingAmountPence ?? 0,
            )}
          />
          <SummaryPill
            label="Overdue"
            value={formatPence(stats?.grossOverdueAmountPence ?? stats?.overdueAmountPence ?? 0)}
          />
          <SummaryPill
            label="Awaiting confirmation"
            value={String(stats?.paymentPendingCount ?? 0)}
          />
          <SummaryPill label="Paid" value={formatPence(stats?.grossPaidAmountPence ?? 0)} />
        </View>
      </Card>

      <Card style={styles.cycleCard}>
        <SectionTitle>Fee cycle</SectionTitle>
        {yearSummary ? (
          <>
            <Text style={styles.cycleTitle}>{yearSummary.cycleLabel}</Text>
            <MutedText>
              {formatInvoiceDate(yearSummary.cycleStartsOn)} to{' '}
              {formatInvoiceDate(yearSummary.cycleEndsOn)}
            </MutedText>
            <View style={styles.summaryGrid}>
              <SummaryPill label="Annual fee" value={formatPence(yearSummary.annualAmountPence)} />
              <SummaryPill
                label="Adjusted fee"
                value={formatPence(yearSummary.adjustedAnnualAmountPence)}
              />
              <SummaryPill label="Discounts" value={formatPence(yearSummary.discountAmountPence)} />
              <SummaryPill
                label="Left to invoice"
                value={formatPence(yearSummary.grossLeftToInvoiceAmountPence)}
              />
            </View>
          </>
        ) : (
          <MutedText>No linked invoice balance</MutedText>
        )}
      </Card>

      {error ? (
        <Card style={styles.errorCard}>
          <SectionTitle>Fees unavailable</SectionTitle>
          <ErrorText>{error}</ErrorText>
        </Card>
      ) : null}

      <ParentFeesInvoicesList
        filter={filter}
        invoices={visibleInvoices}
        loading={loading}
        onOpen={setSelected}
        onSelectFilter={setFilter}
      />
    </View>
  );
}

function SummaryPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryPill}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  balance: {
    color: C.navy,
    fontSize: 30,
    fontWeight: '900',
  },
  cycleCard: {
    gap: 10,
    padding: 16,
  },
  cycleTitle: {
    color: C.navy,
    fontSize: 14,
    fontWeight: '900',
  },
  errorCard: {
    gap: 8,
    padding: 16,
  },
  eyebrow: {
    color: C.crimson,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  heroCard: {
    gap: 8,
    padding: 16,
  },
  stack: {
    gap: 14,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  summaryLabel: {
    color: C.textSecondary,
    fontSize: 11,
    fontWeight: '800',
  },
  summaryPill: {
    backgroundColor: C.bg,
    borderColor: C.borderLight,
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    gap: 2,
    minWidth: 118,
    padding: 10,
  },
  summaryValue: {
    color: C.navy,
    fontSize: 15,
    fontWeight: '900',
  },
});

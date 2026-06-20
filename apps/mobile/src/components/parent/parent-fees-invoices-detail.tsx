import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api } from '../../lib/trpc';
import { C } from '../smoke/mobile-theme';
import {
  Badge,
  Card,
  ErrorText,
  MutedText,
  SectionTitle,
  SmokeButton,
} from '../smoke/smoke-ui';
import {
  formatFileSize,
  formatInvoiceDate,
  formatPence,
  invoiceStatusBadgeVariant,
  invoiceStatusLabel,
  invoiceTitle,
  studentNames,
  type ParentInvoice,
} from './parent-fees-invoices-utils';

interface ParentFeesInvoicesDetailProps {
  invoice: ParentInvoice;
  onBack: () => void;
}

export function ParentFeesInvoicesDetail({ invoice, onBack }: ParentFeesInvoicesDetailProps) {
  const utils = api.useUtils();
  const [pdfInvoiceId, setPdfInvoiceId] = useState('');
  const [operationStatus, setOperationStatus] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const downloadPdf = api.invoice.downloadPdf.useQuery(
    { invoiceId: pdfInvoiceId || 'pending-invoice-id' },
    { enabled: Boolean(pdfInvoiceId), retry: false },
  );
  const parentMarkPaid = api.invoice.parentMarkPaid.useMutation();
  const paymentWaiting = invoice.status === 'PaymentPending' || Boolean(operationStatus);
  const isUnpaid = invoice.status === 'Unpaid' && !paymentWaiting;

  async function markPaid() {
    setOperationError(null);
    setOperationStatus(null);
    try {
      await parentMarkPaid.mutateAsync({ invoiceId: invoice.id });
      await utils.invoice.listParent.invalidate();
      setOperationStatus('Payment sent for confirmation.');
    } catch (error) {
      setOperationError(
        error instanceof Error ? error.message : 'Payment could not be marked paid.',
      );
    }
  }

  return (
    <View style={styles.stack}>
      <SmokeButton compact label="Back to fees" onPress={onBack} variant="secondary" />

      <Card style={styles.heroCard}>
        <View style={styles.cardHeader}>
          <View style={styles.titleBody}>
            <Text style={styles.eyebrow}>Fees/Invoices</Text>
            <Text style={styles.title}>{invoiceTitle(invoice)}</Text>
            <MutedText>{studentNames(invoice)}</MutedText>
          </View>
          <Badge variant={invoiceStatusBadgeVariant(invoice.displayStatus)}>
            {invoiceStatusLabel(invoice.displayStatus)}
          </Badge>
        </View>
        <Text style={styles.total}>{formatPence(invoice.totalAmountPence)}</Text>
      </Card>

      <Card style={styles.metaCard}>
        <SectionTitle>Invoice details</SectionTitle>
        <View style={styles.metaGrid}>
          <Meta label="Family" value={invoice.familyLabel ?? 'Not set'} />
          <Meta label="Student(s)" value={studentNames(invoice)} />
          <Meta label="Year group" value={invoice.studentYearGroup ?? 'Not set'} />
          <Meta label="Billing" value={invoice.billingCadence ?? invoice.term ?? 'Not set'} />
          <Meta label="Issued" value={formatInvoiceDate(invoice.issuedOn)} />
          <Meta label="Due" value={formatInvoiceDate(invoice.dueOn)} />
          {invoice.paidAt ? <Meta label="Paid on" value={formatInvoiceDate(invoice.paidAt)} /> : null}
        </View>
      </Card>

      <Card style={styles.metaCard}>
        <SectionTitle>Line items</SectionTitle>
        {invoice.lineItems.map((line, index) => {
          const breakdown = invoice.discountBreakdowns.find(
            (candidate) => candidate.lineItemId === line.id || candidate.childIndex === index,
          );
          return (
            <View key={line.id} style={styles.lineItem}>
              <View style={styles.row}>
                <View style={styles.titleBody}>
                  <Text style={styles.lineTitle}>{line.description}</Text>
                  <MutedText>
                    {String(line.quantity)} x {formatPence(line.unitAmountPence)}
                  </MutedText>
                </View>
                <Text style={styles.lineAmount}>{formatPence(line.totalAmountPence)}</Text>
              </View>
              {breakdown && breakdown.discounts.length > 0 ? (
                <View style={styles.discountBreakdown}>
                  {breakdown.discounts.map((discount) => (
                    <View key={`${discount.id}:${String(index)}`} style={styles.row}>
                      <Text style={styles.discountText}>{discount.label}</Text>
                      <Text style={styles.discountText}>
                        -{formatPence(discount.appliedAmountPence)}
                      </Text>
                    </View>
                  ))}
                  <View style={styles.row}>
                    <Text style={styles.netText}>Net for child</Text>
                    <Text style={styles.netText}>{formatPence(breakdown.totalAmountPence)}</Text>
                  </View>
                </View>
              ) : null}
            </View>
          );
        })}
      </Card>

      <Card style={styles.metaCard}>
        <SectionTitle>Discounts</SectionTitle>
        {invoice.discounts.length === 0 ? (
          <MutedText>No discounts applied to this invoice.</MutedText>
        ) : (
          invoice.discounts.map((discount) => (
            <View key={discount.id} style={styles.row}>
              <View style={styles.titleBody}>
                <Text style={styles.lineTitle}>{discount.label}</Text>
                <MutedText>
                  {discount.optedOut
                    ? 'Opted out'
                    : `${formatPence(discount.appliedAmountPence)} applied`}
                </MutedText>
              </View>
              <Text style={styles.lineAmount}>
                {discount.optedOut ? '-' : `-${formatPence(discount.appliedAmountPence)}`}
              </Text>
            </View>
          ))
        )}
      </Card>

      <Card style={styles.metaCard}>
        <SectionTitle>Total</SectionTitle>
        <TotalRow label="Subtotal" value={formatPence(invoice.subtotalAmountPence)} />
        <TotalRow label="Discounts" value={`-${formatPence(invoice.discountAmountPence)}`} />
        <View style={styles.totalRowFinal}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{formatPence(invoice.totalAmountPence)}</Text>
        </View>
      </Card>

      <Card style={styles.metaCard}>
        <SectionTitle>Payment instructions</SectionTitle>
        <MutedText>Payment to be made within 14 days of receipt of invoice.</MutedText>
        <Meta label="Payment reference" value={invoice.invoiceNumber ?? invoice.id} />
        {isUnpaid ? (
          <>
            <Badge variant="warning">Payment required</Badge>
            <SmokeButton
              disabled={parentMarkPaid.isPending}
              label={parentMarkPaid.isPending ? 'Marking paid' : 'Mark as paid'}
              onPress={() => {
                void markPaid();
              }}
              variant="primary"
            />
          </>
        ) : null}
        {paymentWaiting ? (
          <MutedText>Payment is waiting for pastor or head confirmation.</MutedText>
        ) : null}
        {invoice.status === 'Paid' ? <Badge variant="success">Paid</Badge> : null}
        {operationStatus ? <Text style={styles.successText}>{operationStatus}</Text> : null}
        {operationError ? <ErrorText>{operationError}</ErrorText> : null}
      </Card>

      <Card style={styles.metaCard}>
        <SectionTitle>Invoice PDF</SectionTitle>
        <SmokeButton
          label="Download PDF"
          onPress={() => {
            setPdfInvoiceId(invoice.id);
          }}
          variant="secondary"
        />
        {downloadPdf.isFetching ? <MutedText>Preparing PDF</MutedText> : null}
        {downloadPdf.error ? <ErrorText>PDF unavailable</ErrorText> : null}
        {downloadPdf.error ? <MutedText>{downloadPdf.error.message}</MutedText> : null}
        {downloadPdf.data ? (
          <MutedText>
            {downloadPdf.data.fileName} ready · {formatFileSize(downloadPdf.data.fileSizeBytes)}
          </MutedText>
        ) : null}
      </Card>
    </View>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaItem}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.totalRow}>
      <Text style={styles.totalLabel}>{label}</Text>
      <Text style={styles.totalValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cardHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  discountBreakdown: {
    backgroundColor: C.bg,
    borderRadius: 8,
    gap: 7,
    padding: 10,
  },
  discountText: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  eyebrow: {
    color: C.crimson,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  heroCard: {
    gap: 12,
    padding: 16,
  },
  lineAmount: {
    color: C.navy,
    fontSize: 13,
    fontWeight: '900',
  },
  lineItem: {
    borderBottomColor: C.borderLight,
    borderBottomWidth: 1,
    gap: 9,
    paddingBottom: 12,
  },
  lineTitle: {
    color: C.navy,
    fontSize: 13,
    fontWeight: '900',
  },
  metaCard: {
    gap: 12,
    padding: 16,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metaItem: {
    backgroundColor: C.bg,
    borderColor: C.borderLight,
    borderRadius: 8,
    borderWidth: 1,
    flexGrow: 1,
    gap: 3,
    minWidth: 130,
    padding: 10,
  },
  metaLabel: {
    color: C.textSecondary,
    fontSize: 11,
    fontWeight: '800',
  },
  metaValue: {
    color: C.navy,
    fontSize: 12,
    fontWeight: '900',
  },
  netText: {
    color: C.navy,
    fontSize: 12,
    fontWeight: '900',
  },
  row: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  stack: {
    gap: 14,
  },
  successText: {
    color: C.success,
    fontSize: 12,
    fontWeight: '800',
  },
  title: {
    color: C.navy,
    fontSize: 20,
    fontWeight: '900',
  },
  titleBody: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  total: {
    color: C.navy,
    fontSize: 28,
    fontWeight: '900',
  },
  totalLabel: {
    color: C.textSecondary,
    fontSize: 13,
    fontWeight: '800',
  },
  totalRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  totalRowFinal: {
    alignItems: 'center',
    borderTopColor: C.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 10,
  },
  totalValue: {
    color: C.navy,
    fontSize: 14,
    fontWeight: '900',
  },
});

import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { C } from '../smoke/mobile-theme';
import { Card, ErrorText, MutedText, SectionTitle } from '../smoke/smoke-ui';
import { ParentPermissionSlipDetail } from './parent-permission-slips-detail';
import { ParentPermissionSlipsList } from './parent-permission-slips-list';
import {
  parentPermissionSlipRows,
  splitParentPermissionSlipRows,
  type ParentPermissionSlip,
  type ParentPermissionSlipRow,
  type ParentPermissionSlipTab,
} from './parent-permission-slips-utils';

interface ParentPermissionSlipsScreenProps {
  error: string | null;
  loading: boolean;
  slips: readonly ParentPermissionSlip[];
}

export function ParentPermissionSlipsScreen({
  error,
  loading,
  slips,
}: ParentPermissionSlipsScreenProps) {
  const [tab, setTab] = useState<ParentPermissionSlipTab>('outstanding');
  const [selected, setSelected] = useState<ParentPermissionSlipRow | null>(null);
  const rows = useMemo(() => parentPermissionSlipRows(slips), [slips]);
  const { completedRows, outstandingRows } = useMemo(
    () => splitParentPermissionSlipRows(rows),
    [rows],
  );
  const visibleRows = tab === 'outstanding' ? outstandingRows : completedRows;

  if (selected) {
    return (
      <ParentPermissionSlipDetail
        row={selected}
        onBack={() => {
          setSelected(null);
        }}
      />
    );
  }

  return (
    <View style={styles.stack}>
      <Card style={styles.heroCard}>
        <Text style={styles.eyebrow}>Permission Slips</Text>
        <SectionTitle>Trips and activities</SectionTitle>
        <MutedText>Sign, decline, and track payment confirmation for your child.</MutedText>
        <View style={styles.summaryRow}>
          <SummaryPill label="Outstanding" value={outstandingRows.length} />
          <SummaryPill label="Completed" value={completedRows.length} />
        </View>
      </Card>

      {error ? <ErrorText>{error}</ErrorText> : null}
      <ParentPermissionSlipsList
        completedCount={completedRows.length}
        loading={loading}
        outstandingCount={outstandingRows.length}
        rows={visibleRows}
        tab={tab}
        onOpen={setSelected}
        onSelectTab={setTab}
      />
    </View>
  );
}

function SummaryPill({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.summaryPill}>
      <Text style={styles.summaryValue}>{String(value)}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  summaryValue: {
    color: C.navy,
    fontSize: 20,
    fontWeight: '900',
  },
});

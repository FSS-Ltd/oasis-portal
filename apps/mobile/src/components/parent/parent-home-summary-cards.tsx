import { StyleSheet, Text, View } from 'react-native';
import { C } from '../core/mobile-theme';
import { Badge, Card, MutedText } from '../core/mobile-ui';
import {
  formatMerits,
  formatParentDateTime,
  type ParentDashboardChild,
  type ParentHomeSignals,
} from './parent-home-utils';

export function ParentUrgentActionCards({ signals }: { signals: ParentHomeSignals }) {
  const rows = [
    { label: 'Unread messages', value: signals.unreadMessageCount, tone: 'blue' as const },
    { label: 'Unread notices', value: signals.unreadNoticeCount, tone: 'warning' as const },
    { label: 'Fees due', value: signals.feeDueCount, tone: 'danger' as const },
    { label: 'Permission slips', value: signals.permissionSlipCount, tone: 'crimson' as const },
  ];

  return (
    <View style={styles.signalGrid}>
      {rows.map((row) => (
        <View key={row.label} style={styles.signalCard}>
          <Text style={styles.signalValue}>{String(row.value)}</Text>
          <Text style={styles.signalLabel}>{row.label}</Text>
          {row.value > 0 ? <Badge variant={row.tone}>Action</Badge> : null}
        </View>
      ))}
    </View>
  );
}

export function ParentRecentActivityCard({ child }: { child: ParentDashboardChild }) {
  return (
    <Card>
      <Text style={styles.cardTitle}>Recent behaviour</Text>
      {child.behaviour.length === 0 ? <MutedText>No recent behaviour records.</MutedText> : null}
      {child.behaviour.map((entry) => (
        <View key={entry.id} style={styles.behaviourRow}>
          <View
            style={[
              styles.behaviourDot,
              { backgroundColor: entry.meritDelta >= 0 ? C.success : C.danger },
            ]}
          />
          <View style={styles.rowBody}>
            <View style={styles.behaviourHeader}>
              <Badge variant={entry.meritDelta >= 0 ? 'success' : 'danger'}>
                {entry.meritDelta > 0 ? '+' : ''}
                {String(entry.meritDelta)} merits
              </Badge>
              <Text style={styles.rowMeta}>{formatParentDateTime(entry.createdAt)}</Text>
            </View>
            <Text style={styles.rowTitle}>{entry.category}</Text>
            <MutedText>{entry.note ?? entry.type}</MutedText>
          </View>
        </View>
      ))}
    </Card>
  );
}

export function ParentMeritWalletPreview({ child }: { child: ParentDashboardChild }) {
  const balances = child.metrics.meritBalances;
  const rows = [
    { colour: C.crimson, label: 'Spend', value: balances.Spend },
    { colour: C.navy, label: 'Saving', value: balances.Saving },
    { colour: C.blue, label: 'Investment', value: balances.Investment },
  ];

  return (
    <Card>
      <Text style={styles.cardTitle}>Merit Wallet</Text>
      {rows.map((row) => (
        <View key={row.label} style={styles.walletRow}>
          <View style={styles.walletLabelGroup}>
            <View style={[styles.walletSwatch, { backgroundColor: row.colour }]} />
            <Text style={styles.walletLabel}>{row.label} Account</Text>
          </View>
          <Text style={[styles.walletValue, { color: row.colour }]}>{String(row.value)}</Text>
        </View>
      ))}
      <View style={styles.walletTotal}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalValue}>{formatMerits(child.metrics.totalMerits)}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  behaviourDot: {
    borderRadius: 5,
    height: 10,
    marginTop: 7,
    width: 10,
  },
  behaviourHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  behaviourRow: {
    alignItems: 'flex-start',
    borderTopColor: C.borderLight,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingTop: 10,
  },
  cardTitle: {
    color: C.navy,
    fontSize: 16,
    fontWeight: '900',
  },
  rowBody: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  rowMeta: {
    color: C.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  rowTitle: {
    color: C.navy,
    fontSize: 13,
    fontWeight: '900',
  },
  signalCard: {
    backgroundColor: C.surface,
    borderColor: C.border,
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    gap: 5,
    minWidth: 130,
    padding: 12,
  },
  signalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  signalLabel: {
    color: C.textSecondary,
    fontSize: 11,
    fontWeight: '800',
  },
  signalValue: {
    color: C.navy,
    fontSize: 22,
    fontWeight: '900',
  },
  totalLabel: {
    color: C.textSecondary,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  totalValue: {
    color: C.navy,
    fontSize: 16,
    fontWeight: '900',
  },
  walletLabel: {
    color: C.textSecondary,
    fontSize: 13,
    fontWeight: '800',
  },
  walletLabelGroup: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  walletRow: {
    alignItems: 'center',
    borderTopColor: C.borderLight,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 10,
  },
  walletSwatch: {
    borderRadius: 4,
    height: 10,
    width: 10,
  },
  walletTotal: {
    alignItems: 'center',
    backgroundColor: C.bg,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
  },
  walletValue: {
    fontSize: 15,
    fontWeight: '900',
  },
});

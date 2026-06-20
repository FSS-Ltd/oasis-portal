import { Pressable, StyleSheet, Text, View } from 'react-native';
import { C } from '../smoke/mobile-theme';
import { Badge, Card, ErrorText, InlineSpinner, MutedText, SectionTitle } from '../smoke/smoke-ui';
import {
  formatMerits,
  nextLearningSignal,
  walletAccountRows,
  type StudentDashboard,
  type StudentWallet,
} from './student-wallet-utils';

interface StudentHomeScreenProps {
  dashboard: StudentDashboard | undefined;
  error: string | null;
  loading: boolean;
  onOpenWallet: () => void;
  wallet: StudentWallet | undefined;
}

export function StudentHomeScreen({
  dashboard,
  error,
  loading,
  onOpenWallet,
  wallet,
}: StudentHomeScreenProps) {
  if (loading && !dashboard) {
    return (
      <Card style={styles.stateCard}>
        <InlineSpinner label="Loading student dashboard" />
      </Card>
    );
  }

  if (error && !dashboard) {
    return (
      <Card style={styles.stateCard}>
        <SectionTitle>No active student profile is linked to this account.</SectionTitle>
        <ErrorText>{error}</ErrorText>
      </Card>
    );
  }

  if (!dashboard) {
    return (
      <Card style={styles.stateCard}>
        <SectionTitle>No active student profile is linked to this account.</SectionTitle>
        <MutedText>Ask a parent or staff member to check the student account invite.</MutedText>
      </Card>
    );
  }

  const signal = nextLearningSignal(dashboard);
  const totalMerits = wallet?.totalMerits ?? dashboard.merits.totalMerits;

  return (
    <View style={styles.stack}>
      <Card style={styles.heroCard}>
        <View style={styles.heroTop}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{dashboard.profile.iconInitials}</Text>
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.eyebrow}>Student Portal</Text>
            <SectionTitle>Hi, {dashboard.profile.firstName}</SectionTitle>
            <Text style={styles.subtle}>
              {dashboard.profile.yearGroupLabel} · {dashboard.profile.ageBand}
            </Text>
          </View>
        </View>
        <View style={styles.heroStats}>
          <HeroStat label="Total merits" value={formatMerits(totalMerits)} />
          <HeroStat label="PACEs" value={String(dashboard.pace.completedPaceCount)} />
        </View>
      </Card>

      <Card style={styles.walletPreview}>
        <View style={styles.rowBetween}>
          <View>
            <Text style={styles.eyebrow}>Merit wallet</Text>
            <SectionTitle>Total merits</SectionTitle>
          </View>
          <Pressable accessibilityRole="button" onPress={onOpenWallet} style={styles.walletButton}>
            <Text style={styles.walletButtonText}>Wallet</Text>
          </Pressable>
        </View>
        <Text style={styles.walletTotal}>{formatMerits(totalMerits)}</Text>
        <View style={styles.balanceGrid}>
          {walletAccountRows.slice(0, 4).map((row) => (
            <View key={row.account} style={styles.balancePill}>
              <Text style={styles.balanceValue}>
                {formatMerits(
                  wallet?.balances[row.account] ?? dashboard.merits.balances[row.account],
                )}
              </Text>
              <Text style={styles.balanceLabel}>{row.label}</Text>
            </View>
          ))}
        </View>
      </Card>

      <Card style={styles.signalCard}>
        <Text style={styles.eyebrow}>{signal.title}</Text>
        <Text style={styles.signalDetail}>{signal.detail}</Text>
        <View style={styles.metaRow}>
          <Badge variant={dashboard.profile.academicScreensEnabled ? 'blue' : 'neutral'}>
            {dashboard.profile.academicScreensEnabled
              ? 'Academic screens on'
              : 'Academic screens hidden'}
          </Badge>
          <Badge variant="success">{dashboard.attendance.attendanceRate ?? 0}% attendance</Badge>
        </View>
      </Card>

      <Card style={styles.shopCard}>
        <Text style={styles.eyebrow}>Shop</Text>
        <SectionTitle>Reward shop</SectionTitle>
        <MutedText>
          {dashboard.shortcuts.activeShopItemCount > 0
            ? `${String(dashboard.shortcuts.activeShopItemCount)} rewards are available to browse.`
            : 'No rewards are available right now.'}
        </MutedText>
      </Card>

      <Card style={styles.updatesCard}>
        <Text style={styles.eyebrow}>This week</Text>
        <SectionTitle>Latest updates</SectionTitle>
        {dashboard.notifications.latest.length === 0 ? (
          <MutedText>No new student updates.</MutedText>
        ) : (
          dashboard.notifications.latest.map((notification) => (
            <View key={notification.id} style={styles.updateRow}>
              <Text style={styles.updateTitle}>{notification.title}</Text>
              <Text style={styles.updateMeta}>
                {notification.read ? 'Read' : 'Unread'} ·{' '}
                {String(dashboard.notifications.unreadCount)} unread
              </Text>
            </View>
          ))
        )}
      </Card>
    </View>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.heroStat}>
      <Text style={styles.heroStatValue}>{value}</Text>
      <Text style={styles.heroStatLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    backgroundColor: C.crimson,
    borderRadius: 18,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  avatarText: {
    color: C.surface,
    fontSize: 17,
    fontWeight: '900',
  },
  balanceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  balanceLabel: {
    color: C.textSecondary,
    fontSize: 11,
    fontWeight: '800',
  },
  balancePill: {
    backgroundColor: C.bg,
    borderColor: C.borderLight,
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    gap: 3,
    minWidth: 118,
    padding: 10,
  },
  balanceValue: {
    color: C.navy,
    fontSize: 13,
    fontWeight: '900',
  },
  eyebrow: {
    color: C.crimson,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  heroCard: {
    gap: 14,
    padding: 16,
  },
  heroCopy: {
    flex: 1,
    gap: 2,
  },
  heroStat: {
    backgroundColor: C.blueLight,
    borderRadius: 10,
    flex: 1,
    gap: 3,
    padding: 10,
  },
  heroStatLabel: {
    color: C.textSecondary,
    fontSize: 11,
    fontWeight: '800',
  },
  heroStats: {
    flexDirection: 'row',
    gap: 10,
  },
  heroStatValue: {
    color: C.navy,
    fontSize: 14,
    fontWeight: '900',
  },
  heroTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  rowBetween: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  shopCard: {
    gap: 8,
    padding: 16,
  },
  signalCard: {
    gap: 10,
    padding: 16,
  },
  signalDetail: {
    color: C.navy,
    fontSize: 16,
    fontWeight: '900',
  },
  stack: {
    gap: 14,
  },
  stateCard: {
    gap: 10,
    padding: 16,
  },
  subtle: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  updateMeta: {
    color: C.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  updateRow: {
    borderTopColor: C.borderLight,
    borderTopWidth: 1,
    gap: 3,
    paddingTop: 10,
  },
  updateTitle: {
    color: C.navy,
    fontSize: 13,
    fontWeight: '900',
  },
  updatesCard: {
    gap: 10,
    padding: 16,
  },
  walletButton: {
    backgroundColor: C.navy,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  walletButtonText: {
    color: C.surface,
    fontSize: 12,
    fontWeight: '900',
  },
  walletPreview: {
    gap: 12,
    padding: 16,
  },
  walletTotal: {
    color: C.navy,
    fontSize: 24,
    fontWeight: '900',
  },
});

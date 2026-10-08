import { StyleSheet, Text, View } from 'react-native';
import { C } from '../core/mobile-theme';
import { Badge } from '../core/mobile-ui';
import {
  attendanceTone,
  displaySchoolYearLabel,
  initials,
  type ParentDashboardChild,
} from './parent-home-utils';

export function ParentChildHero({ child }: { child: ParentDashboardChild }) {
  const attendanceRate =
    child.metrics.attendanceRate === null ? '-' : `${String(child.metrics.attendanceRate)}%`;

  return (
    <View style={styles.hero}>
      <View style={styles.heroTop}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials(child.student.fullName)}</Text>
        </View>
        <View style={styles.childText}>
          <Text style={styles.childName}>{child.student.fullName}</Text>
          <Text style={styles.childMeta}>{displaySchoolYearLabel(child.student.yearGroup)}</Text>
        </View>
        <View style={styles.totalBox}>
          <Text style={styles.totalValue}>{String(child.metrics.totalMerits)}</Text>
          <Text style={styles.totalLabel}>total merits</Text>
        </View>
      </View>
      <View style={styles.metrics}>
        <HeroMetric
          label="Today"
          tone={attendanceTone(child.todayStatus.label)}
          value={child.todayStatus.label}
        />
        <HeroMetric label="Oasis attendance" value={attendanceRate} />
        <HeroMetric label="PACEs" value={String(child.metrics.pacesCompletedThisAcademicYear)} />
      </View>
    </View>
  );
}

function HeroMetric({
  label,
  tone = 'neutral',
  value,
}: {
  label: string;
  tone?: 'danger' | 'neutral' | 'success' | 'warning';
  value: string;
}) {
  const badgeVariant =
    tone === 'success'
      ? 'success'
      : tone === 'warning'
        ? 'warning'
        : tone === 'danger'
          ? 'danger'
          : 'blue';
  return (
    <View style={styles.metric}>
      <Badge variant={badgeVariant}>{value}</Badge>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 26,
    borderWidth: 1,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  avatarText: {
    color: C.surface,
    fontSize: 15,
    fontWeight: '900',
  },
  childMeta: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    fontWeight: '700',
  },
  childName: {
    color: C.surface,
    fontSize: 19,
    fontWeight: '900',
    lineHeight: 23,
  },
  childText: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  hero: {
    backgroundColor: C.navyMid,
    borderColor: C.navyLight,
    borderRadius: 22,
    borderWidth: 1,
    gap: 18,
    padding: 20,
  },
  heroTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  metric: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    gap: 5,
    minHeight: 66,
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  metricLabel: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
  },
  metrics: {
    flexDirection: 'row',
    gap: 8,
  },
  totalBox: {
    alignItems: 'flex-end',
  },
  totalLabel: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 10,
    fontWeight: '800',
  },
  totalValue: {
    color: C.surface,
    fontSize: 28,
    fontWeight: '900',
  },
});

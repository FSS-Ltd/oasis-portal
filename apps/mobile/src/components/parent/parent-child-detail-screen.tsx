import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { formatPaceIdentifier } from '@oasis/domain';
import { api, type RouterOutputs } from '../../lib/trpc';
import { C } from '../core/mobile-theme';
import { Badge, Card, ErrorText, InlineSpinner, MutedText, SectionTitle } from '../core/mobile-ui';
import { ParentChildHero } from './parent-child-hero';
import { ParentChildSwitcher } from './parent-child-switcher';
import { ParentMeritWalletPreview } from './parent-home-summary-cards';
import {
  formatParentDate,
  formatParentDateTime,
  type ParentDashboardChild,
} from './parent-home-utils';

type ParentReport = RouterOutputs['report']['listForStudent']['reports'][number];

export function ParentChildDetailScreen({
  children,
  dashboardError,
  loadingDashboard,
  onOpenPace,
  onRefresh,
  onSelectChild,
  refreshing,
  selectedChild,
}: {
  children: readonly ParentDashboardChild[];
  dashboardError: string | null;
  loadingDashboard: boolean;
  onOpenPace: () => void;
  onRefresh: () => Promise<void>;
  onSelectChild: (studentId: string) => void;
  refreshing: boolean;
  selectedChild: ParentDashboardChild | null;
}) {
  const selectedStudentId = selectedChild?.student.id ?? '';
  const reports = api.report.listForStudent.useQuery(
    { studentId: selectedStudentId },
    { enabled: Boolean(selectedStudentId), retry: false },
  );
  const currentPace = api.pace.parentCurrent.useQuery(
    { studentId: selectedStudentId },
    { enabled: Boolean(selectedStudentId), retry: false },
  );

  async function refreshAll() {
    await Promise.all([
      onRefresh(),
      selectedStudentId ? reports.refetch() : Promise.resolve(),
      selectedStudentId ? currentPace.refetch() : Promise.resolve(),
    ]);
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          onRefresh={() => {
            void refreshAll();
          }}
          refreshing={refreshing || reports.isFetching || currentPace.isFetching}
        />
      }
      showsVerticalScrollIndicator={false}
      style={styles.scroller}
    >
      <View style={styles.intro}>
        <View style={styles.introTop}>
          <Text style={styles.eyebrow}>Parent Portal</Text>
          <Badge variant="blue">Read-only</Badge>
        </View>
        <Text style={styles.title}>Child detail</Text>
        <Text style={styles.subtitle}>
          {selectedChild
            ? `Review ${selectedChild.student.fullName}'s latest Oasis records.`
            : `${String(children.length)} linked children`}
        </Text>
      </View>

      {loadingDashboard && children.length === 0 ? (
        <InlineSpinner label="Loading linked children" />
      ) : null}
      {dashboardError ? <ErrorText>{dashboardError}</ErrorText> : null}

      {children.length === 0 && !loadingDashboard ? (
        <Card>
          <SectionTitle>No linked children</SectionTitle>
          <MutedText>Linked child records will appear once Oasis connects them to this account.</MutedText>
        </Card>
      ) : null}

      {selectedChild ? (
        <>
          <ParentChildSwitcher
            children={children}
            onSelect={onSelectChild}
            selectedChildId={selectedChild.student.id}
          />
          <ParentChildHero child={selectedChild} />
          <AttendanceSummaryCard child={selectedChild} />
          <PaceProgressCard
            error={currentPace.error?.message ?? null}
            loading={currentPace.isLoading}
            onOpenPace={onOpenPace}
            subjects={currentPace.data?.subjects}
          />
          <VisibleBehaviourCard child={selectedChild} />
          <VisibleNotesCard child={selectedChild} />
          <ReportSummaryCard
            error={reports.error?.message ?? null}
            loading={reports.isLoading}
            reports={reports.data?.reports ?? []}
          />
          <View style={styles.walletSection}>
            <Text style={styles.sectionLabel}>Merit wallet</Text>
            <ParentMeritWalletPreview child={selectedChild} />
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

function AttendanceSummaryCard({ child }: { child: ParentDashboardChild }) {
  const attendanceRate =
    child.metrics.attendanceRate === null ? '-' : `${String(child.metrics.attendanceRate)}%`;

  return (
    <Card style={styles.compactCard}>
      <View style={styles.cardHeader}>
        <SectionTitle>Attendance summary</SectionTitle>
        <Badge variant="blue">{attendanceRate}</Badge>
      </View>
      <View style={styles.statRow}>
        <DetailStat label="Present days" value={String(child.metrics.presentDays)} />
        <DetailStat label="Attended days" value={String(child.metrics.attendedDays)} />
        <DetailStat label="Recorded days" value={String(child.metrics.recordedAttendanceDays)} />
      </View>
      {child.attendance.length === 0 ? <MutedText>No attendance records</MutedText> : null}
      {child.attendance.slice(0, 5).map((row) => (
        <View key={row.id} style={styles.listRow}>
          <View style={styles.rowBody}>
            <Text style={styles.rowTitle}>{formatParentDate(row.date)}</Text>
            <MutedText>Recorded {formatParentDateTime(row.recordedAt)}</MutedText>
          </View>
          <Badge variant={attendanceVariant(row.status)}>{row.status}</Badge>
        </View>
      ))}
    </Card>
  );
}

function PaceProgressCard({
  error,
  loading,
  onOpenPace,
  subjects,
}: {
  error: string | null;
  loading: boolean;
  onOpenPace: () => void;
  subjects: RouterOutputs['pace']['parentCurrent']['subjects'] | undefined;
}) {
  return (
    <Card style={styles.compactCard}>
      <View style={styles.cardHeader}>
        <SectionTitle>Current PACE</SectionTitle>
      </View>
      {loading ? <InlineSpinner label="Loading current PACE subjects" /> : null}
      {error ? <ErrorText>{error}</ErrorText> : null}
      {!loading && !error && subjects?.length === 0 ? (
        <MutedText>No active PACE subjects are assigned.</MutedText>
      ) : null}
      {subjects?.slice(0, 3).map((subject) => (
        <View key={subject.subjectCode} style={styles.listRow}>
          <View style={styles.rowBody}>
            <Text style={styles.rowTitle}>
              {subject.subjectCode} {subject.subjectName}
            </Text>
            <MutedText>Current subject</MutedText>
          </View>
          <Text style={styles.currentPaceNumber}>
            PACE {formatPaceIdentifier(subject.currentPaceNumber)}
          </Text>
        </View>
      ))}
      <Pressable
        accessibilityLabel="View full PACE progress"
        accessibilityRole="button"
        onPress={onOpenPace}
        style={styles.paceAction}
      >
        <Text style={styles.paceActionText}>View Full PACE</Text>
      </Pressable>
    </Card>
  );
}

function VisibleBehaviourCard({ child }: { child: ParentDashboardChild }) {
  return (
    <Card style={styles.compactCard}>
      <SectionTitle>Visible behaviour</SectionTitle>
      {child.behaviour.length === 0 ? <MutedText>No visible behaviour</MutedText> : null}
      {child.behaviour.slice(0, 5).map((entry) => (
        <View key={entry.id} style={styles.activityRow}>
          <View
            style={[
              styles.deltaBadge,
              entry.meritDelta >= 0 ? styles.deltaPositive : styles.deltaNegative,
            ]}
          >
            <Text
              style={[
                styles.deltaText,
                entry.meritDelta >= 0 ? styles.deltaTextPositive : styles.deltaTextNegative,
              ]}
            >
              {entry.meritDelta > 0 ? '+' : ''}
              {String(entry.meritDelta)}
            </Text>
          </View>
          <View style={styles.rowBody}>
            <Text style={styles.rowTitle}>{entry.category}</Text>
            <MutedText>{entry.note ?? entry.type}</MutedText>
          </View>
          <Text style={styles.rowMeta}>{formatParentDateTime(entry.createdAt)}</Text>
        </View>
      ))}
    </Card>
  );
}

function VisibleNotesCard({ child }: { child: ParentDashboardChild }) {
  return (
    <Card style={styles.compactCard}>
      <SectionTitle>Visible notes</SectionTitle>
      {child.notes.length === 0 ? <MutedText>No visible notes</MutedText> : null}
      {child.notes.slice(0, 5).map((note) => (
        <View key={note.id} style={styles.noteRow}>
          <Text style={styles.rowTitle}>{formatParentDateTime(note.createdAt)}</Text>
          <MutedText>{note.note}</MutedText>
        </View>
      ))}
    </Card>
  );
}

function ReportSummaryCard({
  error,
  loading,
  reports,
}: {
  error: string | null;
  loading: boolean;
  reports: readonly ParentReport[];
}) {
  return (
    <Card style={styles.compactCard}>
      <View style={styles.cardHeader}>
        <SectionTitle>Report summary</SectionTitle>
        <Badge variant="blue">Sent</Badge>
      </View>
      {loading ? <InlineSpinner label="Loading sent reports" /> : null}
      {error ? <ErrorText>{error}</ErrorText> : null}
      {!loading && reports.length === 0 ? <MutedText>No sent reports</MutedText> : null}
      {reports.slice(0, 3).map((report) => (
        <View key={report.id} style={styles.reportCard}>
          <View style={styles.reportHeader}>
            <Text style={styles.rowTitle}>{report.period.label}</Text>
            <Badge variant="success">{report.status}</Badge>
          </View>
          <MutedText>
            Sent{' '}
            {report.sentAt
              ? formatParentDateTime(report.sentAt)
              : formatParentDateTime(report.updatedAt)}
          </MutedText>
          {report.compiled.sections.progressComment && report.compiled.headSummary ? (
            <Text style={styles.summaryText}>{report.compiled.headSummary}</Text>
          ) : null}
        </View>
      ))}
    </Card>
  );
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function attendanceVariant(status: ParentDashboardChild['attendance'][number]['status']) {
  switch (status) {
    case 'Present':
      return 'success';
    case 'Late':
      return 'warning';
    case 'Absent':
      return 'danger';
  }
}

const styles = StyleSheet.create({
  activityRow: {
    alignItems: 'flex-start',
    borderTopColor: C.borderLight,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingTop: 10,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  compactCard: {
    gap: 10,
    padding: 16,
  },
  currentPaceNumber: {
    color: C.crimson,
    fontSize: 12,
    fontWeight: '900',
  },
  content: {
    gap: 14,
    padding: 16,
    paddingBottom: 36,
  },
  deltaBadge: {
    alignItems: 'center',
    borderRadius: 8,
    minWidth: 34,
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  deltaNegative: {
    backgroundColor: C.dangerBg,
  },
  deltaPositive: {
    backgroundColor: C.successBg,
  },
  deltaText: {
    fontSize: 12,
    fontWeight: '900',
  },
  deltaTextNegative: {
    color: C.danger,
  },
  deltaTextPositive: {
    color: C.success,
  },
  eyebrow: {
    color: C.crimson,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  intro: {
    gap: 4,
  },
  introTop: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  listRow: {
    alignItems: 'center',
    borderTopColor: C.borderLight,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    paddingTop: 10,
  },
  noteRow: {
    borderTopColor: C.borderLight,
    borderTopWidth: 1,
    gap: 4,
    paddingTop: 10,
  },
  paceAction: {
    alignItems: 'center',
    borderColor: C.border,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 14,
  },
  paceActionText: {
    color: C.navy,
    fontSize: 13,
    fontWeight: '900',
  },
  reportCard: {
    backgroundColor: C.bg,
    borderColor: C.border,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
    padding: 12,
  },
  reportHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  rowBody: {
    flex: 1,
    gap: 3,
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
  scroller: {
    flex: 1,
  },
  sectionLabel: {
    color: C.navy,
    fontSize: 16,
    fontWeight: '900',
  },
  statCard: {
    backgroundColor: C.bg,
    borderRadius: 10,
    flex: 1,
    gap: 4,
    minWidth: 92,
    padding: 10,
  },
  statLabel: {
    color: C.textSecondary,
    fontSize: 10,
    fontWeight: '800',
  },
  statRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statValue: {
    color: C.navy,
    fontSize: 18,
    fontWeight: '900',
  },
  subtitle: {
    color: C.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  summaryText: {
    color: C.textPrimary,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  title: {
    color: C.navy,
    fontSize: 23,
    fontWeight: '900',
    lineHeight: 28,
  },
  walletSection: {
    gap: 8,
  },
});

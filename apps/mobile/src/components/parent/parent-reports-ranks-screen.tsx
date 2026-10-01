import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api, type RouterOutputs } from '../../lib/trpc';
import { C } from '../core/mobile-theme';
import {
  Badge,
  Card,
  ErrorText,
  InlineSpinner,
  MutedText,
  SectionTitle,
  MobileButton,
} from '../core/mobile-ui';
import { ParentChildHero } from './parent-child-hero';
import { ParentChildSwitcher } from './parent-child-switcher';
import {
  displaySchoolYearLabel,
  formatParentDate,
  type ParentDashboardChild,
} from './parent-home-utils';

type ParentReport = RouterOutputs['report']['listForStudent']['reports'][number];
type LeaderboardRow = RouterOutputs['leaderboard']['get']['rows'][number];
type ParentLeaderboardKind = 'TopSavers' | 'TopInvestors' | 'TopTithers';

const leaderboardOptions: Array<{
  kind: ParentLeaderboardKind;
  label: string;
  scoreLabel: string;
}> = [
  { kind: 'TopSavers', label: 'Top Savers', scoreLabel: 'saved merits' },
  { kind: 'TopInvestors', label: 'Top Investors', scoreLabel: 'investment value' },
  { kind: 'TopTithers', label: 'Top Tithers', scoreLabel: 'tithed merits' },
];

const numberFormatter = new Intl.NumberFormat('en-GB');

export function ParentReportsRanksScreen({
  children,
  dashboardError,
  loadingDashboard,
  onRefresh,
  onSelectChild,
  refreshing,
  selectedChild,
}: {
  children: readonly ParentDashboardChild[];
  dashboardError: string | null;
  loadingDashboard: boolean;
  onRefresh: () => Promise<void>;
  onSelectChild: (studentId: string) => void;
  refreshing: boolean;
  selectedChild: ParentDashboardChild | null;
}) {
  const [selectedReportId, setSelectedReportId] = useState('');
  const [leaderboardKind, setLeaderboardKind] = useState<ParentLeaderboardKind>('TopSavers');
  const selectedStudentId = selectedChild?.student.id ?? '';
  const reportsQuery = api.report.listForStudent.useQuery(
    { studentId: selectedStudentId },
    { enabled: Boolean(selectedStudentId), retry: false },
  );
  const leaderboard = api.leaderboard.get.useQuery(
    { includeViewerRows: true, kind: leaderboardKind, limit: 10 },
    { retry: false },
  );

  const reports = useMemo(() => reportsQuery.data?.reports ?? [], [reportsQuery.data?.reports]);
  const selectedReport =
    reports.find((report) => report.id === selectedReportId) ?? reports[0] ?? null;
  const rankRows = leaderboard.data?.rows ?? [];
  const linkedRankRows = leaderboard.data?.viewerRows ?? [];
  const leaderboardOption = leaderboardOptions.find((option) => option.kind === leaderboardKind);

  useEffect(() => {
    setSelectedReportId('');
  }, [selectedStudentId]);

  useEffect(() => {
    if (reports.length === 0) {
      setSelectedReportId('');
      return;
    }
    if (selectedReportId && reports.some((report) => report.id === selectedReportId)) return;
    setSelectedReportId(reports[0]?.id ?? '');
  }, [reports, selectedReportId]);

  async function refreshAll() {
    await Promise.all([
      onRefresh(),
      selectedStudentId ? reportsQuery.refetch() : Promise.resolve(),
      leaderboard.refetch(),
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
          refreshing={refreshing || reportsQuery.isFetching || leaderboard.isFetching}
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
        <Text style={styles.title}>Reports and ranks</Text>
        <Text style={styles.subtitle}>
          Sent student reports and positive merit economy ranks for linked children.
        </Text>
      </View>

      {loadingDashboard && children.length === 0 ? (
        <InlineSpinner label="Loading linked children" />
      ) : null}
      {dashboardError ? <ErrorText>{dashboardError}</ErrorText> : null}

      {children.length === 0 && !loadingDashboard ? (
        <Card>
          <SectionTitle>No linked children</SectionTitle>
          <MutedText>
            Linked child reports and ranks will appear once Oasis connects this account.
          </MutedText>
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
          <ReportListCard
            loading={reportsQuery.isLoading}
            onSelect={setSelectedReportId}
            reports={reports}
            selectedReportId={selectedReport?.id ?? ''}
            studentName={selectedChild.student.fullName}
          />
          <ReportDetailCard report={selectedReport} />
        </>
      ) : null}

      <RanksCard
        kind={leaderboardKind}
        linkedRows={linkedRankRows}
        loading={leaderboard.isLoading}
        onKindChange={setLeaderboardKind}
        rows={rankRows}
        scoreLabel={leaderboardOption?.scoreLabel ?? 'merits'}
      />
      {leaderboard.error ? <ErrorText>{leaderboard.error.message}</ErrorText> : null}
      {reportsQuery.error ? <ErrorText>{reportsQuery.error.message}</ErrorText> : null}
    </ScrollView>
  );
}

function ReportListCard({
  loading,
  onSelect,
  reports,
  selectedReportId,
  studentName,
}: {
  loading: boolean;
  onSelect: (reportId: string) => void;
  reports: readonly ParentReport[];
  selectedReportId: string;
  studentName: string;
}) {
  return (
    <Card style={styles.compactCard}>
      <View style={styles.cardHeader}>
        <View>
          <SectionTitle>Student reports</SectionTitle>
          <MutedText>{studentName}</MutedText>
        </View>
        <Badge variant="blue">{formatCount(reports.length, 'report')}</Badge>
      </View>
      {loading ? <InlineSpinner label="Loading sent reports" /> : null}
      {!loading && reports.length === 0 ? <MutedText>No sent reports</MutedText> : null}
      {reports.map((report) => (
        <View key={report.id} style={styles.reportHistoryRow}>
          <View style={styles.rowBody}>
            <Text style={styles.rowTitle}>{report.period.label}</Text>
            <MutedText>Sent {formatParentDate(report.sentAt ?? report.updatedAt)}</MutedText>
          </View>
          <Badge variant="success">{report.status}</Badge>
          <MobileButton
            compact
            label={report.id === selectedReportId ? 'Selected' : 'View'}
            onPress={() => {
              onSelect(report.id);
            }}
            variant={report.id === selectedReportId ? 'primary' : 'secondary'}
          />
        </View>
      ))}
    </Card>
  );
}

function ReportDetailCard({ report }: { report: ParentReport | null }) {
  if (!report) {
    return (
      <Card style={styles.compactCard}>
        <SectionTitle>Report detail</SectionTitle>
        <MutedText>No sent reports</MutedText>
      </Card>
    );
  }

  const { compiled } = report;
  const attendanceDetail = `${formatNumber(compiled.attendance.present)} present, ${formatNumber(
    compiled.attendance.absent,
  )} absent, ${formatNumber(compiled.attendance.late)} late`;

  return (
    <Card style={styles.compactCard}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.sectionLabel}>Report detail</Text>
          <Text style={styles.reportTitle}>{compiled.studentDisplayName}</Text>
          <MutedText>{report.period.label}</MutedText>
        </View>
        <Badge variant="success">Sent</Badge>
      </View>
      {compiled.sections.attendance ||
      compiled.sections.behaviourSummary ||
      compiled.sections.balances ? (
        <View style={styles.metricGrid}>
          {compiled.sections.attendance ? (
            <ReportMetric
              detail={attendanceDetail}
              label="Attendance"
              value={`${String(compiled.attendance.attendancePct)}%`}
            />
          ) : null}
          {compiled.sections.behaviourSummary ? (
            <ReportMetric
              detail={`${formatNumber(compiled.behaviour.demeritsCount)} demerits`}
              label="Merits"
              value={formatNumber(compiled.behaviour.meritsEarned)}
            />
          ) : null}
          {compiled.sections.balances ? (
            <>
              <ReportMetric label="Spend" value={formatNumber(compiled.balances.Spend)} />
              <ReportMetric label="Saving" value={formatNumber(compiled.balances.Saving)} />
            </>
          ) : null}
        </View>
      ) : null}
      {compiled.sections.paceProgress ? <ReportPaceSection report={report} /> : null}
      {compiled.sections.generalNotes ? (
        <TextEntries
          emptyLabel="No general notes recorded."
          entries={compiled.notes}
          title="General Notes"
        />
      ) : null}
      {compiled.sections.behaviourNotes ? (
        <TextEntries
          emptyLabel="No general behaviour notes recorded."
          entries={compiled.behaviour.generalEntries}
          title="Behaviour Notes"
        />
      ) : null}
      {compiled.sections.meritActivity ? (
        <TextEntries
          emptyLabel="No merit activity recorded."
          entries={compiled.meritActivity.map((activity) => ({
            createdAt: activity.createdAt,
            note: `${activity.account}: ${activity.reason} (${formatSignedNumber(activity.delta)})`,
          }))}
          title="Merit Activity"
        />
      ) : null}
      {compiled.sections.progressComment ? (
        <View style={styles.noteSection}>
          <Text style={styles.sectionLabel}>Progress Comment</Text>
          <MutedText>{compiled.headSummary.trim() || 'No progress comment recorded.'}</MutedText>
        </View>
      ) : null}
    </Card>
  );
}

function ReportPaceSection({ report }: { report: ParentReport }) {
  const paces = report.compiled.paces;
  return (
    <View style={styles.noteSection}>
      <View style={styles.cardHeader}>
        <Text style={styles.sectionLabel}>PACE Progress</Text>
        <MutedText>{formatCount(paces.length, 'subject')}</MutedText>
      </View>
      {paces.length === 0 ? <MutedText>No PACE progress recorded.</MutedText> : null}
      {paces.map((pace) => (
        <View key={`${pace.subjectCode}-${String(pace.currentPace)}`} style={styles.listRow}>
          <View style={styles.rowBody}>
            <Text style={styles.rowTitle}>{pace.subjectName}</Text>
            <MutedText>
              {pace.subjectCode} - Current PACE {String(pace.currentPace)}
            </MutedText>
            {pace.placementPaceNumber !== undefined &&
            pace.placementPaceNumber !== pace.currentPace ? (
              <MutedText>Intended placement: PACE {String(pace.placementPaceNumber)}</MutedText>
            ) : null}
          </View>
          <Text style={styles.rowValue}>
            {pace.averageTestScore === null ? 'N/A' : `${String(pace.averageTestScore)}%`}
          </Text>
          {report.compiled.sections.paceStatus ? (
            <Badge variant={paceStatusBadgeVariant(pace.status.tone)}>{pace.status.status}</Badge>
          ) : null}
        </View>
      ))}
    </View>
  );
}

function TextEntries({
  emptyLabel,
  entries,
  title,
}: {
  emptyLabel: string;
  entries: readonly { createdAt: string | Date; note: string | null }[];
  title: string;
}) {
  return (
    <View style={styles.noteSection}>
      <Text style={styles.sectionLabel}>{title}</Text>
      {entries.length === 0 ? <MutedText>{emptyLabel}</MutedText> : null}
      {entries.slice(0, 4).map((entry) => (
        <View key={`${String(entry.createdAt)}-${entry.note ?? ''}`} style={styles.noteRow}>
          <Text style={styles.rowTitle}>{formatParentDate(entry.createdAt)}</Text>
          <MutedText>{entry.note ?? 'No note recorded.'}</MutedText>
        </View>
      ))}
    </View>
  );
}

function RanksCard({
  kind,
  linkedRows,
  loading,
  onKindChange,
  rows,
  scoreLabel,
}: {
  kind: ParentLeaderboardKind;
  linkedRows: readonly LeaderboardRow[];
  loading: boolean;
  onKindChange: (kind: ParentLeaderboardKind) => void;
  rows: readonly LeaderboardRow[];
  scoreLabel: string;
}) {
  return (
    <View style={styles.rankStack}>
      <Card style={styles.compactCard}>
        <View style={styles.cardHeader}>
          <SectionTitle>Positive ranks</SectionTitle>
          <Badge variant="blue">Top 10</Badge>
        </View>
        <Text style={styles.sectionLabel}>Linked child ranks</Text>
        {linkedRows.length === 0 ? (
          <MutedText>Linked children do not have a rank on this board yet.</MutedText>
        ) : null}
        {linkedRows.map((row) => (
          <LeaderboardRowItem key={row.studentId} row={row} scoreLabel={scoreLabel} viewer />
        ))}
        <View style={styles.buttonGrid}>
          {leaderboardOptions.map((option) => (
            <MobileButton
              compact
              key={option.kind}
              label={option.label}
              onPress={() => {
                onKindChange(option.kind);
              }}
              variant={kind === option.kind ? 'primary' : 'secondary'}
            />
          ))}
        </View>
      </Card>
      {loading ? <InlineSpinner label="Loading rankings" /> : null}
      <Card style={styles.compactCard}>
        {rows.length === 0 && !loading ? <MutedText>No rankings available</MutedText> : null}
        {rows.map((row) => (
          <LeaderboardRowItem key={row.studentId} row={row} scoreLabel={scoreLabel} />
        ))}
      </Card>
    </View>
  );
}

function LeaderboardRowItem({
  row,
  scoreLabel,
  viewer = false,
}: {
  row: LeaderboardRow;
  scoreLabel: string;
  viewer?: boolean;
}) {
  return (
    <View style={[styles.rankRow, viewer ? styles.rankRowViewer : null]}>
      <View style={styles.rankBadge}>
        <Text style={styles.rankText}>{rankLabel(row.rank)}</Text>
      </View>
      <View style={styles.rowBody}>
        <Text numberOfLines={1} style={styles.rowTitle}>
          {row.displayName}
        </Text>
        <MutedText>{displaySchoolYearLabel(row.yearGroup)}</MutedText>
      </View>
      <View style={styles.scoreBox}>
        <Text style={styles.score}>{formatNumber(row.score)}</Text>
        <Text style={styles.scoreMeta}>{scoreLabel}</Text>
      </View>
    </View>
  );
}

function ReportMetric({ detail, label, value }: { detail?: string; label: string; value: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
      {detail ? <Text style={styles.metricDetail}>{detail}</Text> : null}
    </View>
  );
}

function formatCount(count: number, singular: string): string {
  return count === 1 ? `1 ${singular}` : `${formatNumber(count)} ${singular}s`;
}

function formatNumber(value: number): string {
  return numberFormatter.format(Math.round(value));
}

function formatSignedNumber(value: number): string {
  if (value === 0) return '0';
  return `${value > 0 ? '+' : ''}${formatNumber(value)}`;
}

function paceStatusBadgeVariant(
  tone: 'amber' | 'blue' | 'green' | 'grey',
): 'blue' | 'neutral' | 'success' | 'warning' {
  if (tone === 'green') return 'success';
  if (tone === 'amber') return 'warning';
  return tone === 'blue' ? 'blue' : 'neutral';
}

function rankLabel(rank: number): string {
  if (rank <= 3) return String(rank);
  return `#${String(rank)}`;
}

const styles = StyleSheet.create({
  buttonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  compactCard: {
    gap: 12,
    padding: 16,
  },
  content: {
    gap: 14,
    padding: 16,
    paddingBottom: 36,
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
  metricCard: {
    backgroundColor: C.bg,
    borderRadius: 10,
    flex: 1,
    gap: 3,
    minWidth: 124,
    padding: 10,
  },
  metricDetail: {
    color: C.textMuted,
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 14,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricLabel: {
    color: C.textSecondary,
    fontSize: 10,
    fontWeight: '800',
  },
  metricValue: {
    color: C.navy,
    fontSize: 18,
    fontWeight: '900',
  },
  noteRow: {
    borderTopColor: C.borderLight,
    borderTopWidth: 1,
    gap: 4,
    paddingTop: 10,
  },
  noteSection: {
    borderTopColor: C.borderLight,
    borderTopWidth: 1,
    gap: 10,
    paddingTop: 12,
  },
  rankBadge: {
    alignItems: 'center',
    backgroundColor: C.blueLight,
    borderRadius: 8,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  rankRow: {
    alignItems: 'center',
    borderBottomColor: C.borderLight,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingBottom: 10,
  },
  rankRowViewer: {
    backgroundColor: C.crimsonLight,
    borderColor: C.crimsonLight,
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
  },
  rankStack: {
    gap: 14,
  },
  rankText: {
    color: C.navy,
    fontSize: 14,
    fontWeight: '900',
  },
  reportTitle: {
    color: C.navy,
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 23,
  },
  reportHistoryRow: {
    alignItems: 'center',
    borderTopColor: C.borderLight,
    borderTopWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingTop: 10,
  },
  rowBody: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  rowTitle: {
    color: C.navy,
    fontSize: 13,
    fontWeight: '900',
  },
  rowValue: {
    color: C.crimson,
    fontSize: 14,
    fontWeight: '900',
  },
  score: {
    color: C.crimson,
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'right',
  },
  scoreBox: {
    alignItems: 'flex-end',
    minWidth: 86,
  },
  scoreMeta: {
    color: C.textMuted,
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'right',
  },
  scroller: {
    flex: 1,
  },
  sectionLabel: {
    color: C.navy,
    fontSize: 15,
    fontWeight: '900',
  },
  subtitle: {
    color: C.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  title: {
    color: C.navy,
    fontSize: 23,
    fontWeight: '900',
    lineHeight: 28,
  },
});

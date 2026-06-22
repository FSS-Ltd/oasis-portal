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
  formatParentDate,
  formatParentDateTime,
  type ParentDashboardChild,
} from './parent-home-utils';

type ParentIncidentCopy = RouterOutputs['incident']['listParent'][number];

const numberFormatter = new Intl.NumberFormat('en-GB');

export function ParentIncidentReportsScreen({
  children,
  dashboardError,
  loadingDashboard,
  onOpenMessages,
  onRefresh,
  onSelectChild,
  refreshing,
  selectedChild,
}: {
  children: readonly ParentDashboardChild[];
  dashboardError: string | null;
  loadingDashboard: boolean;
  onOpenMessages: () => void;
  onRefresh: () => Promise<void>;
  onSelectChild: (studentId: string) => void;
  refreshing: boolean;
  selectedChild: ParentDashboardChild | null;
}) {
  const [selectedCopyId, setSelectedCopyId] = useState('');
  const [pdfCopyId, setPdfCopyId] = useState('');
  const [acknowledgementStatus, setAcknowledgementStatus] = useState<string | null>(null);
  const [acknowledgementError, setAcknowledgementError] = useState<string | null>(null);
  const selectedStudentId = selectedChild?.student.id ?? '';
  const incidentReports = api.incident.listParent.useQuery(undefined, { retry: false });
  const parentPdf = api.incident.downloadParentPdf.useQuery(
    { copyId: pdfCopyId || 'pending-parent-copy' },
    { enabled: Boolean(pdfCopyId), retry: false },
  );
  const acknowledgeParentCopy = api.incident.acknowledgeParentCopy.useMutation();
  const utils = api.useUtils();

  const childReports = useMemo(() => {
    const reports = incidentReports.data ?? [];
    if (!selectedStudentId) return reports;
    return reports.filter((report) => report.studentId === selectedStudentId);
  }, [incidentReports.data, selectedStudentId]);
  const selectedReport =
    childReports.find((report) => report.id === selectedCopyId) ?? childReports[0] ?? null;
  const stats = useMemo(() => incidentStats(childReports), [childReports]);

  useEffect(() => {
    setSelectedCopyId('');
    setPdfCopyId('');
    setAcknowledgementStatus(null);
    setAcknowledgementError(null);
  }, [selectedStudentId]);

  useEffect(() => {
    if (childReports.length === 0) {
      setSelectedCopyId('');
      return;
    }
    if (selectedCopyId && childReports.some((report) => report.id === selectedCopyId)) return;
    setSelectedCopyId(childReports[0]?.id ?? '');
  }, [childReports, selectedCopyId]);

  async function refreshAll() {
    await Promise.all([onRefresh(), incidentReports.refetch()]);
  }

  async function acknowledge(report: ParentIncidentCopy) {
    setAcknowledgementStatus(null);
    setAcknowledgementError(null);
    try {
      await acknowledgeParentCopy.mutateAsync({ copyId: report.id });
      setAcknowledgementStatus('Incident receipt acknowledged.');
      await utils.incident.listParent.invalidate();
    } catch (error) {
      setAcknowledgementError(
        error instanceof Error
          ? error.message
          : 'Incident receipt could not be acknowledged.',
      );
    }
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          onRefresh={() => {
            void refreshAll();
          }}
          refreshing={refreshing || incidentReports.isFetching}
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
        <Text style={styles.title}>Incident reports</Text>
        <Text style={styles.subtitle}>
          View signed-off reports shared by Oasis Learning Centre.
        </Text>
      </View>

      {loadingDashboard && children.length === 0 ? (
        <InlineSpinner label="Loading linked children" />
      ) : null}
      {dashboardError ? <ErrorText>{dashboardError}</ErrorText> : null}
      {incidentReports.error ? <ErrorText>{incidentReports.error.message}</ErrorText> : null}

      {children.length === 0 && !loadingDashboard ? (
        <Card>
          <SectionTitle>No linked children</SectionTitle>
          <MutedText>
            Shared incident reports will appear once Oasis connects this account to a child.
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
          <IncidentStatsCard reports={childReports} stats={stats} />
          <IncidentListCard
            loading={incidentReports.isLoading}
            onPdfAction={setPdfCopyId}
            onSelect={setSelectedCopyId}
            reports={childReports}
            selectedCopyId={selectedReport?.id ?? ''}
          />
          <IncidentDetailCard
            acknowledgementError={acknowledgementError}
            acknowledgementStatus={acknowledgementStatus}
            acknowledging={acknowledgeParentCopy.isPending}
            onAcknowledge={(report) => {
              void acknowledge(report);
            }}
            onOpenMessages={onOpenMessages}
            onPdfAction={setPdfCopyId}
            pdfCopyId={pdfCopyId}
            pdfError={parentPdf.error?.message ?? null}
            pdfFileName={parentPdf.data?.fileName ?? null}
            pdfLoading={parentPdf.isFetching}
            report={selectedReport}
          />
        </>
      ) : null}
    </ScrollView>
  );
}

function IncidentStatsCard({
  reports,
  stats,
}: {
  reports: readonly ParentIncidentCopy[];
  stats: {
    acknowledged: number;
    downloaded: number;
    shared: number;
    waiting: number;
  };
}) {
  return (
    <Card style={styles.compactCard}>
      <View style={styles.cardHeader}>
        <SectionTitle>Shared incident reports</SectionTitle>
        <Badge variant={stats.waiting > 0 ? 'crimson' : 'blue'}>
          {stats.waiting > 0 ? 'Acknowledgement due' : 'Acknowledged'}
        </Badge>
      </View>
      <View style={styles.metricGrid}>
        <IncidentMetric label="Shared reports" value={formatNumber(stats.shared)} />
        <IncidentMetric label="Acknowledgement due" value={formatNumber(stats.waiting)} />
        <IncidentMetric label="Acknowledged" value={formatNumber(stats.acknowledged)} />
        <IncidentMetric label="Downloaded" value={formatNumber(stats.downloaded)} />
      </View>
      {reports.length === 0 ? (
        <MutedText>No signed-off incident reports have been shared.</MutedText>
      ) : null}
    </Card>
  );
}

function IncidentListCard({
  loading,
  onPdfAction,
  onSelect,
  reports,
  selectedCopyId,
}: {
  loading: boolean;
  onPdfAction: (copyId: string) => void;
  onSelect: (copyId: string) => void;
  reports: readonly ParentIncidentCopy[];
  selectedCopyId: string;
}) {
  return (
    <Card style={styles.compactCard}>
      <View style={styles.cardHeader}>
        <SectionTitle>Shared incident reports</SectionTitle>
        <Badge variant="blue">{formatCount(reports.length, 'report')}</Badge>
      </View>
      {loading ? <InlineSpinner label="Loading incident reports" /> : null}
      {!loading && reports.length === 0 ? (
        <MutedText>No signed-off incident reports</MutedText>
      ) : null}
      {reports.map((report) => (
        <View key={report.id} style={styles.reportRow}>
          <View style={styles.rowBody}>
            <Text style={styles.rowTitle}>{report.reportNumber}</Text>
            <MutedText>
              {formatIncidentType(report.type)} - {formatParentDate(report.occurredAt)}
            </MutedText>
          </View>
          <Badge variant={report.requiresAcknowledgement ? 'crimson' : 'success'}>
            {report.requiresAcknowledgement ? 'Acknowledgement due' : 'Acknowledged'}
          </Badge>
          <View style={styles.rowActions}>
            <MobileButton
              compact
              label={report.id === selectedCopyId ? 'Selected' : 'View'}
              onPress={() => {
                onSelect(report.id);
              }}
              variant={report.id === selectedCopyId ? 'primary' : 'secondary'}
            />
            <MobileButton
              compact
              label="View PDF"
              onPress={() => {
                onSelect(report.id);
                onPdfAction(report.id);
              }}
              variant="blue"
            />
          </View>
        </View>
      ))}
    </Card>
  );
}

function IncidentDetailCard({
  acknowledgementError,
  acknowledgementStatus,
  acknowledging,
  onAcknowledge,
  onOpenMessages,
  onPdfAction,
  pdfCopyId,
  pdfError,
  pdfFileName,
  pdfLoading,
  report,
}: {
  acknowledgementError: string | null;
  acknowledgementStatus: string | null;
  acknowledging: boolean;
  onAcknowledge: (report: ParentIncidentCopy) => void;
  onOpenMessages: () => void;
  onPdfAction: (copyId: string) => void;
  pdfCopyId: string;
  pdfError: string | null;
  pdfFileName: string | null;
  pdfLoading: boolean;
  report: ParentIncidentCopy | null;
}) {
  if (!report) {
    return (
      <Card style={styles.compactCard}>
        <SectionTitle>Incident Report</SectionTitle>
        <MutedText>No report selected</MutedText>
      </Card>
    );
  }

  const pdfStatus =
    pdfCopyId === report.id
      ? pdfLoading
        ? 'Preparing PDF'
        : pdfError
          ? 'PDF unavailable'
          : pdfFileName
            ? `${pdfFileName} ready`
            : null
      : null;

  return (
    <View style={styles.detailStack}>
      <Card style={styles.compactCard}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.sectionLabel}>Incident Report</Text>
            <Text style={styles.reportTitle}>{report.reportNumber}</Text>
          </View>
          <Badge variant="crimson">Parent copy</Badge>
        </View>
        <View style={styles.factGrid}>
          <IncidentFact label="Child" value={report.studentName} />
          <IncidentFact label="Type" value={formatIncidentType(report.type)} />
          <IncidentFact label="Date / time" value={formatParentDateTime(report.occurredAt)} />
          <IncidentFact
            label="Shared by centre"
            value={report.sharedAt ? formatParentDate(report.sharedAt) : 'Not recorded'}
          />
        </View>
        <IncidentPreviewSection
          body={report.parentSummary}
          label="Summary shared with parent"
        />
        <IncidentPreviewSection
          body={
            report.firstAidGiven
              ? 'First aid was recorded for this report.'
              : 'No first aid recorded.'
          }
          label="First aid given"
        />
        <IncidentPreviewSection
          body="Contact the centre if anything changes or you need to discuss this report."
          label="Follow-up requested"
        />
        <View style={styles.buttonGrid}>
          <MobileButton
            label="View PDF"
            onPress={() => {
              onPdfAction(report.id);
            }}
            variant="primary"
          />
          <MobileButton
            label="Download PDF"
            onPress={() => {
              onPdfAction(report.id);
            }}
            variant="secondary"
          />
          <MobileButton
            disabled={!report.requiresAcknowledgement || acknowledging}
            label={acknowledging ? 'Acknowledging' : 'Acknowledge receipt'}
            onPress={() => {
              onAcknowledge(report);
            }}
            variant={report.requiresAcknowledgement ? 'success' : 'secondary'}
          />
        </View>
        {pdfLoading ? <InlineSpinner label="Preparing PDF" /> : null}
        {pdfStatus && !pdfLoading ? <MutedText>{pdfStatus}</MutedText> : null}
        {pdfError ? <ErrorText>{pdfError}</ErrorText> : null}
        {acknowledgementStatus ? <MutedText>{acknowledgementStatus}</MutedText> : null}
        {acknowledgementError ? <ErrorText>{acknowledgementError}</ErrorText> : null}
      </Card>

      <Card style={styles.compactCard}>
        <View style={styles.cardHeader}>
          <View style={styles.rowBody}>
            <SectionTitle>Need to discuss this?</SectionTitle>
            <MutedText>Message the centre team if you have questions about this report.</MutedText>
          </View>
          <MobileButton
            compact
            label="Message supervisor"
            onPress={onOpenMessages}
            variant="secondary"
          />
        </View>
      </Card>
    </View>
  );
}

function IncidentMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function IncidentFact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.factCard}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}

function IncidentPreviewSection({ body, label }: { body: string; label: string }) {
  return (
    <View style={styles.previewSection}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <MutedText>{body}</MutedText>
    </View>
  );
}

function incidentStats(reports: readonly ParentIncidentCopy[]) {
  return reports.reduce(
    (stats, report) => ({
      acknowledged: stats.acknowledged + (report.acknowledgedAt ? 1 : 0),
      downloaded: stats.downloaded + (report.downloadedAt ? 1 : 0),
      shared: stats.shared + 1,
      waiting: stats.waiting + (report.requiresAcknowledgement ? 1 : 0),
    }),
    { acknowledged: 0, downloaded: 0, shared: 0, waiting: 0 },
  );
}

function formatCount(count: number, singular: string): string {
  return count === 1 ? `1 ${singular}` : `${formatNumber(count)} ${singular}s`;
}

function formatNumber(value: number): string {
  return numberFormatter.format(Math.round(value));
}

function formatIncidentType(type: string): string {
  const labels: Record<string, string> = {
    AccidentFirstAid: 'Accident / first aid',
    BehaviourIncident: 'Behaviour incident',
    BullyingPeerOnPeer: 'Bullying / peer-on-peer',
    MedicalMedication: 'Medical / medication',
    NearMiss: 'Near miss',
    OffSiteTrip: 'Off-site trip',
    OnlineSafety: 'Online safety',
    PhysicalIntervention: 'Physical intervention',
    SafeguardingConcern: 'Safeguarding concern',
  };
  return labels[type] ?? type;
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
  detailStack: {
    gap: 14,
  },
  eyebrow: {
    color: C.crimson,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  factCard: {
    backgroundColor: C.bg,
    borderRadius: 10,
    flex: 1,
    gap: 4,
    minWidth: 126,
    padding: 10,
  },
  factGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  factLabel: {
    color: C.textMuted,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  factValue: {
    color: C.navy,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 17,
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
  metricCard: {
    backgroundColor: C.bg,
    borderRadius: 10,
    flex: 1,
    gap: 3,
    minWidth: 124,
    padding: 10,
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
  previewSection: {
    borderTopColor: C.borderLight,
    borderTopWidth: 1,
    gap: 6,
    paddingTop: 12,
  },
  reportRow: {
    alignItems: 'center',
    borderTopColor: C.borderLight,
    borderTopWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingTop: 10,
  },
  reportTitle: {
    color: C.navy,
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 23,
  },
  rowActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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

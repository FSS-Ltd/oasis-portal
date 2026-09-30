import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, type RouterOutputs } from '../../lib/trpc';
import { C } from '../core/mobile-theme';
import { Card, ErrorText, MobileButton, MutedText, SectionTitle } from '../core/mobile-ui';
import { PortalMobileHeader } from '../core/portal-mobile-shell';
import { saveOrSharePdf } from '../timetable/mobile-pdf-file';

type ActiveScoreKeyRow = RouterOutputs['report']['scoreKeys']['current']['rows'][number];

function visibleOnWeb(): boolean {
  return (
    Platform.OS !== 'web' ||
    typeof document === 'undefined' ||
    document.visibilityState === 'visible'
  );
}

export function StaffScoreKeyReportScreen({ onBack }: { onBack: () => void }) {
  const report = api.report.scoreKeys.current.useQuery(undefined, {
    staleTime: 0,
    refetchOnMount: true,
    refetchOnReconnect: true,
    retry: false,
    refetchInterval: () => (AppState.currentState === 'active' && visibleOnWeb() ? 30_000 : false),
  });
  const download = api.report.scoreKeys.downloadPdf.useQuery(undefined, {
    enabled: false,
    retry: false,
  });
  const [active, setActive] = useState(AppState.currentState === 'active');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const rowsBySubject = useMemo(() => {
    const groups = new Map<string, ActiveScoreKeyRow[]>();
    for (const row of report.data?.rows ?? []) {
      const rows = groups.get(row.subjectId) ?? [];
      rows.push(row);
      groups.set(row.subjectId, rows);
    }
    return [...groups.values()];
  }, [report.data?.rows]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      setActive(nextState === 'active');
      if (nextState === 'active' && visibleOnWeb()) void report.refetch();
    });
    if (Platform.OS !== 'web') {
      return () => {
        subscription.remove();
      };
    }

    function onVisibilityChange() {
      if (visibleOnWeb() && AppState.currentState === 'active') void report.refetch();
    }
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      subscription.remove();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [report.refetch]);

  async function printReport() {
    setExporting(true);
    setExportError(null);
    try {
      const result = await download.refetch();
      if (result.error instanceof Error) throw result.error;
      if (!result.data) {
        throw new Error('The score-key PDF could not be prepared.');
      }
      await saveOrSharePdf(result.data, 'Print or save score-key report');
    } catch (error) {
      setExportError(
        error instanceof Error ? error.message : 'The score-key PDF could not be shared.',
      );
    } finally {
      setExporting(false);
    }
  }

  const isLoading = report.isLoading && !report.data;
  const accessDenied = report.error?.data?.code === 'FORBIDDEN';
  const refreshError = report.error && !accessDenied && !report.data ? report.error.message : null;

  return (
    <SafeAreaView style={styles.shell}>
      <PortalMobileHeader
        actionAccessibilityLabel="Return to staff home"
        actionLabel="Back"
        avatarLabel="R"
        eyebrow="Reports"
        onActionPress={onBack}
        subtitle="Active Score Keys"
        title="Oasis Learning Centre"
        variant="dark"
      />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            onRefresh={() => void report.refetch()}
            refreshing={report.isFetching && active}
          />
        }
        style={styles.scroller}
      >
        <View style={styles.intro}>
          <SectionTitle>Active Score Keys</SectionTitle>
          <MutedText>Score keys needed for active children’s current PACEs.</MutedText>
        </View>

        {accessDenied ? (
          <Card>
            <Text style={styles.subjectTitle}>Access denied</Text>
            <MutedText>Active score keys are not available for this account.</MutedText>
          </Card>
        ) : null}
        {isLoading ? (
          <View accessibilityLiveRegion="polite" style={styles.loading}>
            <ActivityIndicator color={C.blue} />
            <Text style={styles.body}>Loading active score keys…</Text>
          </View>
        ) : null}
        {refreshError ? (
          <View style={styles.failure}>
            <ErrorText>{refreshError}</ErrorText>
            <MobileButton
              compact
              disabled={report.isFetching}
              label="Retry"
              onPress={() => {
                void report.refetch();
              }}
              variant="secondary"
            />
          </View>
        ) : null}
        {!accessDenied && report.error && report.data ? (
          <ErrorText>Could not refresh. Showing the last successful update.</ErrorText>
        ) : null}
        {exportError ? <ErrorText>{exportError}</ErrorText> : null}
        {!accessDenied && report.data ? (
          <>
            <View style={styles.metrics}>
              <Card style={styles.metric}>
                <MutedText>Active Score Keys</MutedText>
                <Text style={styles.metricValue}>{report.data.activeKeyCount}</Text>
              </Card>
              <Card style={styles.metric}>
                <MutedText>Subjects</MutedText>
                <Text style={styles.metricValue}>{report.data.subjectCount}</Text>
              </Card>
            </View>
            <View style={styles.actions}>
              <MobileButton
                compact
                disabled={report.isFetching}
                label="Refresh"
                onPress={() => void report.refetch()}
                variant="secondary"
              />
              <MobileButton
                compact
                disabled={exporting || !active}
                label={exporting ? 'Preparing PDF…' : 'Print / Save PDF'}
                onPress={() => void printReport()}
                variant="navy"
              />
            </View>
            <MutedText>
              {report.isFetching ? 'Refreshing… · ' : ''}Updated{' '}
              {formatTimestamp(report.data.generatedAt)}
            </MutedText>
            {report.data.rows.length === 0 ? (
              <Card>
                <MutedText>No active score keys are currently needed.</MutedText>
              </Card>
            ) : (
              rowsBySubject.map((rows) => (
                <View key={rows[0]?.subjectId} style={styles.subject}>
                  <Text style={styles.subjectTitle}>{rows[0]?.subjectName}</Text>
                  {rows.map((row) => (
                    <Card key={`${row.subjectId}-${String(row.paceNumber)}`} style={styles.row}>
                      <View
                        accessible
                        accessibilityLabel={`${row.subjectName}, PACE ${String(row.paceNumber)}, score key ${String(row.paceNumber)}, ${String(row.childCount)} ${row.childCount === 1 ? 'child' : 'children'}`}
                        accessibilityRole="text"
                        style={styles.rowText}
                      >
                        <Text style={styles.pace}>PACE {row.paceNumber}</Text>
                        <MutedText>Score Key {row.paceNumber}</MutedText>
                      </View>
                      <Text style={styles.count}>
                        {row.childCount} {row.childCount === 1 ? 'child' : 'children'}
                      </Text>
                    </Card>
                  ))}
                </View>
              ))
            )}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function formatTimestamp(value: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/London',
  }).format(value);
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  body: { color: C.textSecondary, fontSize: 16 },
  content: { gap: 16, padding: 18, paddingBottom: 36 },
  failure: { alignItems: 'flex-start', gap: 10 },
  count: { color: C.navy, flexShrink: 0, fontSize: 16, fontWeight: '700', textAlign: 'right' },
  intro: { gap: 8 },
  loading: { alignItems: 'center', flexDirection: 'row', gap: 10, paddingVertical: 10 },
  metric: { flex: 1, gap: 8, minWidth: 145 },
  metricValue: { color: C.navy, fontSize: 24, fontWeight: '700' },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  pace: { color: C.navy, fontSize: 17, fontWeight: '700' },
  row: { alignItems: 'center', flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  rowText: { flex: 1, gap: 4 },
  scroller: { backgroundColor: C.bg },
  shell: { backgroundColor: C.bg, flex: 1 },
  subject: { gap: 8 },
  subjectTitle: { color: C.navy, fontSize: 18, fontWeight: '700', marginTop: 4 },
});

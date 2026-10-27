import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api, type RouterOutputs } from '../../lib/trpc';
import { C } from '../core/mobile-theme';
import { Badge, Card, MobileButton, MutedText } from '../core/mobile-ui';
import { StaffDiagnosticChart } from './staff-academic-diagnostic-chart';
import { InventoryMobilePagination } from './staff-academic-inventory-pagination';
import { describePlacement } from './staff-academic-inventory-utils';

type Student = RouterOutputs['academicInventory']['summary']['students'][number];
export type DiagnosticRow =
  RouterOutputs['academicInventory']['diagnosticsHistory']['rows'][number];
const testLabels = {
  Math: 'Math',
  English: 'English',
  WordBuilding: 'Word Building',
  Reading: 'Reading',
} as const;
const dateFormatter = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' });

export function InventoryDiagnosticHistory({
  enabled,
  onSetUpGaps,
  students,
}: {
  enabled: boolean;
  onSetUpGaps: (result: DiagnosticRow) => void;
  students: Student[];
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const history = api.academicInventory.diagnosticsHistory.useQuery(
    { page, pageSize },
    { enabled, retry: false },
  );
  useEffect(() => {
    if (!history.data) return;
    const lastPage = Math.max(1, Math.ceil(history.data.totalRows / pageSize));
    if (page > lastPage) setPage(lastPage);
  }, [history.data, page, pageSize]);

  return (
    <Card style={styles.card}>
      <Text style={styles.title}>Recorded results</Text>
      {history.isLoading ? <MutedText>Loading results…</MutedText> : null}
      {history.error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {history.error.message}
        </Text>
      ) : null}
      {history.data?.rows.length === 0 ? (
        <MutedText>No diagnostic results recorded.</MutedText>
      ) : null}
      {history.data?.rows.map((result) => {
        const student = students.find((row) => row.id === result.studentId);
        const assignment = student?.subjects.find((row) => row.subjectId === result.subjectId);
        const placement = result.placement;
        // Legacy rows predate the test field and are identified by their subject.
        const testLabel = result.test
          ? testLabels[result.test]
          : assignment
            ? `${assignment.subject.code} · ${assignment.subject.name}`
            : 'Assigned subject';
        return (
          <View key={result.id} style={styles.result}>
            <View style={styles.heading}>
              <Text style={styles.name}>
                {student?.fullName ?? 'Student'} · {testLabel}
                {placement ? '' : ` · Level ${String(result.level)}`}
              </Text>
              {placement ? null : (
                <Badge variant={result.outcome === 'Pass' ? 'success' : 'warning'}>
                  {result.outcome}
                </Badge>
              )}
            </View>
            {placement ? (
              <>
                <Text style={styles.summary}>{describePlacement(placement)}</Text>
                <StaffDiagnosticChart
                  attempted={result.attemptedPaceNumbers}
                  circled={result.circledPaceNumbers}
                />
                {placement.learningGaps.length > 0 &&
                placement.performanceLevelPace !== null &&
                result.subjectId ? (
                  <MobileButton
                    label="Set up Gap PACEs"
                    onPress={() => {
                      onSetUpGaps(result);
                    }}
                    variant="secondary"
                  />
                ) : null}
              </>
            ) : null}
            <MutedText>{dateFormatter.format(new Date(result.recordedAt))}</MutedText>
          </View>
        );
      })}
      {history.data ? (
        <InventoryMobilePagination
          label="Results"
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
          page={page}
          pageSize={pageSize}
          total={history.data.totalRows}
        />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  error: { color: C.danger },
  heading: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  name: { color: C.navy, flexShrink: 1, fontSize: 14, fontWeight: '700' },
  result: { borderColor: C.border, borderRadius: 8, borderWidth: 1, gap: 6, padding: 12 },
  summary: { color: C.textPrimary, fontSize: 14, lineHeight: 20 },
  title: { color: C.navy, fontSize: 16, fontWeight: '800' },
});

import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api, type RouterOutputs } from '../../lib/trpc';
import { C } from '../core/mobile-theme';
import { Badge, Card, MutedText } from '../core/mobile-ui';
import { InventoryMobilePagination } from './staff-academic-inventory-pagination';

type Student = RouterOutputs['academicInventory']['summary']['students'][number];
const dateFormatter = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' });

export function InventoryDiagnosticHistory({
  enabled,
  students,
}: {
  enabled: boolean;
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
        return (
          <View key={result.id} style={styles.result}>
            <View style={styles.heading}>
              <Text style={styles.name}>
                {student?.fullName ?? 'Student'} · Level {String(result.level)}
              </Text>
              <Badge variant={result.outcome === 'Pass' ? 'success' : 'warning'}>
                {result.outcome}
              </Badge>
            </View>
            <MutedText>
              {assignment
                ? `${assignment.subject.code} · ${assignment.subject.name}`
                : 'Assigned subject'}{' '}
              · {dateFormatter.format(new Date(result.recordedAt))}
            </MutedText>
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
  title: { color: C.navy, fontSize: 16, fontWeight: '800' },
});

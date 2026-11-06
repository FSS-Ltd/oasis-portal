import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { displaySchoolYearLabel } from '@oasis/domain';
import { api, type RouterOutputs } from '../../lib/trpc';
import { C } from '../core/mobile-theme';
import { ErrorText, MobileButton, MutedText } from '../core/mobile-ui';
import { LibraryLoanRecords } from './library-loan-records';
import { LibraryRecordPager } from './library-record-pager';

type Borrower = RouterOutputs['library']['borrowerHistoryPage']['items'][number];
function StudentRecord({ student }: { student: Borrower }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={styles.record}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${student.name}, ${String(student.totalLoans)} loans, ${expanded ? 'collapse' : 'expand'} history`}
        onPress={() => {
          setExpanded(!expanded);
        }}
        style={styles.summary}
      >
        <Text style={styles.name}>
          {student.name} {expanded ? '−' : '+'}
        </Text>
        <Text style={styles.secondary}>
          {displaySchoolYearLabel(student.yearGroup)}
          {student.active ? '' : ' · Former student'} · {student.totalLoans} loans
        </Text>
      </Pressable>
      {expanded ? (
        <View style={styles.detail}>
          <LibraryLoanRecords status="All" studentId={student.id} />
        </View>
      ) : null}
    </View>
  );
}
export function LibraryStudentHistory() {
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const students = api.library.borrowerHistoryPage.useQuery({ page, search });
  return (
    <View style={styles.stack}>
      <TextInput
        accessibilityLabel="Find student by exact full name"
        placeholder="Exact full name"
        placeholderTextColor={C.textSecondary}
        maxLength={200}
        value={draft}
        onChangeText={setDraft}
        style={styles.input}
      />
      <View style={styles.actions}>
        <MobileButton
          compact
          label="Find student"
          variant="secondary"
          onPress={() => {
            setSearch(draft.trim());
            setPage(1);
          }}
        />
        {search ? (
          <MobileButton
            compact
            label="Clear search"
            variant="secondary"
            onPress={() => {
              setDraft('');
              setSearch('');
              setPage(1);
            }}
          />
        ) : null}
      </View>
      {students.isLoading ? (
        <MutedText>Loading student records…</MutedText>
      ) : students.error ? (
        <View>
          <ErrorText>Student records could not be loaded.</ErrorText>
          <MobileButton
            label="Try again"
            onPress={() => void students.refetch()}
            variant="secondary"
          />
        </View>
      ) : students.data?.items.length ? (
        students.data.items.map((student) => <StudentRecord key={student.id} student={student} />)
      ) : (
        <MutedText>No borrowing records found.</MutedText>
      )}
      <LibraryRecordPager
        page={page}
        nextPage={students.data?.nextPage}
        pending={students.isFetching}
        onPage={setPage}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  stack: { gap: 12 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    padding: 12,
    color: C.navy,
    backgroundColor: C.surface,
  },
  record: { borderWidth: 1, borderColor: C.border, borderRadius: 12, backgroundColor: C.surface },
  summary: { minHeight: 64, padding: 14, gap: 6 },
  detail: { padding: 12 },
  name: { color: C.navy, fontSize: 15, fontWeight: '700' },
  secondary: { color: C.textSecondary, fontSize: 13 },
});

import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { displaySchoolYearLabel, type LibraryCirculationPageInput } from '@oasis/domain';
import { api } from '../../lib/trpc';
import { C } from '../core/mobile-theme';
import { ErrorText, MobileButton, MutedText } from '../core/mobile-ui';
import { LibraryRecordPager } from './library-record-pager';

const date = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: 'UTC' });
const timestamp = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeZone: 'Europe/London',
});

export function LibraryLoanRecords({
  status,
  studentId,
  bookId,
}: {
  status: LibraryCirculationPageInput['status'];
  studentId?: string;
  bookId?: string;
}) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const records = api.library.circulationPage.useQuery({ status, studentId, bookId, page, search });
  const utils = api.useUtils();
  const checkin = api.library.checkin.useMutation({
    onSuccess: async () => {
      if (records.data?.items.length === 1 && page > 1) setPage(page - 1);
      await utils.library.invalidate();
    },
  });
  return (
    <View style={styles.stack}>
      <TextInput
        accessibilityLabel="Search books in loan records"
        placeholder="Title, author, or barcode"
        placeholderTextColor={C.textSecondary}
        maxLength={200}
        value={search}
        style={styles.input}
        onChangeText={(value) => {
          setSearch(value);
          setPage(1);
        }}
      />
      {message ? (
        <Text accessibilityLiveRegion="polite" style={styles.message}>
          {message}
        </Text>
      ) : null}
      {checkin.error ? <ErrorText>{checkin.error.message}</ErrorText> : null}
      {records.isLoading ? (
        <MutedText>Loading loans…</MutedText>
      ) : records.error ? (
        <View>
          <ErrorText>Library loans could not be loaded.</ErrorText>
          <MobileButton
            label="Try again"
            onPress={() => void records.refetch()}
            variant="secondary"
          />
        </View>
      ) : records.data?.items.length ? (
        records.data.items.map((loan) => (
          <View key={loan.id} style={styles.record}>
            <Text style={styles.title}>{loan.book.title}</Text>
            <Text style={styles.secondary}>
              {loan.book.author} · {loan.book.barcode}
            </Text>
            <Text style={styles.name}>
              {loan.student.name} · {displaySchoolYearLabel(loan.student.yearGroup)}
            </Text>
            <Text style={styles.secondary}>
              Checked out {timestamp.format(loan.checkedOutAt)} · Due {date.format(loan.dueOn)}
            </Text>
            <Text style={loan.status === 'Overdue' ? styles.overdue : styles.name}>
              {loan.status}
              {loan.returnedAt ? ` · ${timestamp.format(loan.returnedAt)}` : ''}
            </Text>
            {!loan.returnedAt ? (
              <MobileButton
                compact
                accessibilityLabel={`Mark ${loan.book.title} returned for ${loan.student.name}`}
                variant="secondary"
                label={
                  checkin.isPending && checkin.variables.loanId === loan.id
                    ? 'Returning…'
                    : `Return ${loan.student.name}’s copy`
                }
                disabled={checkin.isPending}
                onPress={() => {
                  setMessage(null);
                  checkin.mutate(
                    { barcode: loan.book.barcode, loanId: loan.id },
                    {
                      onSuccess: () => {
                        setMessage(`${loan.book.title} returned for ${loan.student.name}.`);
                      },
                    },
                  );
                }}
              />
            ) : null}
          </View>
        ))
      ) : (
        <MutedText>
          {search
            ? 'No books match this search.'
            : status === 'Overdue'
              ? 'No books are overdue.'
              : 'No loan records to show.'}
        </MutedText>
      )}
      <LibraryRecordPager
        page={page}
        nextPage={records.data?.nextPage}
        pending={records.isFetching || checkin.isPending}
        onPage={setPage}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  stack: { gap: 12 },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    padding: 12,
    color: C.navy,
    backgroundColor: C.surface,
  },
  record: {
    padding: 14,
    gap: 6,
    backgroundColor: C.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  title: { color: C.navy, fontSize: 16, fontWeight: '700' },
  name: { color: C.navy, fontSize: 13, fontWeight: '600' },
  secondary: { color: C.textSecondary, fontSize: 13 },
  overdue: { color: C.danger, fontSize: 13, fontWeight: '700' },
  message: { color: C.success, fontSize: 14 },
});

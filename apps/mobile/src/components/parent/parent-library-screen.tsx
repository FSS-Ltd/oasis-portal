import { useState } from 'react';
import { Image, StyleSheet, Text, TextInput, View } from 'react-native';
import { PortalScrollView } from '../core/portal-scroll-view';
import { type RouterOutputs, api } from '../../lib/trpc';
import { C } from '../core/mobile-theme';
import { LibraryBookList } from '../library/library-book-list';
import { LibraryCollectionTabs } from '../library/library-collection-tabs';
import type { LibraryBookCollection } from '@oasis/domain';
import { Card, MutedText, SectionTitle } from '../core/mobile-ui';

type LibrarySummary = RouterOutputs['library']['parentSummary'];

function loanStatus(dueOn: Date, today: string): string {
  const due = dueOn.toISOString().slice(0, 10);
  if (due < today) return 'Overdue';
  if (due === today) return 'Due today';
  return `Due ${new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: 'UTC' }).format(dueOn)}`;
}

export function ParentLibraryScreen({
  data,
  loading,
}: {
  data: LibrarySummary | undefined;
  loading: boolean;
}) {
  const [collection, setCollection] = useState<LibraryBookCollection>('General');
  const [search, setSearch] = useState('');
  const catalogue = api.library.parentCatalogue.useQuery({ search, collection }, { retry: false });
  if (loading) return <MutedText>Loading library…</MutedText>;
  if (!data) return <MutedText>Library records are unavailable.</MutedText>;
  return (
    <PortalScrollView contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>OASIS LIBRARY</Text>
        <Text style={styles.heroTitle}>Books for your family</Text>
        <MutedText>Browse the Oasis collection and see what is currently on loan.</MutedText>
      </View>
      <Card>
        <SectionTitle>Your loans</SectionTitle>
        {data.active.length === 0 ? (
          <MutedText>No books are currently on loan.</MutedText>
        ) : (
          data.active.map((loan) => (
            <View key={loan.id} style={styles.loan}>
              <Image source={{ uri: loan.book.coverUrl }} style={styles.loanCover} />
              <View style={styles.loanCopy}>
                <Text style={styles.title}>{loan.book.title}</Text>
                <MutedText>
                  {loan.book.author} · {loan.student.name}
                </MutedText>
                <Text
                  accessibilityLabel={`Loan status: ${loanStatus(loan.dueOn, data.today)}`}
                  style={
                    loanStatus(loan.dueOn, data.today) === 'Overdue'
                      ? styles.overdue
                      : styles.status
                  }
                >
                  {loanStatus(loan.dueOn, data.today)}
                </Text>
              </View>
            </View>
          ))
        )}
      </Card>
      <Card>
        <SectionTitle>Recently returned</SectionTitle>
        {data.recentReturns.length === 0 ? (
          <MutedText>Returned books will appear here.</MutedText>
        ) : (
          data.recentReturns.map((loan) => (
            <View key={loan.id} style={styles.returned}>
              <Image source={{ uri: loan.book.coverUrl }} style={styles.returnedCover} />
              <View>
                <Text style={styles.title}>{loan.book.title}</Text>
                <MutedText>
                  {loan.book.author} · {loan.student.name}
                </MutedText>
              </View>
            </View>
          ))
        )}
      </Card>
      <LibraryCollectionTabs value={collection} onChange={setCollection} />
      <View style={styles.catalogue}>
        <SectionTitle>Browse the catalogue</SectionTitle>
        <TextInput
          accessibilityLabel="Search library catalogue"
          onChangeText={setSearch}
          placeholder="Search title or author"
          placeholderTextColor={C.textMuted}
          style={styles.search}
          value={search}
        />
        {catalogue.isLoading ? (
          <MutedText>Loading catalogue…</MutedText>
        ) : catalogue.error ? (
          <MutedText>Library catalogue is unavailable.</MutedText>
        ) : catalogue.data?.items.length ? (
          <LibraryBookList books={catalogue.data.items} />
        ) : (
          <MutedText>
            {collection === 'RhinoReaders' && !search
              ? 'No Rhino Readers books to show yet.'
              : 'No books match this search.'}
          </MutedText>
        )}
      </View>
    </PortalScrollView>
  );
}

const styles = StyleSheet.create({
  content: { gap: 14, padding: 14, paddingBottom: 30 },
  hero: { backgroundColor: C.navy, borderRadius: 16, gap: 7, padding: 18 },
  eyebrow: { color: C.blueMid, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  heroTitle: { color: C.surface, fontSize: 22, fontWeight: '800' },
  loan: {
    borderTopColor: C.borderLight,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingTop: 12,
  },
  loanCover: { backgroundColor: C.blueLight, borderRadius: 5, height: 72, width: 50 },
  loanCopy: { flex: 1, gap: 3 },
  returned: {
    alignItems: 'center',
    borderTopColor: C.borderLight,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingTop: 10,
  },
  returnedCover: { backgroundColor: C.blueLight, borderRadius: 4, height: 48, width: 34 },
  status: { color: C.success, fontSize: 13, fontWeight: '800' },
  overdue: { color: C.crimson, fontSize: 13, fontWeight: '800' },
  title: { color: C.navy, fontSize: 15, fontWeight: '800' },
  catalogue: { gap: 12 },
  search: {
    backgroundColor: C.surface,
    borderColor: C.border,
    borderRadius: 10,
    borderWidth: 1,
    color: C.navy,
    minHeight: 44,
    paddingHorizontal: 12,
  },
});

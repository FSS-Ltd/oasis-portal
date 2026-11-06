import { useState } from 'react';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { api } from '../../lib/trpc';
import { LibraryBookList } from '../library/library-book-list';
import { LibraryCollectionTabs } from '../library/library-collection-tabs';
import {
  LIBRARY_STAFF_VIEWS,
  type LibraryBookCollection,
  type LibraryStaffView,
} from '@oasis/domain';
import { LibraryStaffTabs } from '../library/library-staff-tabs';
import { LibraryLoanRecords } from '../library/library-loan-records';
import { LibraryStudentHistory } from '../library/library-student-history';
import { LibraryRecordPager } from '../library/library-record-pager';
import { LibraryBookEditor } from '../library/library-book-editor';
import { C } from '../core/mobile-theme';
import { ErrorText, MobileButton, MutedText, SectionTitle } from '../core/mobile-ui';
import { PortalMobileHeader } from '../core/portal-mobile-shell';

export function StaffLibraryScreen({ onBack }: { onBack: () => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [view, setView] = useState<LibraryStaffView>('Catalogue');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(false);
  const [barcode, setBarcode] = useState('');
  const [collection, setCollection] = useState<LibraryBookCollection>('General');
  const [search, setSearch] = useState('');
  const [scanning, setScanning] = useState(false);
  const [cameraMessage, setCameraMessage] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [studentId, setStudentId] = useState('');
  const [dueOn, setDueOn] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  });
  const catalogue = api.library.cataloguePage.useQuery(
    { search, collection, page },
    { enabled: view === 'Catalogue' },
  );
  const lookup = api.library.lookupBarcode.useQuery(
    { barcode },
    { enabled: /^\d{1,64}$/.test(barcode), retry: false },
  );
  const borrowers = api.library.borrowers.useQuery(undefined, { retry: false });
  const utils = api.useUtils();
  async function refreshCirculation() {
    await Promise.all([
      utils.library.catalogue.invalidate(),
      utils.library.cataloguePage.invalidate(),
      utils.library.circulationPage.invalidate(),
      utils.library.borrowerHistoryPage.invalidate(),
      utils.library.lookupBarcode.invalidate(),
    ]);
  }
  const checkout = api.library.checkout.useMutation({ onSuccess: refreshCirculation });
  const book = lookup.data;

  function selectBarcode(value: string) {
    setView('Catalogue');
    setEditing(false);
    setLocked(true);
    setBarcode(value.trim());
    setScanning(false);
    setStudentId('');
  }
  function reset() {
    setEditing(false);
    setLocked(false);
    setBarcode('');
    setStudentId('');
  }
  async function openScanner() {
    setView('Catalogue');
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        setCameraMessage('Camera access was not granted. You can enter the barcode manually.');
        return;
      }
    }
    setCameraMessage(null);
    setLocked(false);
    setScanning(true);
  }

  return (
    <View style={styles.shell}>
      <PortalMobileHeader
        actionAccessibilityLabel="Return to staff home"
        actionLabel="Back"
        avatarLabel="L"
        eyebrow="Staff Portal"
        onActionPress={onBack}
        subtitle="Library circulation"
        title="Oasis Learning Centre"
        variant="dark"
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>OASIS LIBRARY</Text>
          <Text style={styles.heroTitle}>Find and circulate books</Text>
          <MutedText>Browse the catalogue or scan a physical barcode.</MutedText>
          <MobileButton label="Scan barcode" onPress={() => void openScanner()} variant="primary" />
        </View>
        <LibraryStaffTabs value={view} onChange={setView} />
        {view === 'Catalogue' ? (
          <>
            {cameraMessage ? <ErrorText>{cameraMessage}</ErrorText> : null}
            {scanning ? (
              <View style={styles.camera}>
                <CameraView
                  barcodeScannerSettings={{
                    barcodeTypes: [
                      'ean13',
                      'ean8',
                      'upc_a',
                      'upc_e',
                      'code128',
                      'code39',
                      'code93',
                      'codabar',
                      'itf14',
                    ],
                  }}
                  onBarcodeScanned={(event) => {
                    if (!locked) selectBarcode(event.data);
                  }}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.cameraFrame} />
                <Text style={styles.cameraText}>Align a book barcode within the frame</Text>
                <MobileButton
                  compact
                  label="Cancel scan"
                  onPress={() => {
                    setScanning(false);
                  }}
                  variant="secondary"
                />
              </View>
            ) : null}
            <View style={styles.lookup}>
              <Text style={styles.label}>Book barcode</Text>
              <TextInput
                accessibilityLabel="Library barcode number"
                inputMode="numeric"
                keyboardType="numeric"
                onChangeText={selectBarcode}
                placeholder="Scan or enter barcode"
                placeholderTextColor={C.textMuted}
                style={styles.input}
                value={barcode}
              />
              {barcode ? (
                <MobileButton compact label="Clear barcode" onPress={reset} variant="secondary" />
              ) : null}
            </View>
            {lookup.error ? <ErrorText>{lookup.error.message}</ErrorText> : null}
            {book ? (
              <View style={styles.actionCard}>
                <SectionTitle>{book.title}</SectionTitle>
                <MobileButton
                  label="Edit book"
                  onPress={() => {
                    setEditing(true);
                  }}
                  variant="secondary"
                />
                <MutedText>
                  {book.availableCopies} of {book.quantity} copies available.
                </MutedText>
                {book.loanedCopies > 0 ? (
                  <LibraryLoanRecords key={book.id} status="Open" bookId={book.id} />
                ) : null}
              </View>
            ) : null}
            {editing && book ? (
              <LibraryBookEditor
                book={book}
                key={book.id}
                onCancel={() => {
                  setEditing(false);
                }}
                onSaved={async (savedBarcode) => {
                  selectBarcode(savedBarcode);
                  await refreshCirculation();
                }}
              />
            ) : null}
            {book && book.availableCopies > 0 ? (
              <View style={styles.actionCard}>
                <SectionTitle>{book.title}</SectionTitle>
                <MutedText>Available to check out.</MutedText>
                <Text style={styles.label}>Student ID</Text>
                <TextInput
                  accessibilityLabel="Student ID"
                  onChangeText={setStudentId}
                  style={styles.input}
                  value={studentId}
                />
                <Text style={styles.label}>Due date</Text>
                <TextInput
                  accessibilityLabel="Due date"
                  onChangeText={setDueOn}
                  style={styles.input}
                  value={dueOn}
                />
                <MutedText>
                  {borrowers.data?.find((student) => student.id === studentId)
                    ?.hasReminderRecipient === false
                    ? 'No active guardian email is linked to this student.'
                    : ''}
                </MutedText>
                <MobileButton
                  disabled={!studentId || checkout.isPending}
                  label={checkout.isPending ? 'Checking out…' : 'Check out'}
                  onPress={() => {
                    checkout.mutate({ barcode, studentId, dueOn }, { onSuccess: reset });
                  }}
                  variant="primary"
                />
              </View>
            ) : null}
            {barcode && !book && !lookup.isFetching ? (
              <View style={styles.actionCard}>
                <SectionTitle>New barcode</SectionTitle>
                <MutedText>
                  Add this book and its cover from the web Library page, then scan it again to check
                  it out.
                </MutedText>
              </View>
            ) : null}
            <LibraryCollectionTabs
              value={collection}
              onChange={(value) => {
                setCollection(value);
                setPage(1);
              }}
            />
            <View style={styles.catalogueHeader}>
              <SectionTitle>Catalogue</SectionTitle>
              <TextInput
                accessibilityLabel="Search catalogue"
                onChangeText={(value) => {
                  setSearch(value);
                  setPage(1);
                }}
                placeholder="Search title or author"
                placeholderTextColor={C.textMuted}
                style={styles.search}
                value={search}
              />
            </View>
            {checkout.error ? <ErrorText>{checkout.error.message}</ErrorText> : null}
            {catalogue.isLoading ? (
              <MutedText>Loading catalogue…</MutedText>
            ) : catalogue.error ? (
              <ErrorText>The catalogue is unavailable.</ErrorText>
            ) : catalogue.data?.items.length ? (
              <LibraryBookList
                books={catalogue.data.items}
                onSelect={(id) => {
                  const selected = catalogue.data.items.find((item) => item.id === id);
                  if (selected) selectBarcode(selected.barcode);
                }}
              />
            ) : (
              <MutedText>
                {collection === 'RhinoReaders' && !search
                  ? 'No Rhino Readers books yet. Assign books to this collection when editing.'
                  : 'No books match this search.'}
              </MutedText>
            )}
            <LibraryRecordPager
              page={page}
              nextPage={catalogue.data?.nextPage}
              pending={catalogue.isFetching}
              onPage={setPage}
            />
          </>
        ) : (
          <View style={styles.catalogueHeader}>
            <SectionTitle>
              {LIBRARY_STAFF_VIEWS.find((item) => item.id === view)?.label}
            </SectionTitle>
            <MutedText>
              {view === 'History'
                ? 'Open a student record to see current and previous loans.'
                : view === 'Overdue'
                  ? 'Open loans past their due date, using the London calendar.'
                  : 'Return only the copy physically received from the named child.'}
            </MutedText>
            {view === 'History' ? (
              <LibraryStudentHistory />
            ) : (
              <LibraryLoanRecords key={view} status={view} />
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { backgroundColor: C.bg, flex: 1 },
  content: { gap: 16, padding: 16, paddingBottom: 32 },
  hero: { backgroundColor: C.navy, borderRadius: 16, gap: 8, padding: 18 },
  eyebrow: { color: C.blueMid, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  heroTitle: { color: C.surface, fontSize: 22, fontWeight: '800' },
  camera: {
    backgroundColor: C.navy,
    borderRadius: 14,
    height: 310,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    padding: 12,
  },
  cameraFrame: {
    borderColor: C.surface,
    borderRadius: 10,
    borderWidth: 3,
    bottom: 68,
    left: 32,
    position: 'absolute',
    right: 32,
    top: 48,
  },
  cameraText: {
    backgroundColor: 'rgba(0,0,0,0.65)',
    color: C.surface,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 10,
    padding: 11,
    textAlign: 'center',
  },
  lookup: {
    backgroundColor: C.surface,
    borderColor: C.border,
    borderRadius: 12,
    borderWidth: 1,
    gap: 9,
    padding: 14,
  },
  actionCard: {
    backgroundColor: C.surface,
    borderColor: C.borderLight,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
    padding: 14,
  },
  label: { color: C.navy, fontSize: 13, fontWeight: '800' },
  input: {
    backgroundColor: C.surface,
    borderColor: C.border,
    borderRadius: 8,
    borderWidth: 1,
    color: C.navy,
    fontSize: 16,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  catalogueHeader: { gap: 10 },
  search: {
    backgroundColor: C.surface,
    borderColor: C.border,
    borderRadius: 10,
    borderWidth: 1,
    color: C.navy,
    minHeight: 42,
    paddingHorizontal: 12,
  },
});

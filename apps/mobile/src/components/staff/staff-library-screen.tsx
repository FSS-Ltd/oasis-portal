import { useMemo, useState } from 'react';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { api } from '../../lib/trpc';
import { C } from '../core/mobile-theme';
import { ErrorText, MobileButton, MutedText, SectionTitle } from '../core/mobile-ui';
import { PortalMobileHeader } from '../core/portal-mobile-shell';

export function StaffLibraryScreen({ onBack }: { onBack: () => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [barcode, setBarcode] = useState('');
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
  const catalogue = api.library.catalogue.useQuery({ search });
  const lookup = api.library.lookupBarcode.useQuery(
    { barcode },
    { enabled: /^\d{1,64}$/.test(barcode), retry: false },
  );
  const borrowers = api.library.borrowers.useQuery(undefined, { retry: false });
  const checkout = api.library.checkout.useMutation();
  const checkin = api.library.checkin.useMutation();
  const book = lookup.data;
  const available = useMemo(
    () => (catalogue.data ?? []).filter((item) => !item.openLoan),
    [catalogue.data],
  );
  const onLoan = useMemo(
    () => (catalogue.data ?? []).filter((item) => item.openLoan),
    [catalogue.data],
  );

  function selectBarcode(value: string) {
    setLocked(true);
    setBarcode(value.trim());
    setScanning(false);
    setStudentId('');
  }
  function reset() {
    setLocked(false);
    setBarcode('');
    setStudentId('');
  }
  async function openScanner() {
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
        {book?.openLoan ? (
          <View style={styles.actionCard}>
            <SectionTitle>{book.title}</SectionTitle>
            <MutedText>Checked out to {book.openLoan.studentName}.</MutedText>
            <MobileButton
              disabled={checkin.isPending}
              label={checkin.isPending ? 'Checking in…' : 'Check in'}
              onPress={() => void checkin.mutateAsync({ barcode }).then(reset)}
              variant="primary"
            />
          </View>
        ) : null}
        {book && !book.openLoan ? (
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
              {borrowers.data?.find((student) => student.id === studentId)?.hasReminderRecipient ===
              false
                ? 'No active guardian email is linked to this student.'
                : ''}
            </MutedText>
            <MobileButton
              disabled={!studentId || checkout.isPending}
              label={checkout.isPending ? 'Checking out…' : 'Check out'}
              onPress={() => void checkout.mutateAsync({ barcode, studentId, dueOn }).then(reset)}
              variant="primary"
            />
          </View>
        ) : null}
        {barcode && !book && !lookup.isFetching ? (
          <View style={styles.actionCard}>
            <SectionTitle>New barcode</SectionTitle>
            <MutedText>
              Add this book and its cover from the web Library page, then scan it again to check it
              out.
            </MutedText>
          </View>
        ) : null}
        <View style={styles.catalogueHeader}>
          <SectionTitle>Catalogue</SectionTitle>
          <TextInput
            accessibilityLabel="Search catalogue"
            onChangeText={setSearch}
            placeholder="Search title or author"
            placeholderTextColor={C.textMuted}
            style={styles.search}
            value={search}
          />
        </View>
        {catalogue.error ? (
          <ErrorText>The catalogue is unavailable.</ErrorText>
        ) : (
          <>
            <BookRow
              books={available}
              empty="No available books match this search."
              onPress={(value) => {
                selectBarcode(value);
              }}
              title="Available now"
            />
            <BookRow
              books={onLoan}
              empty="No books on loan match this search."
              onPress={(value) => {
                selectBarcode(value);
              }}
              title="On loan"
            />
          </>
        )}
      </ScrollView>
    </View>
  );
}

function BookRow({
  books,
  empty,
  onPress,
  title,
}: {
  books: Array<{
    id: string;
    barcode: string;
    title: string;
    author: string;
    coverUrl: string;
    openLoan: unknown;
  }>;
  empty: string;
  onPress: (barcode: string) => void;
  title: string;
}) {
  return (
    <View style={styles.catalogueSection}>
      <SectionTitle>{title}</SectionTitle>
      {books.length === 0 ? (
        <MutedText>{empty}</MutedText>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.bookRow}
        >
          {books.map((book) => (
            <Pressable
              accessibilityLabel={`Select ${book.title}`}
              key={book.id}
              onPress={() => {
                onPress(book.barcode);
              }}
              style={styles.book}
            >
              <Image source={{ uri: book.coverUrl }} style={styles.bookCover} />
              <Text numberOfLines={1} style={styles.bookTitle}>
                {book.title}
              </Text>
              <Text numberOfLines={1} style={styles.bookAuthor}>
                {book.author}
              </Text>
              <Text style={book.openLoan ? styles.onLoan : styles.available}>
                {book.openLoan ? 'On loan' : 'Available'}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
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
  catalogueSection: { gap: 10 },
  bookRow: { gap: 12 },
  book: {
    backgroundColor: C.surface,
    borderColor: C.border,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
    paddingBottom: 9,
    width: 132,
  },
  bookCover: { backgroundColor: C.blueLight, height: 172, width: 130 },
  bookTitle: { color: C.navy, fontSize: 13, fontWeight: '800', marginHorizontal: 9, marginTop: 8 },
  bookAuthor: { color: C.textSecondary, fontSize: 11, marginHorizontal: 9, marginTop: 3 },
  available: {
    color: C.success,
    fontSize: 11,
    fontWeight: '800',
    marginHorizontal: 9,
    marginTop: 6,
  },
  onLoan: { color: C.warning, fontSize: 11, fontWeight: '800', marginHorizontal: 9, marginTop: 6 },
});

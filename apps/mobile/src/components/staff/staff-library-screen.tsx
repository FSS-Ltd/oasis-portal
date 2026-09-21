import { useState } from 'react';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { api } from '../../lib/trpc';
import { C } from '../core/mobile-theme';
import { ErrorText, MobileButton, MutedText, SectionTitle } from '../core/mobile-ui';
import { PortalMobileHeader } from '../core/portal-mobile-shell';

export function StaffLibraryScreen({ onBack }: { onBack: () => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [barcode, setBarcode] = useState('');
  const [locked, setLocked] = useState(false);
  const [studentId, setStudentId] = useState('');
  const [dueOn, setDueOn] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  });
  const lookup = api.library.lookupBarcode.useQuery(
    { barcode },
    { enabled: /^\d{1,64}$/.test(barcode), retry: false },
  );
  const borrowers = api.library.borrowers.useQuery(undefined, { retry: false });
  const checkout = api.library.checkout.useMutation();
  const checkin = api.library.checkin.useMutation();
  const book = lookup.data;

  function scanned(data: string) {
    if (locked) return;
    setLocked(true);
    setBarcode(data.trim());
  }
  function reset() {
    setLocked(false);
    setBarcode('');
    setStudentId('');
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
        {!permission ? (
          <MutedText>Preparing camera…</MutedText>
        ) : !permission.granted ? (
          <View style={styles.card}>
            <SectionTitle>Scan a library barcode</SectionTitle>
            <MutedText>
              Camera access is used only to read book barcodes. You can enter the number manually
              instead.
            </MutedText>
            <MobileButton
              label="Allow camera"
              onPress={() => void requestPermission()}
              variant="primary"
            />
          </View>
        ) : !locked ? (
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
                scanned(event.data);
              }}
              style={StyleSheet.absoluteFill}
            />
            <Text style={styles.cameraText}>Align a book barcode within the frame</Text>
          </View>
        ) : null}
        <View style={styles.card}>
          <Text style={styles.label}>Barcode number</Text>
          <TextInput
            accessibilityLabel="Library barcode number"
            inputMode="numeric"
            keyboardType="numeric"
            onChangeText={(value) => {
              setLocked(true);
              setBarcode(value);
            }}
            style={styles.input}
            value={barcode}
          />
          <MobileButton label="Scan another" onPress={reset} variant="secondary" />
        </View>
        {lookup.error ? <ErrorText>{lookup.error.message}</ErrorText> : null}
        {book?.openLoan ? (
          <View style={styles.card}>
            <SectionTitle>{book.title}</SectionTitle>
            <MutedText>Checked out to {book.openLoan.studentName}.</MutedText>
            <MobileButton
              disabled={checkin.isPending}
              label="Check in"
              onPress={() => void checkin.mutateAsync({ barcode }).then(reset)}
              variant="primary"
            />
          </View>
        ) : book ? (
          <View style={styles.card}>
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
              label="Check out"
              onPress={() => void checkout.mutateAsync({ barcode, studentId, dueOn }).then(reset)}
              variant="primary"
            />
          </View>
        ) : barcode ? (
          <View style={styles.card}>
            <SectionTitle>New barcode</SectionTitle>
            <MutedText>
              This barcode is not in the catalogue. Add the title, author, and cover using the web
              Library page, then scan it again to check it out.
            </MutedText>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { backgroundColor: C.bg, flex: 1 },
  content: { gap: 14, padding: 16 },
  camera: {
    backgroundColor: C.navy,
    borderRadius: 12,
    height: 270,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  cameraText: {
    backgroundColor: 'rgba(0,0,0,0.65)',
    color: C.surface,
    fontSize: 14,
    fontWeight: '700',
    padding: 14,
    textAlign: 'center',
  },
  card: {
    backgroundColor: C.surface,
    borderColor: C.borderLight,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
    padding: 14,
  },
  label: { color: C.navy, fontSize: 13, fontWeight: '800' },
  input: {
    borderColor: C.borderLight,
    borderRadius: 8,
    borderWidth: 1,
    color: C.navy,
    fontSize: 16,
    minHeight: 44,
    paddingHorizontal: 12,
  },
});

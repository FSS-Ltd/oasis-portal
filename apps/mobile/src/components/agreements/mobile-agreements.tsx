import { useEffect, useState } from 'react';
import { AppState, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PortalScrollView } from '../core/portal-scroll-view';
import { api, type RouterOutputs } from '../../lib/trpc';
import { C } from '../core/mobile-theme';
import { Badge, Card, ErrorText, MobileButton, MutedText, SectionTitle } from '../core/mobile-ui';

type Agreement = RouterOutputs['userAgreement']['mine'][number];

function AgreementRecord({
  row,
  onSigned,
  feedback,
  onFeedback,
}: {
  row: Agreement;
  onSigned: () => void;
  feedback: string | undefined;
  onFeedback: (requestId: string, message: string) => void;
}) {
  const utils = api.useUtils();
  const open = api.userAgreement.open.useMutation();
  const sign = api.userAgreement.sign.useMutation();
  const [opened, setOpened] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [verification, setVerification] = useState<string | null>(null);

  async function openPdf() {
    setError(null);
    try {
      const result = await open.mutateAsync({ requestId: row.id });
      await Linking.openURL(result.url);
      setOpened(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The PDF could not be opened.');
    }
  }

  async function signPdf() {
    setError(null);
    try {
      await sign.mutateAsync({ requestId: row.id, acknowledged: true, fullName: fullName.trim() });
      await Promise.all([
        utils.userAgreement.mine.invalidate(),
        utils.userAgreement.pendingCount.invalidate(),
      ]);
      onFeedback(row.id, 'Signature saved. Checking the signing record…');
      onSigned();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The signature could not be saved.');
      return;
    }
    try {
      const result = await utils.userAgreement.verify.fetch({ requestId: row.id });
      onFeedback(
        row.id,
        result.valid
          ? 'Signature saved and verified.'
          : 'Signature saved, but verification failed. Contact the Head.',
      );
    } catch {
      onFeedback(
        row.id,
        'Signature saved. Verification is temporarily unavailable. Try again below.',
      );
    }
  }

  async function downloadPdf() {
    setError(null);
    try {
      const result = await utils.userAgreement.download.fetch({
        requestId: row.id,
        copy: 'completed',
      });
      await Linking.openURL(result.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The signed PDF could not be opened.');
    }
  }

  async function verifyRecord() {
    setError(null);
    try {
      const result = await utils.userAgreement.verify.fetch({ requestId: row.id });
      setVerification(
        result.valid
          ? 'Verified: form and signing record match.'
          : 'Verification failed. Contact the Head.',
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Verification could not be completed.');
    }
  }

  return (
    <Card style={styles.card}>
      <Badge variant={row.status === 'Signed' ? 'success' : 'warning'}>
        {row.status === 'Signed' ? 'Signed' : 'Needs signing'}
      </Badge>
      <SectionTitle>{row.title}</SectionTitle>
      <MutedText>
        {row.kind === 'UserAgreement' ? 'User Agreement' : 'Safeguarding & Data Annex'} · Version{' '}
        {row.version}
      </MutedText>
      {row.status === 'NeedsSigning' ? (
        <>
          <MobileButton
            disabled={open.isPending}
            label={open.isPending ? 'Opening PDF…' : 'Open PDF'}
            onPress={() => {
              void openPdf();
            }}
            variant="blue"
          />
          {opened ? (
            <>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: acknowledged }}
                onPress={() => {
                  setAcknowledged(!acknowledged);
                }}
                style={styles.checkRow}
              >
                <Text style={styles.check}>{acknowledged ? '☑' : '☐'}</Text>
                <Text style={styles.checkText}>I have read and understand this form.</Text>
              </Pressable>
              <Text style={styles.label}>Full name for electronic signature</Text>
              <TextInput
                accessibilityLabel="Full name for electronic signature"
                autoComplete="name"
                maxLength={160}
                onChangeText={setFullName}
                style={styles.input}
                value={fullName}
              />
              <MobileButton
                disabled={!acknowledged || !fullName.trim() || sign.isPending}
                label={sign.isPending ? 'Signing…' : 'Sign electronically'}
                onPress={() => {
                  void signPdf();
                }}
              />
            </>
          ) : null}
        </>
      ) : (
        <>
          <MutedText>
            {row.signatureMethod === 'HeadRecorded'
              ? 'Recorded as signed by administrator'
              : 'Signed electronically'}{' '}
            ·{' '}
            {row.declaredSignedOn
              ? new Date(row.declaredSignedOn).toLocaleDateString('en-GB')
              : row.signedAt
                ? new Date(row.signedAt).toLocaleDateString('en-GB')
                : ''}
          </MutedText>
          <MutedText>Signature ID: {row.signatureId}</MutedText>
          <MobileButton
            label="Open signed PDF and receipt"
            onPress={() => {
              void downloadPdf();
            }}
            variant="blue"
          />
          <MobileButton
            label="Verify signing record"
            onPress={() => {
              void verifyRecord();
            }}
            variant="secondary"
          />
          {feedback ? <Text accessibilityLiveRegion="polite">{feedback}</Text> : null}
          {verification ? <Text accessibilityLiveRegion="polite">{verification}</Text> : null}
        </>
      )}
      {error ? <ErrorText>{error}</ErrorText> : null}
    </Card>
  );
}

export function MobileAgreementsContent() {
  const mine = api.userAgreement.mine.useQuery(undefined, { retry: false });
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  function setRequestFeedback(requestId: string, message: string) {
    setFeedback((current) => ({ ...current, [requestId]: message }));
  }
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void mine.refetch();
    });
    return () => {
      subscription.remove();
    };
  }, [mine.refetch]);
  const pending = mine.data?.filter((row) => row.status === 'NeedsSigning') ?? [];
  const signed = mine.data?.filter((row) => row.status === 'Signed') ?? [];
  return (
    <View style={styles.content}>
      <SectionTitle>User Agreements</SectionTitle>
      <MutedText>Review forms assigned to your account and keep your signed records.</MutedText>
      {mine.isLoading ? <MutedText>Loading agreements…</MutedText> : null}
      {mine.error ? <ErrorText>{mine.error.message}</ErrorText> : null}
      <SectionTitle>Needs signing ({pending.length})</SectionTitle>
      {mine.data && pending.length === 0 ? (
        <MutedText>No forms need your signature.</MutedText>
      ) : null}
      {pending.map((row) => (
        <AgreementRecord
          feedback={feedback[row.id]}
          key={row.id}
          onFeedback={setRequestFeedback}
          onSigned={() => {
            void mine.refetch();
          }}
          row={row}
        />
      ))}
      <SectionTitle>Signed records ({signed.length})</SectionTitle>
      {mine.data && signed.length === 0 ? <MutedText>No signed records yet.</MutedText> : null}
      {signed.map((row) => (
        <AgreementRecord
          feedback={feedback[row.id]}
          key={row.id}
          onFeedback={setRequestFeedback}
          onSigned={() => {
            void mine.refetch();
          }}
          row={row}
        />
      ))}
    </View>
  );
}

export function MobileAgreementsScreen({ onBack }: { onBack?: () => void }) {
  return (
    <SafeAreaView style={styles.shell}>
      <PortalScrollView contentContainerStyle={styles.content}>
        {onBack ? <MobileButton label="Back" onPress={onBack} variant="secondary" /> : null}
        <MobileAgreementsContent />
      </PortalScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  shell: { backgroundColor: C.bg, flex: 1 },
  content: { gap: 14, padding: 16 },
  card: { gap: 10 },
  checkRow: { alignItems: 'center', flexDirection: 'row', gap: 10, minHeight: 44 },
  check: { color: C.crimson, fontSize: 24 },
  checkText: { color: C.textPrimary, flex: 1, fontSize: 14 },
  label: { color: C.textPrimary, fontSize: 14, fontWeight: '600' },
  input: {
    backgroundColor: C.surface,
    borderColor: C.border,
    borderRadius: 8,
    borderWidth: 1,
    color: C.textPrimary,
    minHeight: 44,
    paddingHorizontal: 10,
  },
});

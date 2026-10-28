import { useState } from 'react';
import { View } from 'react-native';
import { api } from '../../lib/trpc';
import { Card, ErrorText, InlineSpinner, MobileButton, MutedText, SectionTitle } from './mobile-ui';

interface AccountDeletionCardProps {
  /** Set to request deletion of a linked child's account instead of your own. */
  studentId?: string;
  title: string;
}

function requestedOn(value: Date): string {
  return value.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function AccountDeletionCard({ studentId, title }: AccountDeletionCardProps) {
  const utils = api.useUtils();
  const input = studentId ? { studentId } : {};
  const status = api.accountDeletion.status.useQuery(input, { retry: false });
  const request = api.accountDeletion.request.useMutation();
  const cancel = api.accountDeletion.cancel.useMutation();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = request.isPending || cancel.isPending;

  async function run(action: 'request' | 'cancel') {
    setError(null);
    try {
      if (action === 'request') await request.mutateAsync(input);
      else await cancel.mutateAsync(input);
      setConfirming(false);
      await utils.accountDeletion.status.invalidate();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong. Try again.');
    }
  }

  if (status.isLoading) return <InlineSpinner label="Checking account deletion status" />;
  if (!status.data?.canRequest) return null;

  return (
    <Card>
      <SectionTitle>{title}</SectionTitle>
      {status.data.requestedAt ? (
        <>
          <MutedText>
            Deletion requested on {requestedOn(status.data.requestedAt)}. Oasis will review it and
            confirm with you. Until then the account works as normal.
          </MutedText>
          <MobileButton
            disabled={pending}
            label="Cancel deletion request"
            onPress={() => {
              void run('cancel');
            }}
            variant="secondary"
          />
        </>
      ) : confirming ? (
        <>
          <MutedText>
            Oasis will review your request. Once approved, this account can no longer sign in.
            Attendance, safeguarding and audit records are kept because Oasis must keep them.
          </MutedText>
          <View style={{ gap: 8 }}>
            <MobileButton
              disabled={pending}
              label="Yes, request deletion"
              onPress={() => {
                void run('request');
              }}
              variant="danger"
            />
            <MobileButton
              disabled={pending}
              label="Keep my account"
              onPress={() => {
                setConfirming(false);
              }}
              variant="secondary"
            />
          </View>
        </>
      ) : (
        <>
          <MutedText>Ask Oasis to delete this account and stop it signing in.</MutedText>
          <MobileButton
            label="Request account deletion"
            onPress={() => {
              setConfirming(true);
            }}
            variant="danger"
          />
        </>
      )}
      {error ? <ErrorText>{error}</ErrorText> : null}
    </Card>
  );
}

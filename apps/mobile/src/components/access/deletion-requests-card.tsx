import { useState } from 'react';
import { View } from 'react-native';
import { api } from '../../lib/trpc';
import { Badge, Card, ErrorText, MobileButton, MutedText, SectionTitle } from '../core/mobile-ui';

function requestedOn(value: Date): string {
  return value.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Mobile twin of the web Deletion Requests panel: account admins approve or decline requests. */
export function DeletionRequestsCard() {
  const utils = api.useUtils();
  const queue = api.accountDeletion.queue.useQuery(undefined, { retry: false });
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh(): Promise<void> {
    setConfirmingId(null);
    await Promise.all([
      utils.accountDeletion.queue.invalidate(),
      utils.admin.listUserAccounts.invalidate(),
    ]);
  }

  const approve = api.accountDeletion.approve.useMutation({
    async onSuccess(result) {
      setMessage(
        result.clerkUserDeleted
          ? 'Account deleted. Historical records have been retained.'
          : 'Account deleted and sign-in blocked. Remove the person in Clerk by hand.',
      );
      await refresh();
    },
    onError(caught) {
      setError(caught.message);
    },
  });
  const decline = api.accountDeletion.decline.useMutation({
    async onSuccess() {
      setMessage('Request declined.');
      await refresh();
    },
    onError(caught) {
      setError(caught.message);
    },
  });
  const pending = approve.isPending || decline.isPending;
  const requests = queue.data ?? [];

  if (requests.length === 0 && !message) return null;

  return (
    <Card>
      <SectionTitle>Account deletion requests</SectionTitle>
      {requests.length > 0 ? (
        <Badge variant="warning">{`${String(requests.length)} waiting`}</Badge>
      ) : null}
      {message ? <MutedText>{message}</MutedText> : null}
      {requests.map((request) => (
        <View key={request.userId} style={{ gap: 8 }}>
          <SectionTitle>{`${request.fullName} (${request.role})`}</SectionTitle>
          <MutedText>
            Requested {requestedOn(request.requestedAt)}{' '}
            {request.requestedBySelf ? 'by the account holder' : 'by a parent or carer'}. Approving
            blocks sign-in and keeps attendance, safeguarding and audit records.
          </MutedText>
          {confirmingId === request.userId ? (
            <>
              <MobileButton
                disabled={pending}
                label="Confirm deletion"
                onPress={() => {
                  setError(null);
                  setMessage(null);
                  approve.mutate({ userId: request.userId });
                }}
                variant="danger"
              />
              <MobileButton
                disabled={pending}
                label="Back"
                onPress={() => {
                  setConfirmingId(null);
                }}
                variant="secondary"
              />
            </>
          ) : (
            <>
              <MobileButton
                disabled={pending}
                label="Approve deletion"
                onPress={() => {
                  setConfirmingId(request.userId);
                }}
                variant="danger"
              />
              <MobileButton
                disabled={pending}
                label="Decline"
                onPress={() => {
                  setError(null);
                  setMessage(null);
                  decline.mutate({ userId: request.userId });
                }}
                variant="secondary"
              />
            </>
          )}
        </View>
      ))}
      {error ? <ErrorText>{error}</ErrorText> : null}
    </Card>
  );
}

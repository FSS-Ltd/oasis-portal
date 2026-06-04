'use client';

import { CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { showErrorToast, showSuccessToast } from '@/lib/notifications';
import { api, type RouterOutputs } from '@/lib/trpc';

type ParentLinkRequest = RouterOutputs['registration']['listMyStudentParentLinkRequests'][number];

function formatDate(value: Date | string): string {
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(value));
}

function RequestCard({ request }: { request: ParentLinkRequest }) {
  const utils = api.useUtils();
  const confirm = api.registration.confirmStudentParentLinkRequest.useMutation({
    async onSuccess() {
      await utils.registration.listMyStudentParentLinkRequests.invalidate();
      showSuccessToast('Student link confirmed.');
    },
    onError(error) {
      showErrorToast(error, 'Student link could not be confirmed.');
    },
  });
  const reject = api.registration.rejectStudentParentLinkRequest.useMutation({
    async onSuccess() {
      await utils.registration.listMyStudentParentLinkRequests.invalidate();
      showSuccessToast('Student link rejected.');
    },
    onError(error) {
      showErrorToast(error, 'Student link could not be rejected.');
    },
  });

  return (
    <article className="registration-subsection">
      <div className="registration-subsection__header">
        <div>
          <strong>{request.studentName}</strong>
          <span>{request.yearGroup}</span>
        </div>
        <span className="badge badge--blue">Pending</span>
      </div>
      <div className="registration-read-list registration-read-list--compact">
        <div className="registration-read-card">
          <strong>Requested for</strong>
          <span>{request.parentEmail}</span>
        </div>
        <div className="registration-read-card">
          <strong>Submitted</strong>
          <span>{formatDate(request.createdAt)}</span>
        </div>
      </div>
      <div className="student-registration-actions">
        <Button
          onClick={() => {
            confirm.mutate({ id: request.id });
          }}
          pending={confirm.isPending}
          type="button"
        >
          <CheckCircle2 aria-hidden="true" size={16} />
          Confirm link
        </Button>
        <Button
          onClick={() => {
            reject.mutate({ id: request.id });
          }}
          pending={reject.isPending}
          type="button"
          variant="danger"
        >
          <XCircle aria-hidden="true" size={16} />
          Reject
        </Button>
      </div>
    </article>
  );
}

export function ParentLinkRequestsClient() {
  const requests = api.registration.listMyStudentParentLinkRequests.useQuery(undefined, {
    retry: false,
  });

  if (requests.isLoading) {
    return (
      <section className="panel panel__body">
        <EmptyState title="Loading link requests" />
      </section>
    );
  }

  if (requests.error) {
    return (
      <section className="panel panel__body">
        <EmptyState
          detail="Sign in with the account named on the student request."
          title="Link requests unavailable"
        />
      </section>
    );
  }

  if (!requests.data || requests.data.length === 0) {
    return (
      <section className="panel panel__body">
        <EmptyState
          detail="New requests appear here when a student names this account during registration."
          title="No pending student links"
        />
      </section>
    );
  }

  return (
    <section className="panel panel__body">
      <div className="registration-form">
        {requests.data.map((request) => (
          <RequestCard key={request.id} request={request} />
        ))}
      </div>
    </section>
  );
}

'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, Copy, KeyRound, ShieldCheck, XCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import {
  createStudentRegistrationCodeInput,
  type CreateStudentRegistrationCodeInput,
} from '@oasis/domain';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Field, TextInput } from '@/components/ui/field';
import { showErrorToast, showSuccessToast } from '@/lib/notifications';
import { api, type RouterOutputs } from '@/lib/trpc';

type Registration = RouterOutputs['registration']['listStudentSelfRegistrations'][number];
type RegistrationCode = RouterOutputs['registration']['createStudentRegistrationCode'];
type CreateCodeFormValues = z.input<typeof createStudentRegistrationCodeInput>;

function formatDate(value: Date | string | null): string {
  if (!value) return 'Not set';
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(value));
}

function statusTone(status: Registration['status']): string {
  if (status === 'Activated') return 'badge badge--green';
  if (status === 'Declined') return 'badge badge--red';
  if (status === 'AwaitingConsent') return 'badge badge--amber';
  return 'badge badge--blue';
}

function copyCode(code: string) {
  void navigator.clipboard.writeText(code);
  showSuccessToast('Registration code copied.');
}

function RegistrationActions({ registration }: { registration: Registration }) {
  const utils = api.useUtils();
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const approve = api.registration.approveStudentSelfRegistration.useMutation({
    async onSuccess(result) {
      await utils.registration.listStudentSelfRegistrations.invalidate();
      showSuccessToast(
        result.status === 'AwaitingConsent'
          ? 'Registration approved. Parent consent is still required.'
          : 'Student registration activated.',
      );
    },
    onError(error) {
      showErrorToast(error, 'Student registration could not be approved.');
    },
  });
  const decline = api.registration.declineStudentSelfRegistration.useMutation({
    async onSuccess() {
      await utils.registration.listStudentSelfRegistrations.invalidate();
      showSuccessToast('Student registration declined.');
    },
    onError(error) {
      showErrorToast(error, 'Student registration could not be declined.');
    },
  });

  if (registration.status === 'Activated' || registration.status === 'Declined') {
    return null;
  }

  return (
    <div className="student-registration-actions">
      <label className="student-registration-consent">
        <input
          checked={consentConfirmed}
          onChange={(event) => {
            setConsentConfirmed(event.target.checked);
          }}
          type="checkbox"
        />
        Parent consent confirmed
      </label>
      <Button
        onClick={() => {
          approve.mutate({
            id: registration.id,
            parentConsentConfirmed: consentConfirmed,
          });
        }}
        pending={approve.isPending}
        size="sm"
        type="button"
      >
        <CheckCircle2 aria-hidden="true" size={15} />
        Approve
      </Button>
      <Button
        onClick={() => {
          decline.mutate({ id: registration.id });
        }}
        pending={decline.isPending}
        size="sm"
        type="button"
        variant="danger"
      >
        <XCircle aria-hidden="true" size={15} />
        Decline
      </Button>
    </div>
  );
}

function CodeCreator({
  latestCode,
  setLatestCode,
}: {
  latestCode: RegistrationCode | null;
  setLatestCode: (code: RegistrationCode | null) => void;
}) {
  const utils = api.useUtils();
  const createCode = api.registration.createStudentRegistrationCode.useMutation({
    async onSuccess(result) {
      setLatestCode(result);
      await utils.registration.listStudentRegistrationCodes.invalidate();
      showSuccessToast('Registration code created.');
    },
    onError(error) {
      showErrorToast(error, 'Registration code could not be created.');
    },
  });
  const {
    formState: { errors },
    handleSubmit,
    register,
    reset,
  } = useForm<CreateCodeFormValues, unknown, CreateStudentRegistrationCodeInput>({
    resolver: zodResolver(createStudentRegistrationCodeInput),
    defaultValues: {
      label: '',
      maxUses: undefined,
      expiresAt: undefined,
    },
  });

  return (
    <section className="panel panel__body" aria-labelledby="registration-code-title">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Access code</p>
          <h2 id="registration-code-title">Issue code</h2>
        </div>
        <KeyRound aria-hidden="true" size={20} />
      </div>
      <form
        className="form-grid"
        onSubmit={(event) => {
          void handleSubmit((values) => {
            createCode.mutate(values, {
              onSuccess() {
                reset({ label: '', maxUses: undefined, expiresAt: undefined });
              },
            });
          })(event);
        }}
      >
        <Field error={errors.label?.message} label="Label" required>
          <TextInput placeholder="Summer onboarding" {...register('label')} />
        </Field>
        <div className="form-grid form-grid--two">
          <Field error={errors.maxUses?.message} label="Max uses">
            <TextInput
              min={1}
              type="number"
              {...register('maxUses', {
                setValueAs: (value) => (value === '' ? undefined : Number(value)),
              })}
            />
          </Field>
          <Field error={errors.expiresAt?.message} label="Expires">
            <TextInput
              type="date"
              {...register('expiresAt', {
                setValueAs: (value) => (value === '' ? undefined : new Date(String(value))),
              })}
            />
          </Field>
        </div>
        <Button pending={createCode.isPending} type="submit">
          Create code
        </Button>
      </form>
      {latestCode ? (
        <div className="invite-result" role="status">
          <div className="invite-result__summary">
            <div>
              <strong>{latestCode.code}</strong>
              <span>Share this code with the student. It is only shown here once.</span>
            </div>
            <Button
              onClick={() => {
                copyCode(latestCode.code);
              }}
              size="sm"
              type="button"
              variant="secondary"
            >
              <Copy aria-hidden="true" size={15} />
              Copy
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function StudentRegistrationsClient() {
  const [latestCode, setLatestCode] = useState<RegistrationCode | null>(null);
  const registrations = api.registration.listStudentSelfRegistrations.useQuery(undefined, {
    retry: false,
  });
  const codes = api.registration.listStudentRegistrationCodes.useQuery(undefined, {
    retry: false,
  });
  const pendingCount = useMemo(
    () =>
      (registrations.data ?? []).filter(
        (registration) =>
          registration.status === 'Pending' || registration.status === 'AwaitingConsent',
      ).length,
    [registrations.data],
  );

  return (
    <div className="student-registration-admin-page">
      <section className="dashboard-hero">
        <p>Student portal</p>
        <h1>Student registrations</h1>
        <span>Issue registration codes and review student access requests.</span>
      </section>

      <div className="student-registration-admin-layout">
        <CodeCreator latestCode={latestCode} setLatestCode={setLatestCode} />

        <section className="panel panel__body" aria-labelledby="registration-code-history-title">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Issued codes</p>
              <h2 id="registration-code-history-title">Recent codes</h2>
            </div>
            <ShieldCheck aria-hidden="true" size={20} />
          </div>
          {codes.isLoading ? (
            <EmptyState title="Loading codes" />
          ) : codes.data && codes.data.length > 0 ? (
            <div className="student-registration-code-list">
              {codes.data.slice(0, 6).map((code) => (
                <div className="student-registration-code-row" key={code.id}>
                  <div>
                    <strong>{code.label}</strong>
                    <span>
                      {String(code.usedCount)}
                      {code.maxUses ? `/${String(code.maxUses)}` : ''} used
                    </span>
                  </div>
                  <span className={code.active ? 'badge badge--green' : 'badge badge--red'}>
                    {code.active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No codes yet" />
          )}
        </section>
      </div>

      <section className="panel panel__body" aria-labelledby="student-registration-queue-title">
        <div className="panel__header">
          <div>
            <p className="eyebrow">Review queue</p>
            <h2 id="student-registration-queue-title">Student requests</h2>
          </div>
          <span className="badge badge--blue">{String(pendingCount)} pending</span>
        </div>

        {registrations.isLoading ? (
          <EmptyState title="Loading requests" />
        ) : registrations.data && registrations.data.length > 0 ? (
          <div className="student-registration-table-wrap">
            <table className="student-registration-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Email</th>
                  <th>Age band</th>
                  <th>Code</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {registrations.data.map((registration) => (
                  <tr key={registration.id}>
                    <td>
                      <strong>{registration.fullName}</strong>
                      <span>DOB {registration.dob}</span>
                    </td>
                    <td>{registration.email}</td>
                    <td>{registration.yearGroup}</td>
                    <td>{registration.registrationCode.label}</td>
                    <td>
                      <span className={statusTone(registration.status)}>{registration.status}</span>
                    </td>
                    <td>{formatDate(registration.createdAt)}</td>
                    <td>
                      <RegistrationActions registration={registration} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No student registration requests" />
        )}
      </section>
    </div>
  );
}

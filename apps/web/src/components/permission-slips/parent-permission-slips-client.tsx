'use client';

import { type FormEvent, useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  CreditCard,
  PenLine,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, TextInput } from '@/components/ui/field';
import { Panel } from '@/components/ui/panel';
import { showErrorToast, showSuccessToast } from '@/lib/notifications';
import { api } from '@/lib/trpc';
import {
  formatSlipDate,
  PaymentStatusBadge,
  PermissionSlipMeta,
  permissionSlipCategoryLabels,
  ResponseStatusBadge,
  type ParentPermissionSlip,
  type PermissionSlipRecipient,
} from './permission-slip-ui';

type ParentTab = 'outstanding' | 'completed';

interface ParentSlipRow {
  recipient: PermissionSlipRecipient;
  slip: ParentPermissionSlip;
}

interface ResponseFormState {
  agreed: boolean;
  answers: Record<string, string>;
  decision: 'Signed' | 'Declined' | null;
  declineReason: string;
  emergencyContact: string;
  medicalInfo: string;
  parentName: string;
}

const emptyResponseForm = (): ResponseFormState => ({
  agreed: false,
  answers: {},
  decision: null,
  declineReason: '',
  emergencyContact: '',
  medicalInfo: '',
  parentName: '',
});

function isOutstanding(row: ParentSlipRow): boolean {
  return row.recipient.responseStatus === 'Pending' && !row.slip.inactive;
}

function parentSlipRows(slips: readonly ParentPermissionSlip[]): ParentSlipRow[] {
  return slips.flatMap((slip) => slip.recipients.map((recipient) => ({ slip, recipient })));
}

function splitParentSlipRows(rows: readonly ParentSlipRow[]): {
  completedRows: ParentSlipRow[];
  outstandingRows: ParentSlipRow[];
} {
  return rows.reduce<{ completedRows: ParentSlipRow[]; outstandingRows: ParentSlipRow[] }>(
    (groups, row) => {
      if (isOutstanding(row)) {
        groups.outstandingRows.push(row);
      } else {
        groups.completedRows.push(row);
      }
      return groups;
    },
    { completedRows: [], outstandingRows: [] },
  );
}

function ParentSlipCard({ onOpen, row }: { onOpen: () => void; row: ParentSlipRow }) {
  const { recipient, slip } = row;
  const statusClass =
    recipient.responseStatus === 'Signed'
      ? 'is-signed'
      : recipient.responseStatus === 'Declined'
        ? 'is-declined'
        : slip.inactive
          ? 'is-closed'
          : 'is-pending';
  const actionLabel =
    recipient.responseStatus === 'Pending' && !slip.inactive ? 'Open & sign' : 'View';

  return (
    <article className={`permission-parent-card ${statusClass}`}>
      <button onClick={onOpen} type="button">
        <span>
          <Badge tone={slip.inactive ? 'grey' : 'blue'}>
            {permissionSlipCategoryLabels[slip.category]}
          </Badge>
          <ResponseStatusBadge status={recipient.responseStatus} />
          <PaymentStatusBadge status={recipient.paymentStatus} />
        </span>
        <strong>{slip.title}</strong>
        <small>
          {recipient.student.fullName} · Respond by {formatSlipDate(slip.deadline)}
          {slip.cost ? ` · ${slip.cost}` : ''}
        </small>
        <b>{actionLabel}</b>
        <ChevronDown aria-hidden="true" size={17} />
      </button>
    </article>
  );
}

function ParentSlipResponseView({ onBack, row }: { onBack: () => void; row: ParentSlipRow }) {
  const utils = api.useUtils();
  const [form, setForm] = useState<ResponseFormState>(() => emptyResponseForm());
  const [submittedDecision, setSubmittedDecision] = useState<ResponseFormState['decision']>(null);
  const { recipient, slip } = row;
  const canSubmit =
    form.decision &&
    form.parentName.trim() &&
    (form.decision === 'Declined' ||
      (form.agreed &&
        (!slip.requireMedical || form.medicalInfo.trim()) &&
        (!slip.requireEmergencyContact || form.emergencyContact.trim()) &&
        slip.questions.every(
          (question) => !question.required || form.answers[question.id]?.trim(),
        )));

  const submitResponse = api.permissionSlip.submitParentResponse.useMutation({
    async onSuccess(_data, variables) {
      await utils.permissionSlip.listParent.invalidate();
      showSuccessToast('Permission slip response submitted.');
      setSubmittedDecision(variables.decision);
    },
    onError(error) {
      showErrorToast(error, 'Permission slip response could not be submitted.');
    },
  });
  const parentMarkPaid = api.permissionSlip.parentMarkPaid.useMutation({
    async onSuccess() {
      await utils.permissionSlip.listParent.invalidate();
      showSuccessToast('Payment sent for confirmation.');
      onBack();
    },
    onError(error) {
      showErrorToast(error, 'Payment could not be marked paid.');
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.decision) return;
    submitResponse.mutate({
      slipId: slip.id,
      studentId: recipient.studentId,
      decision: form.decision,
      parentName: form.parentName.trim(),
      medicalInfo: form.medicalInfo.trim() || undefined,
      emergencyContact: form.emergencyContact.trim() || undefined,
      declineReason: form.declineReason.trim() || undefined,
      answers: slip.questions.map((question) => ({
        questionId: question.id,
        answer: form.answers[question.id]?.trim() ?? '',
      })),
    });
  }

  if (submittedDecision) {
    return (
      <section className="permission-page">
        <Panel body className="permission-submitted-panel">
          <span className={submittedDecision === 'Signed' ? 'is-signed' : 'is-declined'}>
            {submittedDecision === 'Signed' ? (
              <CheckCircle2 aria-hidden="true" size={42} />
            ) : (
              <X aria-hidden="true" size={42} />
            )}
          </span>
          <h1>{submittedDecision === 'Signed' ? 'Permission granted' : 'Response recorded'}</h1>
          <p>
            {submittedDecision === 'Signed'
              ? `Thank you, ${form.parentName.trim()}. Your e-signature has been recorded for ${recipient.student.fullName}.`
              : `Thank you, ${form.parentName.trim()}. ${recipient.student.fullName} will not take part.`}
          </p>
          <Button onClick={onBack} type="button">
            Back to permission slips
          </Button>
        </Panel>
      </section>
    );
  }

  return (
    <section className="permission-page">
      <Button onClick={onBack} type="button" variant="ghost">
        Back to permission slips
      </Button>
      <Panel body className="permission-detail-hero">
        <div>
          <span className="permission-detail-hero__badges">
            <Badge tone="blue">{permissionSlipCategoryLabels[slip.category]}</Badge>
            <ResponseStatusBadge status={recipient.responseStatus} />
            <PaymentStatusBadge status={recipient.paymentStatus} />
          </span>
          <h1>{slip.title}</h1>
          <p>
            {recipient.student.fullName} · Respond by {formatSlipDate(slip.deadline)}
          </p>
        </div>
      </Panel>

      <PermissionSlipMeta slip={slip} />

      <Panel body className="permission-parent-body">
        {slip.description ? <p>{slip.description}</p> : null}
        {slip.bringItems.length > 0 ? (
          <div>
            <h2>What to bring</h2>
            <ul>
              {slip.bringItems.map((item) => (
                <li key={item.id}>{item.label}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="permission-consent-box">
          <span>Consent statement</span>
          <p>{slip.consentText}</p>
        </div>
      </Panel>

      {recipient.responseStatus === 'Pending' && !slip.inactive ? (
        <Panel body>
          <form className="permission-response-form" onSubmit={submit}>
            <h2>Your decision</h2>
            <div className="permission-decision-grid">
              <button
                className={form.decision === 'Signed' ? 'is-selected' : undefined}
                onClick={() => {
                  setForm((current) => ({ ...current, decision: 'Signed' }));
                }}
                type="button"
              >
                <Check aria-hidden="true" size={18} />
                <strong>Give permission</strong>
                <span>{recipient.student.fullName} will take part.</span>
              </button>
              <button
                className={form.decision === 'Declined' ? 'is-selected is-decline' : undefined}
                onClick={() => {
                  setForm((current) => ({ ...current, decision: 'Declined' }));
                }}
                type="button"
              >
                <X aria-hidden="true" size={18} />
                <strong>Decline permission</strong>
                <span>{recipient.student.fullName} will not take part.</span>
              </button>
            </div>

            {form.decision ? (
              <>
                {form.decision === 'Signed' && slip.requireMedical ? (
                  <Field label="Medical or allergy information" required>
                    <textarea
                      className="input permission-textarea"
                      onChange={(event) => {
                        setForm((current) => ({ ...current, medicalInfo: event.target.value }));
                      }}
                      rows={3}
                      value={form.medicalInfo}
                    />
                  </Field>
                ) : null}
                {form.decision === 'Signed' && slip.requireEmergencyContact ? (
                  <Field label="Emergency contact" required>
                    <TextInput
                      onChange={(event) => {
                        setForm((current) => ({
                          ...current,
                          emergencyContact: event.target.value,
                        }));
                      }}
                      placeholder="Name, phone, relationship"
                      value={form.emergencyContact}
                    />
                  </Field>
                ) : null}
                {form.decision === 'Declined' ? (
                  <Field label="Reason">
                    <textarea
                      className="input permission-textarea"
                      onChange={(event) => {
                        setForm((current) => ({ ...current, declineReason: event.target.value }));
                      }}
                      rows={3}
                      value={form.declineReason}
                    />
                  </Field>
                ) : null}
                {form.decision === 'Signed'
                  ? slip.questions.map((question) => (
                      <Field label={question.label} key={question.id} required={question.required}>
                        <TextInput
                          onChange={(event) => {
                            setForm((current) => ({
                              ...current,
                              answers: { ...current.answers, [question.id]: event.target.value },
                            }));
                          }}
                          value={form.answers[question.id] ?? ''}
                        />
                      </Field>
                    ))
                  : null}
                <Field label="Your full name" required>
                  <TextInput
                    onChange={(event) => {
                      setForm((current) => ({ ...current, parentName: event.target.value }));
                    }}
                    value={form.parentName}
                  />
                </Field>
                {form.parentName.trim() && form.decision === 'Signed' ? (
                  <div className="permission-signature-preview">
                    <span>
                      <PenLine aria-hidden="true" size={16} />
                      Signed name preview
                    </span>
                    <strong>{form.parentName}</strong>
                    <small>
                      Typing your name acts as your e-signature for this permission slip.
                    </small>
                  </div>
                ) : null}
                {form.decision === 'Signed' ? (
                  <label className="permission-agreement">
                    <input
                      checked={form.agreed}
                      onChange={(event) => {
                        setForm((current) => ({ ...current, agreed: event.target.checked }));
                      }}
                      type="checkbox"
                    />
                    <span>
                      I confirm I have read the consent statement and agree on behalf of{' '}
                      <strong>{recipient.student.fullName}</strong>.
                    </span>
                  </label>
                ) : null}
                <Button disabled={!canSubmit} pending={submitResponse.isPending} type="submit">
                  {form.decision === 'Signed' ? 'Submit signed slip' : 'Submit decline'}
                </Button>
              </>
            ) : null}
          </form>
        </Panel>
      ) : null}

      {recipient.responseStatus === 'Signed' && recipient.paymentStatus === 'Unpaid' ? (
        <Panel body className="permission-payment-panel">
          <div>
            <CreditCard aria-hidden="true" size={20} />
            <span>
              <strong>Payment required</strong>
              <small>The slip is signed. Mark payment once you have paid the office.</small>
            </span>
          </div>
          <Button
            onClick={() => {
              parentMarkPaid.mutate({ slipId: slip.id, studentId: recipient.studentId });
            }}
            pending={parentMarkPaid.isPending}
            type="button"
          >
            Mark as paid
          </Button>
        </Panel>
      ) : null}

      {recipient.paymentStatus === 'PaymentPending' ? (
        <Panel body className="permission-payment-panel">
          <div>
            <ClipboardCheck aria-hidden="true" size={20} />
            <span>
              <strong>Payment waiting for confirmation</strong>
              <small>The slip will show as paid after a Head or Pastor confirms it.</small>
            </span>
          </div>
        </Panel>
      ) : null}
    </section>
  );
}

export function ParentPermissionSlipsClient() {
  const [tab, setTab] = useState<ParentTab>('outstanding');
  const [selected, setSelected] = useState<ParentSlipRow | null>(null);
  const slipsQuery = api.permissionSlip.listParent.useQuery(undefined, { retry: false });

  const rows = useMemo<ParentSlipRow[]>(
    () => parentSlipRows(slipsQuery.data?.slips ?? []),
    [slipsQuery.data?.slips],
  );
  const { completedRows, outstandingRows } = useMemo(() => splitParentSlipRows(rows), [rows]);
  const visibleRows = tab === 'outstanding' ? outstandingRows : completedRows;

  if (selected) {
    return (
      <ParentSlipResponseView
        onBack={() => {
          setSelected(null);
        }}
        row={selected}
      />
    );
  }

  return (
    <section className="permission-page">
      <header className="permission-page__header">
        <div>
          <p>Permission Slips</p>
          <h1>Trips and activities</h1>
          <span>Sign, decline, and track payment confirmation for your child.</span>
        </div>
      </header>

      <div className="permission-toolbar">
        <div className="segmented-actions">
          <Button
            className={tab === 'outstanding' ? 'is-selected' : undefined}
            onClick={() => {
              setTab('outstanding');
            }}
            type="button"
            variant={tab === 'outstanding' ? 'primary' : 'secondary'}
          >
            Outstanding · {outstandingRows.length}
          </Button>
          <Button
            className={tab === 'completed' ? 'is-selected' : undefined}
            onClick={() => {
              setTab('completed');
            }}
            type="button"
            variant={tab === 'completed' ? 'primary' : 'secondary'}
          >
            Completed · {completedRows.length}
          </Button>
        </div>
      </div>

      <div className="permission-slip-list">
        {slipsQuery.isLoading ? <Panel body>Loading permission slips...</Panel> : null}
        {!slipsQuery.isLoading && visibleRows.length === 0 ? (
          <Panel body>
            {tab === 'outstanding'
              ? 'No permission slips are waiting for your response.'
              : 'No completed permission slips yet.'}
          </Panel>
        ) : null}
        {visibleRows.map((row) => (
          <ParentSlipCard
            key={`${row.slip.id}:${row.recipient.studentId}`}
            onOpen={() => {
              setSelected(row);
            }}
            row={row}
          />
        ))}
      </div>
    </section>
  );
}

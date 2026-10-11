'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  DBS_APPLICATION_TYPES,
  DBS_CERTIFICATE_STATUSES,
  updateAdultComplianceInput,
  type UpdateAdultComplianceInput,
} from '@oasis/domain';
import type { RouterOutputs } from '@/lib/trpc';
import { api } from '@/lib/trpc';
import { friendlyErrorMessage, showSuccessToast } from '@/lib/notifications';
import { Button } from '@/components/ui/button';
import { Field, SelectInput, TextInput } from '@/components/ui/field';

type PersonOption = RouterOutputs['compliance']['peopleOptions'][number];
type EditableField = Exclude<keyof UpdateAdultComplianceInput, 'userId'>;

interface UpdateComplianceModalProps {
  onClose: () => void;
  options: readonly PersonOption[];
  optionsError: string | null;
  optionsLoading: boolean;
}

const blankForm: UpdateAdultComplianceInput = {
  userId: '',
  dob: null,
  dbsCertificateNumber: null,
  dbsApplicationReference: null,
  dbsCompletedAt: null,
  dbsIssueDate: null,
  dbsApplicationType: null,
  dbsStatus: 'AwaitingCertificate',
  firstAidCompletedAt: null,
  firstAidLevel: null,
  safeguardingCompletedAt: null,
  safeguardingLevel: null,
};

export function UpdateComplianceModal({
  onClose,
  options,
  optionsError,
  optionsLoading,
}: UpdateComplianceModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [form, setForm] = useState<UpdateAdultComplianceInput>(blankForm);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const utils = api.useUtils();
  const person = api.compliance.person.useQuery(
    { userId: selectedUserId },
    { enabled: Boolean(selectedUserId), retry: false },
  );
  const update = api.compliance.update.useMutation({
    async onSuccess() {
      await Promise.all([
        utils.compliance.register.invalidate(),
        utils.compliance.person.invalidate(),
        utils.compliance.badgeSummaries.invalidate(),
        utils.compliance.allBadgeSummaries.invalidate(),
      ]);
      showSuccessToast('Compliance record updated.');
      dialogRef.current?.close();
    },
    onError(error) {
      setErrorMessage(friendlyErrorMessage(error));
    },
  });

  useEffect(() => {
    dialogRef.current?.showModal();
    dialogRef.current?.querySelector('select')?.focus();
  }, []);

  useEffect(() => {
    if (!person.data || person.data.id !== selectedUserId) return;
    setForm({
      userId: person.data.id,
      dob: person.data.dob,
      dbsCertificateNumber: person.data.dbsCertificateNumber,
      dbsApplicationReference: person.data.dbsApplicationReference,
      dbsCompletedAt: person.data.dbsCompletedAt,
      dbsIssueDate: person.data.dbsIssueDate,
      dbsApplicationType: person.data.dbsApplicationType,
      dbsStatus: person.data.dbsStatus,
      firstAidCompletedAt: person.data.firstAidCompletedAt,
      firstAidLevel: person.data.firstAidLevel,
      safeguardingCompletedAt: person.data.safeguardingCompletedAt,
      safeguardingLevel: person.data.safeguardingLevel,
    });
    setErrorMessage(null);
  }, [person.data, selectedUserId]);

  function setField<K extends EditableField>(field: K, value: UpdateAdultComplianceInput[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = updateAdultComplianceInput.safeParse(form);
    if (!parsed.success) {
      setErrorMessage(parsed.error.issues[0]?.message ?? 'Check the record and try again.');
      return;
    }
    setErrorMessage(null);
    update.mutate(parsed.data);
  }

  const disabled = !selectedUserId || person.isLoading || update.isPending || !person.data;

  return (
    <dialog
      aria-labelledby="compliance-update-title"
      className="compliance-modal"
      onCancel={(event) => {
        if (update.isPending) event.preventDefault();
      }}
      onClose={onClose}
      ref={dialogRef}
    >
      <form onSubmit={submit}>
        <header className="compliance-modal__header">
          <div>
            <p>Safeguarding compliance</p>
            <h2 id="compliance-update-title">Update a record</h2>
          </div>
          <Button
            aria-label="Close update dialog"
            disabled={update.isPending}
            onClick={() => dialogRef.current?.close()}
            type="button"
            variant="ghost"
          >
            Close
          </Button>
        </header>
        <div className="compliance-modal__body">
          <Field label="Person" required>
            <SelectInput
              disabled={optionsLoading || update.isPending}
              onChange={(event) => {
                setSelectedUserId(event.target.value);
                setForm(blankForm);
                setErrorMessage(null);
              }}
              value={selectedUserId}
            >
              <option value="">Select a supervisor or parent</option>
              {options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.fullName} · {option.role}
                  {option.active ? '' : ' · Inactive'}
                </option>
              ))}
            </SelectInput>
          </Field>
          {optionsLoading ? <p className="muted">Loading people…</p> : null}
          {optionsError ? (
            <p className="status--error" role="alert">
              {optionsError}
            </p>
          ) : null}
          {person.isLoading && selectedUserId ? <p className="muted">Loading record…</p> : null}
          {person.error ? (
            <p className="status--error" role="alert">
              {friendlyErrorMessage(person.error)}
            </p>
          ) : null}
          <fieldset disabled={disabled}>
            <legend>DBS certificate</legend>
            <div className="compliance-modal__grid">
              <Field label="Certificate number">
                <TextInput
                  onChange={(event) => {
                    setField('dbsCertificateNumber', event.target.value || null);
                  }}
                  value={form.dbsCertificateNumber ?? ''}
                />
              </Field>
              <Field label="Application reference">
                <TextInput
                  onChange={(event) => {
                    setField('dbsApplicationReference', event.target.value || null);
                  }}
                  value={form.dbsApplicationReference ?? ''}
                />
              </Field>
              <Field label="Date of birth">
                <TextInput
                  onChange={(event) => {
                    setField('dob', event.target.value || null);
                  }}
                  type="date"
                  value={form.dob ?? ''}
                />
              </Field>
              <Field label="Date complete">
                <TextInput
                  onChange={(event) => {
                    setField('dbsCompletedAt', event.target.value || null);
                  }}
                  type="date"
                  value={form.dbsCompletedAt ?? ''}
                />
              </Field>
              <Field label="Issue date">
                <TextInput
                  onChange={(event) => {
                    setField('dbsIssueDate', event.target.value || null);
                  }}
                  type="date"
                  value={form.dbsIssueDate ?? ''}
                />
              </Field>
              <Field label="Application type">
                <SelectInput
                  onChange={(event) => {
                    setField(
                      'dbsApplicationType',
                      DBS_APPLICATION_TYPES.find((type) => type === event.target.value) ?? null,
                    );
                  }}
                  value={form.dbsApplicationType ?? ''}
                >
                  <option value="">Not recorded</option>
                  {DBS_APPLICATION_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="Certificate status">
                <SelectInput
                  onChange={(event) => {
                    setField(
                      'dbsStatus',
                      DBS_CERTIFICATE_STATUSES.find((status) => status === event.target.value) ??
                        'AwaitingCertificate',
                    );
                  }}
                  value={form.dbsStatus}
                >
                  <option value="AwaitingCertificate">Awaiting certificate</option>
                  <option value="RecordedCurrent">Recorded current</option>
                  <option value="NoLongerCurrent">No longer current</option>
                </SelectInput>
              </Field>
            </div>
          </fieldset>
          <fieldset disabled={disabled}>
            <legend>First aid training</legend>
            <div className="compliance-modal__grid">
              <Field label="Completion date">
                <TextInput
                  onChange={(event) => {
                    setField('firstAidCompletedAt', event.target.value || null);
                  }}
                  type="date"
                  value={form.firstAidCompletedAt ?? ''}
                />
              </Field>
              <Field label="Level">
                <TextInput
                  onChange={(event) => {
                    setField('firstAidLevel', event.target.value || null);
                  }}
                  value={form.firstAidLevel ?? ''}
                />
              </Field>
            </div>
          </fieldset>
          <fieldset disabled={disabled}>
            <legend>Safeguarding training</legend>
            <div className="compliance-modal__grid">
              <Field label="Completion date">
                <TextInput
                  onChange={(event) => {
                    setField('safeguardingCompletedAt', event.target.value || null);
                  }}
                  type="date"
                  value={form.safeguardingCompletedAt ?? ''}
                />
              </Field>
              <Field label="Level">
                <TextInput
                  onChange={(event) => {
                    setField('safeguardingLevel', event.target.value || null);
                  }}
                  value={form.safeguardingLevel ?? ''}
                />
              </Field>
            </div>
          </fieldset>
          {errorMessage ? (
            <p className="status--error" role="alert">
              {errorMessage}
            </p>
          ) : null}
        </div>
        <footer className="compliance-modal__footer">
          <Button
            disabled={update.isPending}
            onClick={() => dialogRef.current?.close()}
            type="button"
            variant="secondary"
          >
            Cancel
          </Button>
          <Button disabled={disabled} pending={update.isPending} type="submit">
            Save record
          </Button>
        </footer>
      </form>
    </dialog>
  );
}

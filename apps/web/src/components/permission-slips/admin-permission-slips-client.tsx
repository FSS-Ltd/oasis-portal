'use client';

import { useMemo, useState } from 'react';
import { Archive, Check, ClipboardCheck, Plus, Search, X } from 'lucide-react';
import { displaySchoolYearLabel } from '@oasis/domain';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import { TextInput } from '@/components/ui/field';
import { showErrorToast, showSuccessToast } from '@/lib/notifications';
import { api } from '@/lib/trpc';
import { AdminPermissionSlipForm } from './admin-permission-slip-form';
import {
  formatSlipDate,
  formatSlipDateTime,
  PaymentStatusBadge,
  PermissionSlipMeta,
  PermissionSlipProgress,
  permissionSlipCategoryLabels,
  ResponseStatusBadge,
  type AdminPermissionSlip,
  type PermissionSlipRecipient,
} from './permission-slip-ui';

type TabId = 'active' | 'inactive';

interface PhysicalFormState {
  emergencyContact: string;
  medicalInfo: string;
  parentName: string;
  slipId: string;
  studentId: string;
}

function emptyPhysicalForm(slipId: string, studentId: string): PhysicalFormState {
  return { emergencyContact: '', medicalInfo: '', parentName: '', slipId, studentId };
}

function AdminSlipCard({ onOpen, slip }: { onOpen: () => void; slip: AdminPermissionSlip }) {
  return (
    <article className="permission-slip-card">
      <button className="permission-slip-card__main" onClick={onOpen} type="button">
        <span>
          <Badge tone={slip.inactive ? 'grey' : 'blue'}>
            {permissionSlipCategoryLabels[slip.category]}
          </Badge>
          {slip.inactive ? <Badge tone="grey">Inactive</Badge> : <Badge tone="green">Active</Badge>}
        </span>
        <div>
          <h2>{slip.title}</h2>
          <p>
            {slip.recipientLabel} · Deadline {formatSlipDate(slip.deadline)}
            {slip.eventDate ? ` · Event ${formatSlipDate(slip.eventDate)}` : ''}
          </p>
        </div>
        <strong>
          {slip.stats.signed}
          <small>/{slip.stats.total}</small>
        </strong>
      </button>
      <PermissionSlipProgress slip={slip} />
    </article>
  );
}

function PhysicalSignatureForm({
  form,
  pending,
  onCancel,
  onChange,
  onSubmit,
}: {
  form: PhysicalFormState;
  pending: boolean;
  onCancel: () => void;
  onChange: (patch: Partial<PhysicalFormState>) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="permission-physical-form">
      <TextInput
        aria-label="Physical slip signer name"
        onChange={(event) => {
          onChange({ parentName: event.target.value });
        }}
        placeholder="Parent or guardian name"
        value={form.parentName}
      />
      <TextInput
        aria-label="Medical information from physical slip"
        onChange={(event) => {
          onChange({ medicalInfo: event.target.value });
        }}
        placeholder="Medical notes"
        value={form.medicalInfo}
      />
      <TextInput
        aria-label="Emergency contact from physical slip"
        onChange={(event) => {
          onChange({ emergencyContact: event.target.value });
        }}
        placeholder="Emergency contact"
        value={form.emergencyContact}
      />
      <div>
        <Button
          disabled={!form.parentName.trim()}
          onClick={onSubmit}
          pending={pending}
          size="sm"
          type="button"
        >
          Record physical slip
        </Button>
        <Button onClick={onCancel} size="sm" type="button" variant="ghost">
          Cancel
        </Button>
      </div>
    </div>
  );
}

function RecipientRow({
  confirming,
  physicalForm,
  recipient,
  rejecting,
  slip,
  onConfirmPayment,
  onOpenPhysicalForm,
  onPhysicalFormChange,
  onPhysicalFormClose,
  onPhysicalFormSubmit,
  onRejectPayment,
}: {
  confirming: boolean;
  physicalForm: PhysicalFormState | null;
  recipient: PermissionSlipRecipient;
  rejecting: boolean;
  slip: AdminPermissionSlip;
  onConfirmPayment: (recipient: PermissionSlipRecipient) => void;
  onOpenPhysicalForm: (recipient: PermissionSlipRecipient) => void;
  onPhysicalFormChange: (patch: Partial<PhysicalFormState>) => void;
  onPhysicalFormClose: () => void;
  onPhysicalFormSubmit: () => void;
  onRejectPayment: (recipient: PermissionSlipRecipient) => void;
}) {
  const physicalFormOpen =
    physicalForm?.slipId === slip.id && physicalForm.studentId === recipient.studentId;
  const openPhysicalForm = physicalFormOpen ? physicalForm : null;

  return (
    <div className="permission-recipient-row">
      <div>
        <strong>{recipient.student.fullName}</strong>
        <span>{displaySchoolYearLabel(recipient.student.yearGroup)}</span>
      </div>
      <div className="permission-recipient-row__badges">
        <ResponseStatusBadge status={recipient.responseStatus} />
        <PaymentStatusBadge status={recipient.paymentStatus} />
        {recipient.signatureSource ? <Badge tone="grey">{recipient.signatureSource}</Badge> : null}
      </div>
      <div>
        {recipient.parentName ? (
          <span>Signed by {recipient.parentName}</span>
        ) : (
          <span>No response</span>
        )}
        {recipient.signedAt ? <small>{formatSlipDateTime(recipient.signedAt)}</small> : null}
      </div>
      <div className="permission-recipient-row__actions">
        {recipient.responseStatus === 'Pending' ? (
          <Button
            onClick={() => {
              onOpenPhysicalForm(recipient);
            }}
            size="sm"
            type="button"
            variant="secondary"
          >
            <ClipboardCheck aria-hidden="true" size={14} />
            Physical slip
          </Button>
        ) : null}
        {recipient.paymentStatus === 'PaymentPending' ? (
          <>
            <Button
              onClick={() => {
                onConfirmPayment(recipient);
              }}
              pending={confirming}
              size="sm"
              type="button"
            >
              <Check aria-hidden="true" size={14} />
              Confirm
            </Button>
            <Button
              onClick={() => {
                onRejectPayment(recipient);
              }}
              pending={rejecting}
              size="sm"
              type="button"
              variant="secondary"
            >
              <X aria-hidden="true" size={14} />
              Reject
            </Button>
          </>
        ) : null}
      </div>
      {openPhysicalForm ? (
        <PhysicalSignatureForm
          form={openPhysicalForm}
          onCancel={onPhysicalFormClose}
          onChange={onPhysicalFormChange}
          onSubmit={onPhysicalFormSubmit}
          pending={confirming}
        />
      ) : null}
    </div>
  );
}

function AdminSlipDetail({ onBack, slip }: { onBack: () => void; slip: AdminPermissionSlip }) {
  const utils = api.useUtils();
  const [physicalForm, setPhysicalForm] = useState<PhysicalFormState | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const archive = api.permissionSlip.archive.useMutation({
    async onSuccess() {
      await utils.permissionSlip.listAdmin.invalidate();
      showSuccessToast('Permission slip archived.');
      onBack();
    },
    onError(error) {
      showErrorToast(error, 'Permission slip could not be archived.');
    },
  });
  const markPhysicalSigned = api.permissionSlip.markPhysicalSigned.useMutation({
    onSettled: () => {
      setPendingKey(null);
    },
    async onSuccess() {
      setPhysicalForm(null);
      await utils.permissionSlip.listAdmin.invalidate();
      showSuccessToast('Physical permission slip recorded.');
    },
    onError(error) {
      showErrorToast(error, 'Physical permission slip could not be recorded.');
    },
  });
  const confirmPayment = api.permissionSlip.confirmPayment.useMutation({
    onSettled: () => {
      setPendingKey(null);
    },
    async onSuccess() {
      await utils.permissionSlip.listAdmin.invalidate();
      showSuccessToast('Payment confirmed.');
    },
    onError(error) {
      showErrorToast(error, 'Payment could not be confirmed.');
    },
  });
  const rejectPayment = api.permissionSlip.rejectPayment.useMutation({
    onSettled: () => {
      setPendingKey(null);
    },
    async onSuccess() {
      await utils.permissionSlip.listAdmin.invalidate();
      showSuccessToast('Payment returned to unpaid.');
    },
    onError(error) {
      showErrorToast(error, 'Payment could not be rejected.');
    },
  });

  const pendingPhysical = physicalForm ? `${physicalForm.slipId}:${physicalForm.studentId}` : null;

  return (
    <div className="permission-page">
      <Button onClick={onBack} type="button" variant="ghost">
        Back to slips
      </Button>
      <Panel body className="permission-detail-hero">
        <div>
          <span className="permission-detail-hero__badges">
            <Badge tone={slip.inactive ? 'grey' : 'blue'}>
              {permissionSlipCategoryLabels[slip.category]}
            </Badge>
            <Badge tone={slip.inactive ? 'grey' : 'green'}>
              {slip.inactive ? 'Inactive' : 'Active'}
            </Badge>
          </span>
          <h1>{slip.title}</h1>
          <p>
            {slip.recipientLabel} · Deadline {formatSlipDate(slip.deadline)}
          </p>
        </div>
        <Button
          onClick={() => {
            archive.mutate({ id: slip.id });
          }}
          pending={archive.isPending}
          type="button"
          variant="secondary"
        >
          <Archive aria-hidden="true" size={16} />
          Archive
        </Button>
      </Panel>

      <PermissionSlipMeta slip={slip} />

      {slip.description ? <Panel body>{slip.description}</Panel> : null}

      <div className="permission-stat-grid">
        <Panel body>
          <span>Recipients</span>
          <strong>{slip.stats.total}</strong>
        </Panel>
        <Panel body>
          <span>Signed</span>
          <strong>{slip.stats.signed}</strong>
        </Panel>
        <Panel body>
          <span>Awaiting</span>
          <strong>{slip.stats.pending}</strong>
        </Panel>
        <Panel body>
          <span>Payment pending</span>
          <strong>{slip.stats.paymentPending}</strong>
        </Panel>
      </div>

      <Panel body className="permission-recipient-panel">
        <h2>Responses</h2>
        {slip.recipients.map((recipient) => {
          const rowKey = `${slip.id}:${recipient.studentId}`;
          return (
            <RecipientRow
              confirming={
                pendingKey === rowKey && (confirmPayment.isPending || markPhysicalSigned.isPending)
              }
              key={rowKey}
              onConfirmPayment={(target) => {
                setPendingKey(rowKey);
                confirmPayment.mutate({ slipId: slip.id, studentId: target.studentId });
              }}
              onOpenPhysicalForm={(target) => {
                setPhysicalForm(emptyPhysicalForm(slip.id, target.studentId));
              }}
              onPhysicalFormChange={(patch) => {
                setPhysicalForm((current) => (current ? { ...current, ...patch } : current));
              }}
              onPhysicalFormClose={() => {
                setPhysicalForm(null);
              }}
              onPhysicalFormSubmit={() => {
                if (!physicalForm) return;
                setPendingKey(pendingPhysical);
                markPhysicalSigned.mutate({
                  slipId: physicalForm.slipId,
                  studentId: physicalForm.studentId,
                  parentName: physicalForm.parentName.trim(),
                  medicalInfo: physicalForm.medicalInfo.trim() || undefined,
                  emergencyContact: physicalForm.emergencyContact.trim() || undefined,
                });
              }}
              onRejectPayment={(target) => {
                setPendingKey(rowKey);
                rejectPayment.mutate({ slipId: slip.id, studentId: target.studentId });
              }}
              physicalForm={physicalForm}
              recipient={recipient}
              rejecting={pendingKey === rowKey && rejectPayment.isPending}
              slip={slip}
            />
          );
        })}
      </Panel>
    </div>
  );
}

export function AdminPermissionSlipsClient() {
  const utils = api.useUtils();
  const [tab, setTab] = useState<TabId>('active');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedSlipId, setSelectedSlipId] = useState<string | null>(null);

  const slipsQuery = api.permissionSlip.listAdmin.useQuery(undefined, { retry: false });
  const studentsQuery = api.permissionSlip.listStudentCandidates.useQuery(undefined, {
    enabled: showCreate,
    retry: false,
  });
  const createSlip = api.permissionSlip.create.useMutation({
    async onSuccess() {
      await utils.permissionSlip.listAdmin.invalidate();
      setShowCreate(false);
      showSuccessToast('Permission slip sent.');
    },
    onError(error) {
      showErrorToast(error, 'Permission slip could not be sent.');
    },
  });

  const slips = slipsQuery.data?.slips ?? [];
  const selectedSlip = slips.find((slip) => slip.id === selectedSlipId) ?? null;
  const filteredSlips = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return slips.filter((slip) => {
      if (tab === 'active' && slip.inactive) return false;
      if (tab === 'inactive' && !slip.inactive) return false;
      if (!normalizedSearch) return true;
      return (
        slip.title.toLowerCase().includes(normalizedSearch) ||
        slip.recipientLabel.toLowerCase().includes(normalizedSearch)
      );
    });
  }, [search, slips, tab]);

  if (selectedSlip) {
    return (
      <AdminSlipDetail
        onBack={() => {
          setSelectedSlipId(null);
        }}
        slip={selectedSlip}
      />
    );
  }

  return (
    <section className="permission-page">
      <header className="permission-page__header">
        <div>
          <p>Permission Slips</p>
          <h1>Consent forms</h1>
          <span>Compose, send, and track trip and activity permissions.</span>
        </div>
        <Button
          onClick={() => {
            setShowCreate(true);
          }}
          type="button"
        >
          <Plus aria-hidden="true" size={16} />
          New permission slip
        </Button>
      </header>

      <div className="permission-stat-grid">
        <Panel body>
          <span>Active</span>
          <strong>{slipsQuery.data?.stats.active ?? 0}</strong>
        </Panel>
        <Panel body>
          <span>Pending signatures</span>
          <strong>{slipsQuery.data?.stats.pending ?? 0}</strong>
        </Panel>
        <Panel body>
          <span>Signed</span>
          <strong>{slipsQuery.data?.stats.signed ?? 0}</strong>
        </Panel>
        <Panel body>
          <span>Payment pending</span>
          <strong>{slipsQuery.data?.stats.paymentPending ?? 0}</strong>
        </Panel>
      </div>

      <div className="permission-toolbar">
        <div className="segmented-actions">
          <Button
            className={tab === 'active' ? 'is-selected' : undefined}
            onClick={() => {
              setTab('active');
            }}
            type="button"
            variant={tab === 'active' ? 'primary' : 'secondary'}
          >
            Active
          </Button>
          <Button
            className={tab === 'inactive' ? 'is-selected' : undefined}
            onClick={() => {
              setTab('inactive');
            }}
            type="button"
            variant={tab === 'inactive' ? 'primary' : 'secondary'}
          >
            Inactive
          </Button>
        </div>
        <label className="permission-search">
          <Search aria-hidden="true" size={16} />
          <TextInput
            onChange={(event) => {
              setSearch(event.target.value);
            }}
            placeholder="Search slips"
            value={search}
          />
        </label>
      </div>

      <div className="permission-slip-list">
        {slipsQuery.isLoading ? <Panel body>Loading permission slips...</Panel> : null}
        {!slipsQuery.isLoading && filteredSlips.length === 0 ? (
          <Panel body>No permission slips match this view.</Panel>
        ) : null}
        {filteredSlips.map((slip) => (
          <AdminSlipCard
            key={slip.id}
            onOpen={() => {
              setSelectedSlipId(slip.id);
            }}
            slip={slip}
          />
        ))}
      </div>

      {showCreate ? (
        <AdminPermissionSlipForm
          creating={createSlip.isPending}
          onClose={() => {
            setShowCreate(false);
          }}
          onSubmit={(input) => {
            createSlip.mutate(input);
          }}
          students={studentsQuery.data ?? []}
        />
      ) : null}
    </section>
  );
}

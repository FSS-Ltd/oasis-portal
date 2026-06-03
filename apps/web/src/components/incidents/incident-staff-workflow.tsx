'use client';

import { type FormEvent, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  Download,
  Eye,
  FileText,
  Info,
  Pencil,
  Plus,
  Save,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { ConfirmationDialog } from '@/components/admin/confirmation-dialog';
import {
  BehaviourStudentSelector,
  type BehaviourStudentOption,
} from '@/components/behaviour/behaviour-student-selector';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { Field, SelectInput, TextInput } from '@/components/ui/field';
import { Panel } from '@/components/ui/panel';
import { StatCard } from '@/components/ui/stat-card';
import { friendlyErrorMessage, showErrorToast, showSuccessToast } from '@/lib/notifications';
import { api } from '@/lib/trpc';
import {
  formatIncidentDate,
  formatIncidentDateTime,
  incidentConfidentialityLabels,
  incidentSeverityLabels,
  incidentStatusLabels,
  incidentTypeLabels,
  statusTone,
} from './incident-format';
import { IncidentReportDetail } from './incident-report-detail';
import {
  defaultIncidentForm,
  emptyCopyForm,
  incidentFormFromReport,
  incidentFormInput,
  incidentFormProgress,
  joinLocalDateTime,
  parentVisibilityRoles,
  reportabilityChecks,
  splitLocalDateTime,
  type IncidentConfidentiality,
  type IncidentFormState,
  type IncidentSeverity,
  type IncidentType,
  type ParentCopyFormState,
  type StaffIncident,
} from './incident-staff-workflow-state';

interface StaffIncidentWorkflowProps {
  portal: 'admin' | 'supervisor';
}

function IncidentStatusBadge({ status }: { status: StaffIncident['status'] }) {
  return <Badge tone={statusTone(status)}>{incidentStatusLabels[status]}</Badge>;
}

function ChoiceButton({
  children,
  selected,
  onClick,
}: {
  children: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`incident-choice-button${selected ? ' is-selected' : ''}`}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function BooleanSegment({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="incident-segment-field">
      <span>{label}</span>
      <div className="incident-segment" role="group" aria-label={label}>
        <button
          className={value ? 'is-selected' : ''}
          onClick={() => {
            onChange(true);
          }}
          type="button"
        >
          Yes
        </button>
        <button
          className={!value ? 'is-selected' : ''}
          onClick={() => {
            onChange(false);
          }}
          type="button"
        >
          No
        </button>
      </div>
    </div>
  );
}

function SwitchRow({
  checked,
  description,
  disabled = false,
  label,
  onChange,
}: {
  checked: boolean;
  description?: string;
  disabled?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="incident-switch-row">
      <input
        checked={checked}
        className="switch-input"
        disabled={disabled}
        onChange={(event) => {
          onChange(event.target.checked);
        }}
        type="checkbox"
      />
      <span>
        <strong>{label}</strong>
        {description ? <small>{description}</small> : null}
      </span>
    </label>
  );
}

function IncidentProgressRail({
  form,
  parentVisibilityAllowed,
  pending,
  onChange,
}: {
  form: IncidentFormState;
  parentVisibilityAllowed: boolean;
  pending: boolean;
  onChange: (patch: Partial<IncidentFormState>) => void;
}) {
  const progress = incidentFormProgress(form);
  const progressPercent = Math.round((progress.completed / progress.total) * 100);

  return (
    <aside className="incident-form-rail">
      <Panel body className="incident-rail-card">
        <div className="incident-rail-card__head">
          <h3>Report progress</h3>
          <strong>{progressPercent}%</strong>
        </div>
        <div className="incident-progress-bar" aria-label="Report completion">
          <span style={{ width: `${String(progressPercent)}%` }} />
        </div>
        <p className="muted">
          {String(progress.completed)} of {String(progress.total)} essentials completed
        </p>
      </Panel>

      <Panel body className="incident-rail-card">
        <h3>A. Reportability checklist</h3>
        <div className="incident-rail-checks">
          {reportabilityChecks.map(({ field, help, label }) => (
            <label className="incident-rail-check" key={field}>
              <input
                checked={form[field]}
                onChange={(event) => {
                  onChange({ ...form, [field]: event.target.checked });
                }}
                type="checkbox"
              />
              <span>{label}</span>
              <button
                aria-label={`${label} guidance`}
                className="incident-info-button"
                type="button"
              >
                <Info aria-hidden="true" size={16} />
                <span role="tooltip">{help}</span>
              </button>
            </label>
          ))}
        </div>
      </Panel>

      <Panel body className={`incident-rail-card${parentVisibilityAllowed ? '' : ' is-disabled'}`}>
        <h3>B. Parent PDF visibility</h3>
        <SwitchRow
          checked={form.parentVisibilityRequested}
          description={
            parentVisibilityAllowed
              ? 'Available only after Head sign-off or approved escalation summary.'
              : 'Head, Pastor, Head of Discipline, or Principal access is required.'
          }
          disabled={!parentVisibilityAllowed}
          label="Make viewable to parent"
          onChange={(checked) => {
            onChange({ parentVisibilityRequested: checked });
          }}
        />
        <Field label="Data sharing reason">
          <textarea
            className="input incident-textarea incident-textarea--short"
            disabled={!parentVisibilityAllowed}
            maxLength={2000}
            onChange={(event) => {
              onChange({ dataSharingReason: event.target.value });
            }}
            placeholder="Record the lawful, child-safe reason before parent visibility."
            value={form.dataSharingReason}
          />
          <span className="incident-character-count">{form.dataSharingReason.length} / 2000</span>
        </Field>
        <div className="incident-action-row">
          <Button disabled type="button" variant="secondary">
            <Eye aria-hidden="true" size={15} />
            Preview PDF
          </Button>
          <Button disabled type="button" variant="secondary">
            <Download aria-hidden="true" size={15} />
            Download PDF
          </Button>
        </div>
      </Panel>

      <Panel body className="incident-rail-card">
        <h3>C. Sign-off trail</h3>
        <div className="incident-rail-timeline">
          <div className="incident-rail-timeline__item is-active">
            <span />
            <div>
              <strong>{pending ? 'Saving draft' : 'Draft in progress'}</strong>
              <small>Saved reports enter Head review when submitted.</small>
            </div>
          </div>
          <div className="incident-rail-timeline__item">
            <span />
            <div>
              <strong>Head review pending</strong>
              <small>Awaiting Head or DSL sign-off.</small>
            </div>
          </div>
          <div className="incident-rail-timeline__item">
            <span />
            <div>
              <strong>Pastor/Principal escalation</strong>
              <small>Only used for escalated concerns.</small>
            </div>
          </div>
          <div className="incident-rail-timeline__item">
            <span />
            <div>
              <strong>Parent shared</strong>
              <small>Visible after sign-off and explicit sharing.</small>
            </div>
          </div>
        </div>
      </Panel>
    </aside>
  );
}

function IncidentForm({
  formId,
  form,
  studentError,
  studentOptions,
  studentsLoading,
  staffError,
  staffOptions,
  staffLoading,
  onChange,
  onSubmit,
}: {
  formId: string;
  form: IncidentFormState;
  staffError?: string | undefined;
  staffOptions: readonly BehaviourStudentOption[];
  staffLoading: boolean;
  studentError?: string | undefined;
  studentOptions: readonly BehaviourStudentOption[];
  studentsLoading: boolean;
  onChange: (patch: Partial<IncidentFormState>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const occurred = splitLocalDateTime(form.occurredAt);

  return (
    <Panel body className="incident-form-panel">
      <form className="incident-form" id={formId} onSubmit={onSubmit}>
        <section className="incident-form-section">
          <h3>
            <span>1</span> Incident classification
          </h3>
          <div className="incident-form-grid incident-form-grid--split">
            <div className="incident-option-group">
              <span className="field__label">
                Incident type <em>Required</em>
              </span>
              <div className="incident-choice-grid">
                {Object.entries(incidentTypeLabels).map(([value, label]) => (
                  <ChoiceButton
                    key={value}
                    onClick={() => {
                      onChange({ type: value as IncidentType });
                    }}
                    selected={form.type === value}
                  >
                    {label}
                  </ChoiceButton>
                ))}
              </div>
            </div>
            <div className="incident-option-group">
              <span className="field__label">Severity</span>
              <div
                className="incident-segment incident-segment--severity"
                role="group"
                aria-label="Severity"
              >
                {Object.entries(incidentSeverityLabels).map(([value, label]) => (
                  <button
                    className={form.severity === value ? 'is-selected' : ''}
                    key={value}
                    onClick={() => {
                      onChange({ severity: value as IncidentSeverity });
                    }}
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <Field label="Confidentiality" required>
              <SelectInput
                onChange={(event) => {
                  onChange({ confidentiality: event.target.value as IncidentConfidentiality });
                }}
                value={form.confidentiality}
              >
                {Object.entries(incidentConfidentialityLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </SelectInput>
            </Field>
          </div>
        </section>

        <section className="incident-form-section">
          <h3>
            <span>2</span> When and where
          </h3>
          <div className="incident-form-grid incident-form-grid--four">
            <Field label="Date" required>
              <TextInput
                onChange={(event) => {
                  onChange({ occurredAt: joinLocalDateTime(event.target.value, occurred.time) });
                }}
                type="date"
                value={occurred.date}
              />
            </Field>
            <Field label="Time" required>
              <TextInput
                onChange={(event) => {
                  onChange({ occurredAt: joinLocalDateTime(occurred.date, event.target.value) });
                }}
                type="time"
                value={occurred.time}
              />
            </Field>
            <Field label="Location" required>
              <TextInput
                onChange={(event) => {
                  onChange({ location: event.target.value });
                }}
                value={form.location}
              />
            </Field>
            <Field label="Context / activity">
              <TextInput
                onChange={(event) => {
                  onChange({ activity: event.target.value });
                }}
                value={form.activity}
              />
            </Field>
          </div>
          <SwitchRow
            checked={form.offSite}
            label="Was this during a school trip or off-site activity?"
            onChange={(checked) => {
              onChange({ offSite: checked });
            }}
          />
        </section>

        <section className="incident-form-section">
          <h3>
            <span>3</span> People involved
          </h3>
          <div className="incident-form-grid">
            <BehaviourStudentSelector
              chooseLabel="Choose children"
              emptyLabel="No children selected"
              hint={studentError ?? undefined}
              label="Child / children involved"
              loading={studentsLoading}
              loadingLabel="Loading children..."
              onChange={(studentIds) => {
                onChange({ studentIds });
              }}
              options={studentOptions}
              selectedAriaLabel="Selected children"
              selectedIds={form.studentIds}
              selectedLabel="children selected"
            />
            <BehaviourStudentSelector
              chooseLabel="Choose staff"
              emptyLabel="No staff selected"
              hint={staffError ?? undefined}
              label="Staff involved"
              loading={staffLoading}
              loadingLabel="Loading staff..."
              onChange={(staffIds) => {
                onChange({ staffIds });
              }}
              options={staffOptions}
              selectedAriaLabel="Selected staff"
              selectedIds={form.staffIds}
              selectedLabel="staff selected"
            />
            <BehaviourStudentSelector
              chooseLabel="Choose witnesses"
              emptyLabel="No witnesses selected"
              hint={staffError ?? undefined}
              label="Witnesses (if any)"
              loading={staffLoading}
              loadingLabel="Loading staff..."
              onChange={(witnessStaffIds) => {
                onChange({ witnessStaffIds });
              }}
              options={staffOptions}
              selectedAriaLabel="Selected witnesses"
              selectedIds={form.witnessStaffIds}
              selectedLabel="witnesses selected"
            />
          </div>
          <Field label="Other witnesses / notes">
            <TextInput
              onChange={(event) => {
                onChange({ witnesses: event.target.value });
              }}
              value={form.witnesses}
            />
          </Field>
        </section>

        <section className="incident-form-section">
          <h3>
            <span>4</span> Factual account
          </h3>
          <div className="incident-form-grid incident-form-grid--wide">
            <Field label="What happened?" required>
              <textarea
                className="input incident-textarea"
                onChange={(event) => {
                  onChange({ factualAccount: event.target.value });
                }}
                value={form.factualAccount}
              />
            </Field>
            <Field label="Child's voice / direct disclosure">
              <textarea
                className="input incident-textarea"
                onChange={(event) => {
                  onChange({ directDisclosure: event.target.value });
                }}
                value={form.directDisclosure}
              />
            </Field>
          </div>
          <Field label="Immediate actions taken">
            <textarea
              className="input incident-textarea incident-textarea--short"
              onChange={(event) => {
                onChange({ immediateActions: event.target.value });
              }}
              value={form.immediateActions}
            />
          </Field>
        </section>

        <section className="incident-form-section">
          <h3>
            <span>5</span> Injury, first aid and medical
          </h3>
          <div className="incident-form-grid">
            <BooleanSegment
              label="Injury sustained?"
              onChange={(value) => {
                onChange({ injurySustained: value });
              }}
              value={form.injurySustained}
            />
            <Field label="What was the injury?">
              <TextInput
                onChange={(event) => {
                  onChange({ bodyArea: event.target.value });
                }}
                value={form.bodyArea}
              />
            </Field>
            <BooleanSegment
              label="First aid given?"
              onChange={(value) => {
                onChange({ firstAidGiven: value });
              }}
              value={form.firstAidGiven}
            />
            <Field label="First aider">
              <SelectInput
                onChange={(event) => {
                  onChange({ firstAiderId: event.target.value });
                }}
                value={form.firstAiderId}
              >
                <option value="">Select first aider</option>
                {staffOptions.map((staffMember) => (
                  <option key={staffMember.id} value={staffMember.id}>
                    {staffMember.label}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <BooleanSegment
              label="Hospital / 111 / 999 contacted?"
              onChange={(value) => {
                onChange({ emergencyServicesContacted: value });
              }}
              value={form.emergencyServicesContacted}
            />
            <BooleanSegment
              label="Hospital treatment?"
              onChange={(value) => {
                onChange({ hospitalTreatment: value });
              }}
              value={form.hospitalTreatment}
            />
            <BooleanSegment
              label="Parent / carer notified?"
              onChange={(value) => {
                onChange({ parentCarerNotified: value });
              }}
              value={form.parentCarerNotified}
            />
            <Field label="Time notified">
              <TextInput
                onChange={(event) => {
                  onChange({ parentNotifiedAt: event.target.value });
                }}
                type="time"
                value={form.parentNotifiedAt}
              />
            </Field>
            <Field label="Notes">
              <TextInput
                onChange={(event) => {
                  onChange({ medicalNotes: event.target.value });
                }}
                value={form.medicalNotes}
              />
            </Field>
          </div>
        </section>
      </form>
    </Panel>
  );
}

function confirmParentVisibilityOverride(): boolean {
  return window.confirm('Are you sure you want to make this incident visible to parents?');
}

function ParentCopyPanel({
  canOverrideParentVisibility,
  report,
}: {
  canOverrideParentVisibility: boolean;
  report: StaffIncident;
}) {
  const utils = api.useUtils();
  const [form, setForm] = useState<ParentCopyFormState>(() => emptyCopyForm(report));
  const generate = api.incident.generateParentCopy.useMutation({
    async onSuccess() {
      await utils.incident.listStaff.invalidate();
      showSuccessToast('Parent copy generated.');
    },
    onError(error) {
      showErrorToast(error, 'Parent copy could not be generated.');
    },
  });
  const share = api.incident.shareParentCopy.useMutation({
    async onSuccess() {
      await utils.incident.listStaff.invalidate();
      showSuccessToast('Parent copy shared.');
    },
    onError(error) {
      showErrorToast(error, 'Parent copy could not be shared.');
    },
  });
  const selectedCopy = report.parentCopies.find((copy) => copy.studentId === form.studentId);
  const overrideRequired = report.status !== 'SignedOff';
  const overrideAvailable =
    canOverrideParentVisibility &&
    (report.status === 'HeadReview' || report.status === 'Escalated');
  const canGenerate =
    Boolean(form.studentId && form.parentSummary.trim()) &&
    (report.status === 'SignedOff' || overrideAvailable);

  return (
    <Panel body className="incident-side-panel">
      <h3>Parent PDF visibility</h3>
      <p className="muted">
        Available after Head sign-off. Senior reviewers can override from Head review or escalation
        with confirmation.
      </p>
      <Field label="Child">
        <SelectInput
          onChange={(event) => {
            setForm((current) => ({ ...current, studentId: event.target.value }));
          }}
          value={form.studentId}
        >
          {report.students.map((student) => (
            <option key={student.studentId} value={student.studentId}>
              {student.fullName}
            </option>
          ))}
        </SelectInput>
      </Field>
      <Field label="Parent summary">
        <textarea
          className="input incident-textarea incident-textarea--short"
          onChange={(event) => {
            setForm((current) => ({ ...current, parentSummary: event.target.value }));
          }}
          value={form.parentSummary}
        />
      </Field>
      <Field label="Sharing reason">
        <TextInput
          onChange={(event) => {
            setForm((current) => ({ ...current, sharingReason: event.target.value }));
          }}
          value={form.sharingReason}
        />
      </Field>
      <div className="incident-action-row">
        <Button
          disabled={!canGenerate}
          onClick={() => {
            if (overrideRequired && !confirmParentVisibilityOverride()) return;
            generate.mutate({
              reportId: report.id,
              studentId: form.studentId,
              parentSummary: form.parentSummary,
              sharingReason: form.sharingReason,
              overrideVisibility: overrideRequired,
            });
          }}
          pending={generate.isPending}
          type="button"
          variant="secondary"
        >
          <FileText aria-hidden="true" size={15} />
          Generate PDF
        </Button>
        <Button
          disabled={!selectedCopy || selectedCopy.status !== 'Generated'}
          onClick={() => {
            if (!selectedCopy) return;
            if (overrideRequired && !confirmParentVisibilityOverride()) return;
            share.mutate({ copyId: selectedCopy.id, overrideVisibility: overrideRequired });
          }}
          pending={share.isPending}
          type="button"
        >
          <Send aria-hidden="true" size={15} />
          Share
        </Button>
      </div>
      {selectedCopy ? (
        <Badge tone={selectedCopy.status === 'Shared' ? 'green' : 'blue'}>
          {selectedCopy.status}
        </Badge>
      ) : null}
    </Panel>
  );
}

function IncidentDetail({
  canManageDraft,
  canOverrideParentVisibility,
  onClose,
  onDeleteDraft,
  onEditDraft,
  portal,
  report,
}: {
  canManageDraft: boolean;
  canOverrideParentVisibility: boolean;
  onClose: () => void;
  onDeleteDraft: (report: StaffIncident) => void;
  onEditDraft: (report: StaffIncident) => void;
  portal: StaffIncidentWorkflowProps['portal'];
  report: StaffIncident;
}) {
  const utils = api.useUtils();
  const submit = api.incident.submitForHeadReview.useMutation({
    async onSuccess() {
      await utils.incident.listStaff.invalidate();
      showSuccessToast('Incident submitted for Head review.');
    },
    onError(error) {
      showErrorToast(error, 'Incident could not be submitted.');
    },
  });
  const signOff = api.incident.signOff.useMutation({
    async onSuccess() {
      await utils.incident.listStaff.invalidate();
      showSuccessToast('Incident signed off.');
    },
    onError(error) {
      showErrorToast(error, 'Incident could not be signed off.');
    },
  });
  const escalate = api.incident.escalate.useMutation({
    async onSuccess() {
      await utils.incident.listStaff.invalidate();
      showSuccessToast('Incident escalated.');
    },
    onError(error) {
      showErrorToast(error, 'Incident could not be escalated.');
    },
  });

  return (
    <aside className="incident-detail">
      <Panel body className="incident-side-panel">
        <div className="incident-detail__head">
          <div>
            <h2>{incidentTypeLabels[report.type as IncidentType]}</h2>
            <p>{report.reportNumber}</p>
          </div>
          <div className="incident-detail__head-actions">
            <IncidentStatusBadge status={report.status} />
            <button aria-label="Close incident overview" onClick={onClose} type="button">
              <X aria-hidden="true" size={20} />
            </button>
          </div>
        </div>
        <div className="incident-overview-section">
          <h3>People involved</h3>
          <div className="incident-people-chips">
            {report.students.map((student) => (
              <span key={student.studentId}>{student.fullName}</span>
            ))}
          </div>
        </div>
        <div className="incident-detail__meta">
          <span>Recorded by</span>
          <strong>{report.recordedByName ?? 'Staff'}</strong>
          <span>When</span>
          <strong>{formatIncidentDateTime(report.occurredAt)}</strong>
          <span>Location</span>
          <strong>{report.location}</strong>
        </div>
        <div className="incident-overview-section">
          <h3>Timeline</h3>
          <div className="incident-overview-timeline">
            <div className="incident-overview-timeline__item is-active">
              <span />
              <div>
                <strong>Recorded</strong>
                <small>{formatIncidentDateTime(report.createdAt)}</small>
              </div>
            </div>
            <div
              className={`incident-overview-timeline__item${report.status !== 'Draft' ? ' is-active' : ''}`}
            >
              <span />
              <div>
                <strong>Head reviewed</strong>
                <small>
                  {report.signedOffAt
                    ? formatIncidentDateTime(report.signedOffAt)
                    : 'Awaiting review'}
                </small>
              </div>
            </div>
            <div
              className={`incident-overview-timeline__item${report.status === 'Escalated' ? ' is-warning' : ''}`}
            >
              <span />
              <div>
                <strong>Escalated to Pastor/Principal</strong>
                <small>
                  {report.escalatedAt ? formatIncidentDateTime(report.escalatedAt) : 'Optional'}
                </small>
              </div>
            </div>
          </div>
        </div>
        <div className="incident-detail__actions">
          {canManageDraft ? (
            <>
              <Button
                onClick={() => {
                  onEditDraft(report);
                }}
                type="button"
                variant="secondary"
              >
                <Pencil aria-hidden="true" size={15} />
                Edit draft
              </Button>
              <Button
                onClick={() => {
                  onDeleteDraft(report);
                }}
                type="button"
                variant="danger"
              >
                <Trash2 aria-hidden="true" size={15} />
                Delete draft
              </Button>
            </>
          ) : null}
          <Button
            disabled={report.status !== 'Draft' || !canManageDraft}
            onClick={() => {
              submit.mutate({ reportId: report.id });
            }}
            pending={submit.isPending}
            type="button"
            variant="secondary"
          >
            Submit for Head review
          </Button>
          {portal === 'admin' ? (
            <>
              <Button
                disabled={report.status !== 'HeadReview' && report.status !== 'Escalated'}
                onClick={() => {
                  signOff.mutate({ reportId: report.id });
                }}
                pending={signOff.isPending}
                type="button"
              >
                <ShieldCheck aria-hidden="true" size={15} />
                Sign off
              </Button>
              <Button
                disabled={report.status !== 'HeadReview'}
                onClick={() => {
                  escalate.mutate({ reportId: report.id });
                }}
                pending={escalate.isPending}
                type="button"
                variant="secondary"
              >
                <AlertTriangle aria-hidden="true" size={15} />
                Escalate
              </Button>
            </>
          ) : null}
        </div>
      </Panel>
      <Panel body className="incident-side-panel">
        <h3>Report details</h3>
        <IncidentReportDetail report={report} />
      </Panel>
      {portal === 'admin' ? (
        <ParentCopyPanel
          canOverrideParentVisibility={canOverrideParentVisibility}
          report={report}
        />
      ) : null}
    </aside>
  );
}

export function IncidentStaffWorkflow({ portal }: StaffIncidentWorkflowProps) {
  const [mode, setMode] = useState<'dashboard' | 'form'>('dashboard');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [deleteDraftReport, setDeleteDraftReport] = useState<StaffIncident | null>(null);
  const [form, setForm] = useState<IncidentFormState>(defaultIncidentForm);
  const incidents = api.incident.listStaff.useQuery();
  const profile = api.profile.me.useQuery(undefined, { retry: false });
  const students = api.student.list.useQuery(undefined, { retry: false });
  const staff = api.incident.listStaffOptions.useQuery(undefined, { retry: false });
  const utils = api.useUtils();
  const createDraft = api.incident.createDraft.useMutation({
    async onSuccess(data) {
      setForm(defaultIncidentForm);
      setMode('dashboard');
      setSelectedId(data.id);
      await utils.incident.listStaff.invalidate();
      showSuccessToast('Incident draft saved.');
    },
    onError(error) {
      showErrorToast(error, 'Incident draft could not be saved.');
    },
  });
  const updateDraft = api.incident.updateDraft.useMutation({
    async onSuccess(data) {
      setForm(defaultIncidentForm);
      setEditingReportId(null);
      setMode('dashboard');
      setSelectedId(data.id);
      await utils.incident.listStaff.invalidate();
      showSuccessToast('Incident draft updated.');
    },
    onError(error) {
      showErrorToast(error, 'Incident draft could not be updated.');
    },
  });
  const deleteDraft = api.incident.deleteDraft.useMutation({
    async onSuccess() {
      setDeleteDraftReport(null);
      setSelectedId(null);
      await utils.incident.listStaff.invalidate();
      showSuccessToast('Incident draft deleted.');
    },
    onError(error) {
      showErrorToast(error, 'Incident draft could not be deleted.');
    },
  });
  const rows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return (incidents.data ?? []).filter((report) => {
      if (!normalized) return true;
      return [
        report.reportNumber,
        incidentTypeLabels[report.type as IncidentType],
        report.recordedByName,
        report.students.map((student) => student.fullName).join(' '),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(normalized);
    });
  }, [incidents.data, query]);
  const studentOptions = useMemo<BehaviourStudentOption[]>(
    () =>
      (students.data ?? []).map((student) => ({
        id: student.id,
        label: student.fullName,
        description: student.yearGroup,
      })),
    [students.data],
  );
  const staffOptions = useMemo<BehaviourStudentOption[]>(
    () =>
      (staff.data ?? []).map((user) => ({
        id: user.id,
        label: user.fullName,
        description: user.role,
      })),
    [staff.data],
  );
  const selected = selectedId ? (rows.find((report) => report.id === selectedId) ?? null) : null;
  const parentVisibilityAllowed = parentVisibilityRoles.has(profile.data?.role ?? '');
  const savePending = createDraft.isPending || updateDraft.isPending;
  const stats = {
    escalated: (incidents.data ?? []).filter((report) => report.status === 'Escalated').length,
    open: (incidents.data ?? []).filter((report) => report.status !== 'SignedOff').length,
    parentViewable: (incidents.data ?? []).filter((report) =>
      report.parentCopies.some((copy) => copy.status === 'Shared'),
    ).length,
    signedOff: (incidents.data ?? []).filter((report) => report.status === 'SignedOff').length,
  };
  const columns: DataTableColumn<StaffIncident>[] = [
    {
      id: 'type',
      header: 'Incident type',
      render: (report) => (
        <span className="incident-table-title">
          {incidentTypeLabels[report.type as IncidentType]}
        </span>
      ),
    },
    {
      id: 'children',
      header: 'Child / children involved',
      render: (report) => report.students.map((student) => student.fullName).join(', '),
    },
    {
      id: 'status',
      header: 'Status',
      render: (report) => <IncidentStatusBadge status={report.status} />,
    },
    {
      id: 'parentView',
      header: 'Parent view',
      render: (report) =>
        report.parentCopies.some((copy) => copy.status === 'Shared') ? (
          <Badge tone="green">On</Badge>
        ) : (
          <Badge tone="grey">Off</Badge>
        ),
    },
    {
      id: 'updated',
      header: 'Updated',
      render: (report) => formatIncidentDate(report.updatedAt),
    },
  ];

  function startNewDraft() {
    setForm(defaultIncidentForm);
    setEditingReportId(null);
    setSelectedId(null);
    setMode('form');
  }

  function startEditDraft(report: StaffIncident) {
    setForm(incidentFormFromReport(report));
    setEditingReportId(report.id);
    setSelectedId(report.id);
    setMode('form');
  }

  function cancelForm() {
    setForm(defaultIncidentForm);
    setEditingReportId(null);
    setMode('dashboard');
  }

  function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = incidentFormInput(form);
    if (editingReportId) {
      updateDraft.mutate({ ...input, reportId: editingReportId });
      return;
    }
    createDraft.mutate(input);
  }

  if (mode === 'form') {
    return (
      <section className="incident-page incident-page--form">
        <header className="incident-page__header incident-page__header--form">
          <div>
            <p>{formatIncidentDate(new Date())}</p>
            <h1>{editingReportId ? 'Edit Incident Report' : 'New Incident Report'}</h1>
            <span>
              Record factual details, reportability checks, sign-off, and parent PDF visibility.
            </span>
          </div>
          <div className="incident-page__actions">
            <Button
              onClick={() => {
                cancelForm();
              }}
              type="button"
              variant="secondary"
            >
              Cancel
            </Button>
            <Button form="incident-report-form" pending={savePending} type="submit">
              <Save aria-hidden="true" size={16} />
              {editingReportId ? 'Update draft' : 'Save draft'}
            </Button>
          </div>
        </header>
        <div className="incident-form-shell">
          <IncidentForm
            form={form}
            formId="incident-report-form"
            onChange={(patch) => {
              setForm((current) => ({ ...current, ...patch }));
            }}
            onSubmit={submitForm}
            staffError={staff.error?.message}
            staffLoading={staff.isLoading}
            staffOptions={staffOptions}
            studentError={students.error?.message}
            studentOptions={studentOptions}
            studentsLoading={students.isLoading}
          />
          <IncidentProgressRail
            form={form}
            onChange={(patch) => {
              setForm((current) => ({ ...current, ...patch }));
            }}
            parentVisibilityAllowed={parentVisibilityAllowed}
            pending={savePending}
          />
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="incident-page">
        <header className="incident-page__header">
          <div>
            <p>{formatIncidentDate(new Date())}</p>
            <h1>Incident Reports</h1>
            <span>Record, sign off, escalate, and share parent-viewable reports.</span>
          </div>
          <Button
            onClick={() => {
              startNewDraft();
            }}
            type="button"
          >
            <Plus aria-hidden="true" size={16} />
            New Incident
          </Button>
        </header>

        <div className="dashboard-grid incident-stat-grid">
          <StatCard
            accent="#8B1E2D"
            icon={<CircleAlert aria-hidden="true" size={28} />}
            label="Open"
            sub="Require attention"
            value={stats.open}
          />
          <StatCard
            accent="#166534"
            icon={<CheckCircle2 aria-hidden="true" size={28} />}
            label="Head sign-off"
            sub="Completed"
            value={stats.signedOff}
          />
          <StatCard
            accent="#92400E"
            icon={<AlertTriangle aria-hidden="true" size={28} />}
            label="Escalated"
            sub="With Pastor/Principal"
            value={stats.escalated}
          />
          <StatCard
            accent="#5B90C5"
            icon={<Users aria-hidden="true" size={28} />}
            label="Parent viewable"
            sub="Shared with parents"
            value={stats.parentViewable}
          />
        </div>

        <div
          className={`incident-layout${selected ? ' incident-layout--split' : ' incident-layout--full'}`}
        >
          <Panel body className="incident-list-panel">
            <div className="incident-toolbar">
              <label className="incident-search">
                <Search aria-hidden="true" size={16} />
                <TextInput
                  onChange={(event) => {
                    setQuery(event.target.value);
                  }}
                  placeholder="Search reports"
                  value={query}
                />
              </label>
            </div>
            <DataTable
              columns={columns}
              empty="No incident reports found."
              errorMessage={incidents.error?.message}
              getRowClassName={(report) =>
                report.id === selectedId ? 'incident-table-row is-selected' : 'incident-table-row'
              }
              getRowKey={(report) => report.id}
              loading={incidents.isLoading}
              onRowClick={(report) => {
                setSelectedId(report.id);
              }}
              rows={rows}
            />
          </Panel>
          {selected ? (
            <IncidentDetail
              canManageDraft={
                selected.status === 'Draft' && selected.recordedById === profile.data?.id
              }
              canOverrideParentVisibility={parentVisibilityAllowed}
              onClose={() => {
                setSelectedId(null);
              }}
              onDeleteDraft={setDeleteDraftReport}
              onEditDraft={startEditDraft}
              portal={portal}
              report={selected}
            />
          ) : null}
        </div>
      </section>
      <ConfirmationDialog
        confirmLabel="Delete draft"
        errorMessage={deleteDraft.error ? friendlyErrorMessage(deleteDraft.error) : undefined}
        onCancel={() => {
          if (!deleteDraft.isPending) setDeleteDraftReport(null);
        }}
        onConfirm={() => {
          if (deleteDraftReport) deleteDraft.mutate({ reportId: deleteDraftReport.id });
        }}
        open={deleteDraftReport !== null}
        pending={deleteDraft.isPending}
        title="Delete incident draft?"
      >
        <p>This removes the draft report before Head review and keeps an audit record.</p>
      </ConfirmationDialog>
    </>
  );
}

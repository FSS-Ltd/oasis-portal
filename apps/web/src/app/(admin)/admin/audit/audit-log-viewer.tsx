'use client';

import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { Clock3, Database, Filter, RotateCcw, ShieldCheck, UserRound } from 'lucide-react';
import { friendlyErrorMessage } from '@/lib/notifications';
import { api, type RouterOutputs } from '@/lib/trpc';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { SelectInput, TextInput } from '@/components/ui/field';

const ACTIONS = [
  'Create',
  'Update',
  'Delete',
  'PermissionDenied',
] as const;

type AuditActionFilter = (typeof ACTIONS)[number] | '';
type AuditFilters = {
  action: AuditActionFilter;
  entity: string;
  userId: string;
  from: string;
  to: string;
};
type AuditRow = RouterOutputs['audit']['list']['rows'][number];

const ENTITIES = [
  '',
  'Attendance',
  'AttendanceExport',
  'BehaviourEntry',
  'ChildNote',
  'PaceAdvancementApproval',
  'PaceRecord',
  'StaffAttendance',
  'Student',
  'StudentSubject',
  'User',
] as const;

function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatShortDate(value: string | Date) {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
  }).format(new Date(value));
}

function actionTone(action: AuditRow['action']): 'amber' | 'blue' | 'green' | 'red' {
  if (action === 'Create') return 'green';
  if (action === 'Update') return 'blue';
  if (action === 'Delete' || action === 'PermissionDenied') return 'red';
  return 'amber';
}

function labelForMetaKey(key: string): string {
  const labels: Record<string, string> = {
    count: 'Records',
    currentPaceNumber: 'Current PACE',
    date: 'Date',
    exportKind: 'Export',
    fields: 'Changed fields',
    from: 'From',
    invitationStatus: 'Invitation status',
    kind: 'Type',
    parentUserId: 'Parent',
    reason: 'Reason',
    role: 'Role',
    rowCount: 'Rows',
    source: 'Triggered by',
    status: 'Status',
    studentId: 'Student',
    subjectId: 'Subject',
    tags: 'Tags',
    to: 'To',
    type: 'Operation',
  };
  return (
    labels[key] ?? key.replace(/([A-Z])/gu, ' $1').replace(/^./u, (letter) => letter.toUpperCase())
  );
}

function valueForMeta(value: unknown): string {
  if (value === null || value === undefined) return 'None';
  if (Array.isArray(value)) return value.length > 0 ? value.map(valueForMeta).join(', ') : 'None';
  if (value instanceof Date) return formatDate(value);
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'symbol')
    return value.toString();
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  return 'None';
}

function formatSource(value: unknown): string {
  const source = valueForMeta(value);
  const labels: Record<string, string> = {
    'admin.listUsers': 'User list',
    'admin.searchParents': 'Parent search',
    'admin.searchGuardianAccounts': 'Guardian account search',
    'admin.updateUserProfile': 'Profile update',
    'admin.updateUserTags': 'Permission tag update',
    'attendance.exportStudentsCsv': 'Student attendance export',
    'attendance.exportStaffCsv': 'Staff attendance export',
    'attendance.forDate': 'Attendance register',
    'audit.list': 'Audit log',
    'behaviour.log': 'Behaviour input',
    'behaviour.logMany': 'Behaviour batch input',
    'childNotes.create': 'Note input',
    'childNotes.listForStudent': 'Student notes',
    'pace.deleteRecord': 'PACE delete',
    'pace.record': 'PACE input',
    'pace.updateRecord': 'PACE update',
    'profile.updateMe': 'Profile update',
    'registration.answerChildRegistrationPrompt': 'Child registration prompt',
    'registration.byStudent': 'Registration form read',
    'registration.submitInitial': 'Parent registration submit',
    'student.byId': 'Student record',
    'student.list': 'Student list',
  };
  return labels[source] ?? source;
}

function MetaDetails({ meta }: { meta: unknown }) {
  if (meta === null || meta === undefined) return <span className="muted">No extra details</span>;
  if (typeof meta !== 'object' || Array.isArray(meta)) {
    return <span>{valueForMeta(meta)}</span>;
  }

  const entries = Object.entries(meta);
  if (entries.length === 0) return <span className="muted">No extra details</span>;

  return (
    <dl className="audit-meta-list">
      {entries.map(([key, value]) => (
        <div key={key}>
          <dt>{labelForMetaKey(key)}</dt>
          <dd>{key === 'source' ? formatSource(value) : valueForMeta(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function AuditSummaryCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="audit-summary-card">
      <span aria-hidden="true">{icon}</span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

export function AuditLogViewer() {
  const [draft, setDraft] = useState<AuditFilters>({
    action: '',
    entity: '',
    userId: '',
    from: '',
    to: '',
  });
  const [filters, setFilters] = useState(draft);
  const [cursor, setCursor] = useState<string | undefined>(undefined);

  const queryInput = useMemo(() => {
    const input: {
      limit: number;
      cursor?: string;
      action?: Exclude<AuditActionFilter, ''>;
      entity?: string;
      userId?: string;
      from?: Date;
      to?: Date;
    } = { limit: 25 };
    if (cursor) input.cursor = cursor;
    if (filters.action) input.action = filters.action;
    if (filters.entity) input.entity = filters.entity;
    if (filters.userId.trim()) input.userId = filters.userId.trim();
    if (filters.from) input.from = new Date(`${filters.from}T00:00:00.000Z`);
    if (filters.to) input.to = new Date(`${filters.to}T23:59:59.999Z`);
    return input;
  }, [cursor, filters]);

  const auditQuery = api.audit.list.useQuery(queryInput, { retry: false });
  const rows = auditQuery.data?.rows ?? [];
  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const latestRow = rows[0];
  const columns: DataTableColumn<AuditRow>[] = [
    {
      id: 'date',
      header: 'Date',
      render: (row) => (
        <span className="audit-date">
          <strong>{formatShortDate(row.createdAt)}</strong>
          <span>{formatDate(row.createdAt).replace(`${formatShortDate(row.createdAt)}, `, '')}</span>
        </span>
      ),
    },
    {
      id: 'action',
      header: 'Action',
      render: (row) => <Badge tone={actionTone(row.action)}>{row.action}</Badge>,
    },
    {
      id: 'entity',
      header: 'Entity',
      render: (row) => (
        <span className="audit-entity">
          <strong>{row.entity}</strong>
          <span>{row.entityId ?? row.id}</span>
        </span>
      ),
    },
    {
      id: 'actor',
      header: 'Actor',
      render: (row) =>
        row.actor ? (
          <span className="audit-actor">
            <span aria-hidden="true" className="audit-actor__icon">
              <UserRound size={15} />
            </span>
            <span>
              <strong>{row.actor.fullName}</strong>
              <span>{row.actor.email}</span>
            </span>
          </span>
        ) : (
          <span className="audit-actor audit-actor--system">
            <span aria-hidden="true" className="audit-actor__icon">
              <Database size={15} />
            </span>
            <span>
              <strong>System</strong>
              <span>Automated event</span>
            </span>
          </span>
        ),
    },
    {
      id: 'metadata',
      header: 'Metadata',
      render: (row) => <MetaDetails meta={row.meta} />,
    },
  ];

  return (
    <section className="audit-page">
      <div className="audit-summary-grid" aria-label="Audit log summary">
        <AuditSummaryCard
          icon={<ShieldCheck size={20} />}
          label="Loaded rows"
          value={auditQuery.isLoading ? '...' : String(rows.length)}
        />
        <AuditSummaryCard
          icon={<Clock3 size={20} />}
          label="Latest event"
          value={latestRow ? formatShortDate(latestRow.createdAt) : 'None'}
        />
        <AuditSummaryCard
          icon={<Filter size={20} />}
          label="Active filters"
          value={String(activeFilterCount)}
        />
      </div>

      <form
        className="panel audit-filter-panel"
        onSubmit={(event) => {
          event.preventDefault();
          setCursor(undefined);
          setFilters(draft);
        }}
      >
        <div className="audit-filter-panel__header">
          <div>
            <h2>Filters</h2>
            <p>Operational rows for inspection review</p>
          </div>
          <div className="audit-filter-panel__actions">
            <Button type="submit" variant="secondary">
              <Filter aria-hidden="true" size={16} />
              Apply
            </Button>
            <Button
              onClick={() => {
                const empty: AuditFilters = { action: '', entity: '', userId: '', from: '', to: '' };
                setDraft(empty);
                setFilters(empty);
                setCursor(undefined);
              }}
              type="button"
              variant="ghost"
            >
              <RotateCcw aria-hidden="true" size={16} />
              Reset
            </Button>
          </div>
        </div>
        <div className="panel__body audit-filters">
          <label className="field">
            <span className="field__label">Action</span>
            <SelectInput
              onChange={(event) => {
                setDraft((value) => ({
                  ...value,
                  action: event.target.value as AuditActionFilter,
                }));
              }}
              value={draft.action}
            >
              {(['', ...ACTIONS] as const).map((action) => (
                <option key={action || 'all-actions'} value={action}>
                  {action || 'All actions'}
                </option>
              ))}
            </SelectInput>
          </label>
          <label className="field">
            <span className="field__label">Entity</span>
            <SelectInput
              onChange={(event) => {
                setDraft((value) => ({ ...value, entity: event.target.value }));
              }}
              value={draft.entity}
            >
              {ENTITIES.map((entity) => (
                <option key={entity || 'all-entities'} value={entity}>
                  {entity || 'All entities'}
                </option>
              ))}
            </SelectInput>
          </label>
          <label className="field">
            <span className="field__label">Actor</span>
            <TextInput
              onChange={(event) => {
                setDraft((value) => ({ ...value, userId: event.target.value }));
              }}
              placeholder="User ID"
              value={draft.userId}
            />
          </label>
          <label className="field">
            <span className="field__label">From</span>
            <TextInput
              onChange={(event) => {
                setDraft((value) => ({ ...value, from: event.target.value }));
              }}
              type="date"
              value={draft.from}
            />
          </label>
          <label className="field">
            <span className="field__label">To</span>
            <TextInput
              onChange={(event) => {
                setDraft((value) => ({ ...value, to: event.target.value }));
              }}
              type="date"
              value={draft.to}
            />
          </label>
        </div>
      </form>

      <div className="panel panel--scroll audit-table-panel">
        <DataTable
          columns={columns}
          empty={
            <EmptyState
              detail="Adjust the filters or try a different date range."
              title="No audit rows found"
            />
          }
          errorMessage={auditQuery.error ? friendlyErrorMessage(auditQuery.error) : undefined}
          getRowKey={(row) => row.id}
          loading={auditQuery.isLoading}
          loadingLabel="Loading audit log..."
          rows={rows}
          tableClassName="audit-table"
        />
      </div>

      <div className="audit-pagination">
        <Button
          disabled={!auditQuery.data?.nextCursor || auditQuery.isFetching}
          onClick={() => {
            setCursor(auditQuery.data?.nextCursor);
          }}
          type="button"
          variant="secondary"
        >
          Next page
        </Button>
        {cursor ? (
          <Button
            disabled={auditQuery.isFetching}
            onClick={() => {
              setCursor(undefined);
            }}
            type="button"
            variant="ghost"
          >
            First page
          </Button>
        ) : null}
      </div>
    </section>
  );
}

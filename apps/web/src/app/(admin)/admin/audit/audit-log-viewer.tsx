'use client';

import { useMemo, useState } from 'react';
import { Filter, RotateCcw } from 'lucide-react';
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
  'DecryptSensitive',
  'DecryptPii',
  'ReadSensitive',
  'Login',
  'Login2FA',
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
  'Student',
  'StudentSubject',
  'Guardian',
  'Invitation',
  'ParentRegistration',
  'User',
] as const;

function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
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
    'admin.updateUserTags': 'Permission tag update',
    'attendance.exportStudentsCsv': 'Student attendance export',
    'attendance.forDate': 'Attendance register',
    'audit.list': 'Audit log',
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
  const columns: DataTableColumn<AuditRow>[] = [
    { id: 'date', header: 'Date', render: (row) => formatDate(row.createdAt) },
    {
      id: 'action',
      header: 'Action',
      render: (row) => <Badge>{row.action}</Badge>,
    },
    {
      id: 'entity',
      header: 'Entity',
      render: (row) => (
        <span className="student-row__text">
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
          <span className="student-row__text">
            <strong>{row.actor.fullName}</strong>
            <span>{row.actor.email}</span>
          </span>
        ) : (
          <span className="muted">System</span>
        ),
    },
    {
      id: 'metadata',
      header: 'Metadata',
      render: (row) => <MetaDetails meta={row.meta} />,
    },
  ];

  return (
    <section className="grid">
      <form
        className="panel"
        onSubmit={(event) => {
          event.preventDefault();
          setCursor(undefined);
          setFilters(draft);
        }}
      >
        <div className="panel__body audit-filters">
          <SelectInput
            aria-label="Filter by action"
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
          <SelectInput
            aria-label="Filter by entity"
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
          <TextInput
            aria-label="Filter by user id"
            onChange={(event) => {
              setDraft((value) => ({ ...value, userId: event.target.value }));
            }}
            placeholder="Actor user id"
            value={draft.userId}
          />
          <TextInput
            aria-label="From date"
            onChange={(event) => {
              setDraft((value) => ({ ...value, from: event.target.value }));
            }}
            type="date"
            value={draft.from}
          />
          <TextInput
            aria-label="To date"
            onChange={(event) => {
              setDraft((value) => ({ ...value, to: event.target.value }));
            }}
            type="date"
            value={draft.to}
          />
          <Button type="submit" variant="secondary">
            <Filter aria-hidden="true" size={16} />
            Filter
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
      </form>

      <div className="panel panel--scroll">
        <DataTable
          columns={columns}
          empty={
            <EmptyState
              detail="Adjust the filters or try a different date range."
              title="No audit rows found"
            />
          }
          errorMessage={auditQuery.error?.message}
          getRowKey={(row) => row.id}
          loading={auditQuery.isLoading}
          loadingLabel="Loading audit log..."
          rows={rows}
          tableClassName="audit-table"
        />
      </div>

      <div className="toolbar">
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

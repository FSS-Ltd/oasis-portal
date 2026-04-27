'use client';

import { useMemo, useState } from 'react';
import { Filter, RotateCcw } from 'lucide-react';
import { api } from '@/lib/trpc';
import { MotionList, MotionTableRow } from '@/components/admin/motion';
import { Button } from '@/components/ui/button';
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

const ENTITIES = ['', 'Student', 'StudentSubject', 'Guardian', 'Invitation', 'User'] as const;

function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function compactMeta(meta: unknown) {
  if (meta === null || meta === undefined) return 'None';
  if (typeof meta !== 'object') return String(meta);
  const json = JSON.stringify(meta);
  return json.length > 96 ? `${json.slice(0, 93)}...` : json;
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
            onChange={(event) =>
              setDraft((value) => ({
                ...value,
                action: event.target.value as AuditActionFilter,
              }))
            }
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
            onChange={(event) => setDraft((value) => ({ ...value, entity: event.target.value }))}
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
            onChange={(event) => setDraft((value) => ({ ...value, userId: event.target.value }))}
            placeholder="Actor user id"
            value={draft.userId}
          />
          <TextInput
            aria-label="From date"
            onChange={(event) => setDraft((value) => ({ ...value, from: event.target.value }))}
            type="date"
            value={draft.from}
          />
          <TextInput
            aria-label="To date"
            onChange={(event) => setDraft((value) => ({ ...value, to: event.target.value }))}
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
        {auditQuery.isLoading ? (
          <div className="empty-state">Loading audit log...</div>
        ) : auditQuery.error ? (
          <div className="empty-state status--error">{auditQuery.error.message}</div>
        ) : rows.length === 0 ? (
          <div className="empty-state">
            <strong>No audit rows found</strong>
            <span>Adjust the filters or run an onboarding action first.</span>
          </div>
        ) : (
          <MotionList>
            <table className="table audit-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Actor</th>
                  <th>Metadata</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <MotionTableRow key={row.id}>
                    <td>{formatDate(row.createdAt)}</td>
                    <td>
                      <span className="badge">{row.action}</span>
                    </td>
                    <td>
                      <span className="student-row__text">
                        <strong>{row.entity}</strong>
                        <span>{row.entityId ?? row.id}</span>
                      </span>
                    </td>
                    <td>
                      {row.actor ? (
                        <span className="student-row__text">
                          <strong>{row.actor.fullName ?? 'Unknown user'}</strong>
                          <span>{row.actor.email ?? row.actor.id}</span>
                        </span>
                      ) : (
                        <span className="muted">System</span>
                      )}
                    </td>
                    <td>
                      <code className="audit-meta">{compactMeta(row.meta)}</code>
                    </td>
                  </MotionTableRow>
                ))}
              </tbody>
            </table>
          </MotionList>
        )}
      </div>

      <div className="toolbar">
        <Button
          disabled={!auditQuery.data?.nextCursor || auditQuery.isFetching}
          onClick={() => setCursor(auditQuery.data?.nextCursor)}
          type="button"
          variant="secondary"
        >
          Next page
        </Button>
        {cursor ? (
          <Button
            disabled={auditQuery.isFetching}
            onClick={() => setCursor(undefined)}
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

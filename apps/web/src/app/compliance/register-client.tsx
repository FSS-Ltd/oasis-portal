'use client';

import { useDeferredValue, useState } from 'react';
import { Pencil, Search } from 'lucide-react';
import type { RouterOutputs } from '@/lib/trpc';
import { api } from '@/lib/trpc';
import { friendlyErrorMessage } from '@/lib/notifications';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { UpdateComplianceModal } from './update-compliance-modal';

type RegisterRow = RouterOutputs['compliance']['register']['rows'][number];

function displayDate(value: string | null): string {
  if (!value) return 'Not recorded';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
}

function statusBadge(status: RegisterRow['dbsStatus']) {
  switch (status) {
    case 'RecordedCurrent':
      return <Badge tone="green">Recorded current</Badge>;
    case 'NoLongerCurrent':
      return <Badge tone="amber">No longer current</Badge>;
    default:
      return <Badge tone="grey">Awaiting certificate</Badge>;
  }
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="compliance-detail">
      <dt>{label}</dt>
      <dd>{value || 'Not recorded'}</dd>
    </div>
  );
}

function RegisterRowView({ row }: { row: RegisterRow }) {
  return (
    <>
      <tr>
        <td className="compliance-register__person">
          <strong>{row.fullName}</strong>
          <span>
            {row.role} · {row.active ? 'Active' : 'Inactive'}
          </span>
        </td>
        <td>{statusBadge(row.dbsStatus)}</td>
        <td>
          {row.badges.firstAidTrained ? (
            <Badge tone="blue">Trained · {row.firstAidLevel}</Badge>
          ) : (
            <span className="muted">Not recorded</span>
          )}
        </td>
        <td>
          {row.badges.safeguardingTrained ? (
            <Badge tone="blue">Trained · {row.safeguardingLevel}</Badge>
          ) : (
            <span className="muted">Not recorded</span>
          )}
        </td>
      </tr>
      <tr className="compliance-register__detail-row">
        <td colSpan={4}>
          <details className="compliance-record-details">
            <summary>View details</summary>
            <dl>
              <Detail label="DBS certificate number" value={row.dbsCertificateNumber} />
              <Detail label="DBS completion date" value={displayDate(row.dbsCompletedAt)} />
              <Detail label="Application reference" value={row.dbsApplicationReference} />
              <Detail label="Date of birth" value={displayDate(row.dob)} />
              <Detail label="DBS issue date" value={displayDate(row.dbsIssueDate)} />
              <Detail label="Application type" value={row.dbsApplicationType} />
              <Detail
                label="DBS status"
                value={
                  row.dbsStatus === 'RecordedCurrent'
                    ? 'Recorded current'
                    : row.dbsStatus === 'NoLongerCurrent'
                      ? 'No longer current'
                      : 'Awaiting certificate'
                }
              />
              <Detail label="First aid completion" value={displayDate(row.firstAidCompletedAt)} />
              <Detail label="First aid level" value={row.firstAidLevel} />
              <Detail
                label="Safeguarding completion"
                value={displayDate(row.safeguardingCompletedAt)}
              />
              <Detail label="Safeguarding level" value={row.safeguardingLevel} />
            </dl>
          </details>
        </td>
      </tr>
    </>
  );
}

export function RegisterClient() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const deferredSearch = useDeferredValue(search.trim());
  const register = api.compliance.register.useQuery(
    { page, search: deferredSearch },
    { retry: false },
  );
  const people = api.compliance.peopleOptions.useQuery(undefined, {
    enabled: modalOpen,
    retry: false,
  });
  const totalPages = Math.max(
    1,
    Math.ceil((register.data?.total ?? 0) / (register.data?.pageSize ?? 25)),
  );

  return (
    <div className="compliance-page">
      <div className="page-header compliance-page__header">
        <div>
          <p>Safeguarding compliance</p>
          <h1>DBS & Training</h1>
          <p>
            Supervisor and parent records. DBS status is entered by your team; it is not an
            automatic status check.
          </p>
        </div>
        {register.data?.canEdit ? (
          <Button
            onClick={() => {
              setModalOpen(true);
            }}
            type="button"
          >
            <Pencil aria-hidden="true" size={16} />
            Update
          </Button>
        ) : null}
      </div>
      <div className="panel compliance-register">
        <div className="compliance-register__toolbar">
          <label className="compliance-register__search">
            <Search aria-hidden="true" size={17} />
            <span className="sr-only">Search supervisors and parents</span>
            <input
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search people"
              type="search"
              value={search}
            />
          </label>
          <span>{register.data ? `${String(register.data.total)} people` : 'Loading people'}</span>
        </div>
        {register.isLoading ? (
          <p className="compliance-feedback">Loading compliance records…</p>
        ) : null}
        {register.error ? (
          <p className="status--error compliance-feedback" role="alert">
            {friendlyErrorMessage(register.error)}
          </p>
        ) : null}
        {register.data && register.data.rows.length === 0 ? (
          <EmptyState title="No people found" detail="Try a different name." />
        ) : null}
        {register.data && register.data.rows.length > 0 ? (
          <div className="compliance-register__scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Person</th>
                  <th scope="col">DBS</th>
                  <th scope="col">First aid</th>
                  <th scope="col">Safeguarding</th>
                </tr>
              </thead>
              <tbody>
                {register.data.rows.map((row) => (
                  <RegisterRowView key={row.id} row={row} />
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {register.data && register.data.total > register.data.pageSize ? (
          <div className="compliance-register__pagination">
            <Button
              disabled={page === 1}
              onClick={() => {
                setPage((current) => current - 1);
              }}
              size="sm"
              type="button"
              variant="secondary"
            >
              Previous
            </Button>
            <span>
              Page {page} of {totalPages}
            </span>
            <Button
              disabled={page >= totalPages}
              onClick={() => {
                setPage((current) => current + 1);
              }}
              size="sm"
              type="button"
              variant="secondary"
            >
              Next
            </Button>
          </div>
        ) : null}
      </div>
      {modalOpen ? (
        <UpdateComplianceModal
          onClose={() => {
            setModalOpen(false);
          }}
          options={people.data ?? []}
          optionsError={people.error ? friendlyErrorMessage(people.error) : null}
          optionsLoading={people.isLoading}
        />
      ) : null}
    </div>
  );
}

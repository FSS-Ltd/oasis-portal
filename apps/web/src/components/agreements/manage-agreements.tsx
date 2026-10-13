'use client';

import { useDeferredValue, useState } from 'react';
import { ROLES, type Role } from '@oasis/domain';
import { api } from '@/lib/trpc';
import { friendlyErrorMessage } from '@/lib/notifications';
import { HeadUpload } from './head-upload';
import { MyAgreements } from './my-agreements';
import { RegisterEntry } from './signing-register-entry';

export function ManageAgreements() {
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState('');
  const [role, setRole] = useState<Role | ''>('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const register = api.userAgreement.register.useQuery(
    {
      page,
      search: useDeferredValue(search),
      ...(kind ? { kind: kind as 'UserAgreement' | 'SafeguardingDataAnnex' } : {}),
      ...(role ? { role } : {}),
      ...(status ? { status: status as 'NeedsSigning' | 'Signed' | 'Superseded' } : {}),
    },
    { retry: false },
  );
  const utils = api.useUtils();
  function refresh() {
    void register.refetch();
    void utils.userAgreement.mine.invalidate();
    void utils.userAgreement.pendingCount.invalidate();
  }
  return (
    <div className="agreement-page agreement-manager">
      <div className="page-header">
        <div>
          <p>Compliance</p>
          <h1>User Agreements</h1>
          <p>Assign forms and review signed records.</p>
        </div>
      </div>
      <HeadUpload onComplete={refresh} />
      <section className="panel agreement-register">
        <h2>Signing register</h2>
        <div className="agreement-register__filters">
          <label>
            Search people
            <input
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              type="search"
              value={search}
            />
          </label>
          <label>
            Form type
            <select
              onChange={(event) => {
                setKind(event.target.value);
                setPage(1);
              }}
              value={kind}
            >
              <option value="">All</option>
              <option value="UserAgreement">User Agreement</option>
              <option value="SafeguardingDataAnnex">Safeguarding & Data Annex</option>
            </select>
          </label>
          <label>
            Role
            <select
              onChange={(event) => {
                setRole(event.target.value as Role | '');
                setPage(1);
              }}
              value={role}
            >
              <option value="">All</option>
              {ROLES.filter((value) => value !== 'Student').map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
              value={status}
            >
              <option value="">All</option>
              <option value="NeedsSigning">Needs signing</option>
              <option value="Signed">Signed</option>
              <option value="Superseded">Superseded</option>
            </select>
          </label>
        </div>
        {register.isLoading ? <p role="status">Loading signing register…</p> : null}
        {register.error ? <p role="alert">{friendlyErrorMessage(register.error)}</p> : null}
        {register.data && register.data.rows.length === 0 ? <p>No agreements found.</p> : null}
        {register.data && register.data.rows.length > 0 ? (
          <div className="agreement-register__scroll">
            <table>
              <thead>
                <tr>
                  <th>Person</th>
                  <th>Type</th>
                  <th>Form</th>
                  <th>Status</th>
                  <th>Method</th>
                  <th>Signed</th>
                  <th>Signature ID</th>
                  <th>Email</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {register.data.rows.map((row) => (
                  <RegisterEntry key={row.id} onChange={refresh} row={row} />
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {register.data ? (
          <div className="agreement-register__paging">
            <span>{register.data.total} records</span>
            <button
              disabled={page <= 1}
              onClick={() => {
                setPage(page - 1);
              }}
              type="button"
            >
              Previous
            </button>
            <span>Page {page}</span>
            <button
              disabled={page * register.data.pageSize >= register.data.total}
              onClick={() => {
                setPage(page + 1);
              }}
              type="button"
            >
              Next
            </button>
          </div>
        ) : null}
      </section>
      <MyAgreements heading="My own agreements" />
    </div>
  );
}

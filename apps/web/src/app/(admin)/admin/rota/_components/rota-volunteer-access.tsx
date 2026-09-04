'use client';

import { useState } from 'react';
import { friendlyErrorMessage, showErrorToast, showSuccessToast } from '@/lib/notifications';
import { roleLabel } from '@/lib/profile-display';
import { api } from '@/lib/trpc';
import { childLabel } from '../../staff/_components/people-profile-model';
import {
  isPendingVolunteerRow,
  updatePendingVolunteerRow,
  type PendingVolunteerRows,
} from './rota-volunteer-access-pending';

export function RotaVolunteerAccess() {
  const utils = api.useUtils();
  const [pendingRows, setPendingRows] = useState<PendingVolunteerRows>(() => new Map());
  const accessQuery = api.rota.listStaffParentVolunteerAccess.useQuery(undefined, { retry: false });
  const updateAccess = api.rota.setStaffParentVolunteerAccess.useMutation({
    onSuccess() {
      showSuccessToast('Volunteer access updated.');
      void utils.rota.listStaffParentVolunteerAccess.invalidate().catch(() => undefined);
    },
    onError(error) {
      showErrorToast(error, 'Volunteer access could not be updated.');
    },
    onSettled(_data, _error, variables) {
      setPendingRows((current) => updatePendingVolunteerRow(current, variables.userId, -1));
    },
  });
  const staff = accessQuery.data ?? [];

  return (
    <section aria-labelledby="rota-volunteer-access-title" className="panel rota-volunteer-access">
      <div className="panel__body">
        <div className="section-title">
          <div>
            <p className="staff-rota-eyebrow">Parent volunteering</p>
            <h2 id="rota-volunteer-access-title">Volunteer access</h2>
          </div>
          <span className="badge">{staff.length} eligible</span>
        </div>
        <p className="muted">
          Allow eligible staff who are also parents to book parent-volunteer rota slots.
        </p>
        {accessQuery.isLoading ? <div className="empty-state">Loading volunteer access...</div> : null}
        {accessQuery.error ? (
          <p className="status--error" role="alert">
            {friendlyErrorMessage(accessQuery.error)}
          </p>
        ) : null}
        {!accessQuery.isLoading && !accessQuery.error && staff.length === 0 ? (
          <div className="empty-state">No eligible staff parents found</div>
        ) : null}
        {!accessQuery.isLoading && !accessQuery.error && staff.length > 0 ? (
          <div className="rota-volunteer-access-list">
            {staff.map((member) => (
              <label className="rota-volunteer-access-row" key={member.id}>
                <span>
                  <strong>{member.fullName}</strong>
                  <small>
                    {roleLabel(member.role)} · {childLabel(member.childCount)}
                  </small>
                </span>
                <input
                  aria-label={`Parent volunteer access for ${member.fullName}`}
                  checked={member.enabled}
                  className="switch-input"
                  disabled={isPendingVolunteerRow(pendingRows, member.id)}
                  onChange={(event) => {
                    setPendingRows((current) => updatePendingVolunteerRow(current, member.id, 1));
                    updateAccess.mutate({ userId: member.id, enabled: event.target.checked });
                  }}
                  type="checkbox"
                />
              </label>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

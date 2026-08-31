'use client';

import { ShieldCheck } from 'lucide-react';
import { friendlyErrorMessage, showErrorToast, showSuccessToast } from '@/lib/notifications';
import { roleLabel } from '@/lib/profile-display';
import { api } from '@/lib/trpc';

export function LunchAndClubsExemptionsPanel() {
  const utils = api.useUtils();
  const exemptionsQuery = api.rota.listLunchAndClubsVolunteerExemptions.useQuery(undefined, {
    retry: false,
  });
  const updateExemption = api.rota.setLunchAndClubsVolunteerExemption.useMutation();

  async function setExemption(staffUserId: string, exempt: boolean): Promise<void> {
    try {
      await updateExemption.mutateAsync({ staffUserId, exempt });
      showSuccessToast(exempt ? 'Staff member marked exempt.' : 'Staff member returned to rota.');
      await utils.rota.listLunchAndClubsVolunteerExemptions.invalidate();
    } catch (error) {
      showErrorToast(error, 'Volunteer exemption could not be updated.');
    }
  }

  return (
    <section className="panel panel__body lunch-and-clubs-exemptions">
      <div className="section-title">
        <div>
          <p className="muted">Lunch + Clubs</p>
          <h2>Staff exemptions</h2>
          <p className="muted">
            Exempt staff who should not be included in the Lunch + Clubs volunteer requirement.
          </p>
        </div>
        <ShieldCheck aria-hidden="true" size={20} />
      </div>
      {exemptionsQuery.isLoading ? <div className="empty-state">Loading staff...</div> : null}
      {exemptionsQuery.error ? (
        <p className="status--error">{friendlyErrorMessage(exemptionsQuery.error)}</p>
      ) : null}
      <div className="lunch-and-clubs-exemptions__list">
        {(exemptionsQuery.data ?? []).map((staff) => {
          const pending =
            updateExemption.isPending && updateExemption.variables.staffUserId === staff.id;
          return (
            <label className="lunch-and-clubs-exemptions__row" key={staff.id}>
              <span>
                <strong>{staff.fullName}</strong>
                <small>{roleLabel(staff.role)}</small>
              </span>
              <input
                checked={staff.lunchAndClubsVolunteerExempt}
                disabled={pending}
                onChange={(event) => {
                  void setExemption(staff.id, event.target.checked);
                }}
                type="checkbox"
              />
              <em>Exempt</em>
            </label>
          );
        })}
      </div>
    </section>
  );
}

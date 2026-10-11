'use client';

import { api } from '@/lib/trpc';
import { friendlyErrorMessage } from '@/lib/notifications';
import { EmptyState } from '@/components/ui/empty-state';

export function MedTabClient() {
  const medTab = api.compliance.medTab.useQuery(undefined, { retry: false });
  return (
    <div className="compliance-page">
      <div className="page-header">
        <div>
          <p>Safeguarding compliance</p>
          <h1>MedTab</h1>
          <p>A quick look at allergies and medical needs recorded in student registration.</p>
        </div>
      </div>
      <div className="panel compliance-medtab">
        {medTab.isLoading ? (
          <p className="compliance-feedback">Loading medical information…</p>
        ) : null}
        {medTab.error ? (
          <p className="status--error compliance-feedback" role="alert">
            {friendlyErrorMessage(medTab.error)}
          </p>
        ) : null}
        {medTab.data?.length === 0 ? (
          <EmptyState
            title="No recorded needs found"
            detail="Only active students with information entered during registration appear here."
          />
        ) : null}
        {medTab.data && medTab.data.length > 0 ? (
          <div className="compliance-register__scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Student</th>
                  <th scope="col">Year group</th>
                  <th scope="col">Allergies</th>
                  <th scope="col">Medical conditions</th>
                  <th scope="col">Medication at centre</th>
                </tr>
              </thead>
              <tbody>
                {medTab.data.map((row) => (
                  <tr key={row.studentId}>
                    <th scope="row">{row.fullName}</th>
                    <td>{row.yearGroup}</td>
                    <td>{row.allergies ?? <span className="muted">Not recorded</span>}</td>
                    <td>{row.medicalConditions ?? <span className="muted">Not recorded</span>}</td>
                    <td>{row.medicationAtCentre ?? <span className="muted">Not recorded</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}

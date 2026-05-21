'use client';

import { useEffect, useMemo, useState } from 'react';
import { displaySchoolYearLabel } from '@oasis/domain';
import { CheckCircle2, UserRound, XCircle } from 'lucide-react';
import { friendlyErrorMessage, showErrorToast, showSuccessToast } from '@/lib/notifications';
import { api, type RouterOutputs } from '@/lib/trpc';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Field, TextInput } from '@/components/ui/field';
import type { ManagedClub } from './club-schedule-utils';

type StudentCandidate = RouterOutputs['club']['studentCandidates'][number];
type LeadCandidate = RouterOutputs['club']['leadCandidates'][number];

function matchesSearch(
  candidate: Pick<StudentCandidate, 'fullName' | 'yearGroup'>,
  search: string,
) {
  const query = search.trim().toLowerCase();
  if (!query) return true;
  return (
    candidate.fullName.toLowerCase().includes(query) ||
    displaySchoolYearLabel(candidate.yearGroup).toLowerCase().includes(query)
  );
}

export function StudentAssignmentPanel({ club }: { club: ManagedClub }) {
  const utils = api.useUtils();
  const [search, setSearch] = useState('');
  const [pendingStudentId, setPendingStudentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const candidatesQuery = api.club.studentCandidates.useQuery(
    { clubId: club.id },
    { retry: false },
  );
  const signUp = api.club.signUp.useMutation();
  const withdraw = api.club.withdraw.useMutation();
  const candidates = useMemo(
    () => candidatesQuery.data?.filter((candidate) => matchesSearch(candidate, search)) ?? [],
    [candidatesQuery.data, search],
  );

  async function refreshAssignments() {
    await Promise.all([
      utils.club.studentCandidates.invalidate({ clubId: club.id }),
      utils.club.roster.invalidate({ clubId: club.id }),
      utils.club.list.invalidate(),
      utils.club.managementList.invalidate(),
    ]);
  }

  async function assignStudent(candidate: StudentCandidate) {
    setError(null);
    setPendingStudentId(candidate.id);
    try {
      await signUp.mutateAsync({ clubId: club.id, studentId: candidate.id });
      showSuccessToast(`${candidate.fullName} assigned to ${club.name}.`);
      await refreshAssignments();
    } catch (err) {
      setError(friendlyErrorMessage(err, 'Student assignment failed.'));
      showErrorToast(err, 'Student assignment failed.');
    } finally {
      setPendingStudentId(null);
    }
  }

  async function removeStudent(candidate: StudentCandidate) {
    setError(null);
    setPendingStudentId(candidate.id);
    try {
      await withdraw.mutateAsync({ clubId: club.id, studentId: candidate.id });
      showSuccessToast(`${candidate.fullName} removed from ${club.name}.`);
      await refreshAssignments();
    } catch (err) {
      setError(friendlyErrorMessage(err, 'Student removal failed.'));
      showErrorToast(err, 'Student removal failed.');
    } finally {
      setPendingStudentId(null);
    }
  }

  return (
    <section className="club-modal-section" aria-labelledby="club-student-assignment-title">
      <div className="section-title">
        <div>
          <p className="muted">Student assignments</p>
          <h3 id="club-student-assignment-title">Assign Children</h3>
        </div>
        <Badge tone="blue">{String(candidatesQuery.data?.length ?? 0)} active students</Badge>
      </div>
      <Field label="Search students">
        <TextInput
          onChange={(event) => {
            setSearch(event.target.value);
          }}
          placeholder="Search by name or year"
          value={search}
        />
      </Field>

      {candidatesQuery.isLoading ? <div className="empty-state">Loading students...</div> : null}
      {candidatesQuery.error ? (
        <p className="status--error">{friendlyErrorMessage(candidatesQuery.error)}</p>
      ) : null}
      {!candidatesQuery.isLoading && candidates.length === 0 ? (
        <EmptyState detail="No active students match this search." title="No students found" />
      ) : null}

      <div className="club-assignment-list">
        {candidates.map((candidate) => {
          const pending = pendingStudentId === candidate.id;
          return (
            <article className="club-assignment-row" key={candidate.id}>
              <div className="student-row">
                <Avatar className="student-row__avatar" name={candidate.fullName} />
                <span className="student-row__text">
                  <strong>{candidate.fullName}</strong>
                  <span>{displaySchoolYearLabel(candidate.yearGroup)}</span>
                </span>
              </div>
              <Badge tone={candidate.signedUp ? 'green' : 'grey'}>
                {candidate.signedUp ? 'Assigned' : 'Not assigned'}
              </Badge>
              {candidate.signedUp ? (
                <Button
                  onClick={() => {
                    void removeStudent(candidate);
                  }}
                  pending={pending && withdraw.isPending}
                  size="sm"
                  type="button"
                  variant="danger"
                >
                  <XCircle aria-hidden="true" size={14} />
                  Remove
                </Button>
              ) : (
                <Button
                  className="club-assignment-button--assign"
                  disabled={!club.active}
                  onClick={() => {
                    void assignStudent(candidate);
                  }}
                  pending={pending && signUp.isPending}
                  size="sm"
                  type="button"
                >
                  <CheckCircle2 aria-hidden="true" size={14} />
                  Assign
                </Button>
              )}
            </article>
          );
        })}
      </div>
      {error ? <p className="status--error">{error}</p> : null}
    </section>
  );
}

export function LeadAssignmentPanel({ club }: { club: ManagedClub }) {
  const utils = api.useUtils();
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(() => new Set());
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const candidatesQuery = api.club.leadCandidates.useQuery({ clubId: club.id }, { retry: false });
  const setAssignments = api.club.setLeadAssignments.useMutation();
  const candidates = candidatesQuery.data ?? [];

  useEffect(() => {
    if (!candidatesQuery.data) return;
    setSelectedUserIds(
      new Set(
        candidatesQuery.data
          .filter((candidate) => candidate.selected)
          .map((candidate) => candidate.id),
      ),
    );
  }, [candidatesQuery.data]);

  async function refreshLeads() {
    await Promise.all([
      utils.club.leadCandidates.invalidate({ clubId: club.id }),
      utils.club.managementList.invalidate(),
    ]);
  }

  async function updateLead(candidate: LeadCandidate, selected: boolean) {
    setError(null);
    setPendingUserId(candidate.id);

    const next = new Set(selectedUserIds);
    if (selected) {
      next.add(candidate.id);
    } else {
      next.delete(candidate.id);
    }

    try {
      await setAssignments.mutateAsync({
        clubId: club.id,
        userIds: [...next],
      });
      setSelectedUserIds(next);
      showSuccessToast(
        selected
          ? `${candidate.fullName} assigned to ${club.name}.`
          : `${candidate.fullName} removed from ${club.name}.`,
      );
      await refreshLeads();
    } catch (err) {
      setError(friendlyErrorMessage(err, 'Club lead assignment failed.'));
      showErrorToast(err, 'Club lead assignment failed.');
    } finally {
      setPendingUserId(null);
    }
  }

  function leadAssignmentLabel(candidate: LeadCandidate): string | null {
    if (candidate.assignedClubNames.length === 0) return null;
    const [firstClub, ...otherClubs] = candidate.assignedClubNames;
    if (!firstClub) return null;
    if (otherClubs.length === 0) return `Already leads ${firstClub}`;
    return `Already leads ${firstClub} + ${String(otherClubs.length)} more`;
  }

  const noLeadAssigned = !candidatesQuery.isLoading && selectedUserIds.size === 0;

  return (
    <section className="club-lead-assignment-panel" aria-labelledby="club-lead-assignment-title">
      {noLeadAssigned ? (
        <div className="club-lead-empty-banner">
          <span className="club-lead-empty-banner__icon">
            <UserRound aria-hidden="true" size={24} />
          </span>
          <span>
            <strong>This club has no lead</strong>
            <small>
              Assign a lead to unlock attendance marking, behaviour entries and parent notices for{' '}
              {club.name}.
            </small>
          </span>
        </div>
      ) : null}

      <div className="club-lead-assignment-panel__header">
        <h3 id="club-lead-assignment-title">
          Available leads &amp; candidates · {String(candidates.length)}
        </h3>
        {selectedUserIds.size > 0 ? (
          <Badge tone="green">{String(selectedUserIds.size)} assigned</Badge>
        ) : null}
      </div>

      {candidatesQuery.isLoading ? <div className="empty-state">Loading club leads...</div> : null}
      {candidatesQuery.error ? (
        <p className="status--error">{friendlyErrorMessage(candidatesQuery.error)}</p>
      ) : null}
      {!candidatesQuery.isLoading && candidates.length === 0 ? (
        <EmptyState
          detail="Create active Clubs Lead users before assigning leads."
          title="No club leads"
        />
      ) : null}

      <div className="club-lead-candidate-grid">
        {candidates.map((candidate) => {
          const selected = selectedUserIds.has(candidate.id);
          const pending = pendingUserId === candidate.id && setAssignments.isPending;
          const assignmentLabel = leadAssignmentLabel(candidate);

          return (
            <article
              className={
                selected ? 'club-lead-candidate-card is-selected' : 'club-lead-candidate-card'
              }
              key={candidate.id}
            >
              <div className="club-lead-candidate-card__identity">
                <Avatar className="club-lead-candidate-card__avatar" name={candidate.fullName} />
                <span>
                  <strong>{candidate.fullName}</strong>
                  <small>{candidate.email}</small>
                </span>
                <Badge tone={selected ? 'green' : 'amber'}>
                  {selected ? 'Assigned' : 'Candidate'}
                </Badge>
              </div>

              {assignmentLabel ? (
                <div className="club-lead-candidate-card__meta">{assignmentLabel}</div>
              ) : (
                <div className="club-lead-candidate-card__meta is-cleared">Available for clubs</div>
              )}

              {selected ? (
                <Button
                  disabled={!club.active}
                  onClick={() => {
                    void updateLead(candidate, false);
                  }}
                  pending={pending}
                  size="sm"
                  type="button"
                  variant="danger"
                >
                  <XCircle aria-hidden="true" size={14} />
                  Remove from {club.name}
                </Button>
              ) : (
                <Button
                  className="club-lead-candidate-card__assign"
                  disabled={!club.active}
                  onClick={() => {
                    void updateLead(candidate, true);
                  }}
                  pending={pending}
                  size="sm"
                  type="button"
                >
                  Assign to {club.name}
                </Button>
              )}
            </article>
          );
        })}
      </div>

      {error ? <p className="status--error">{error}</p> : null}
      {setAssignments.error ? (
        <p className="status--error">{friendlyErrorMessage(setAssignments.error)}</p>
      ) : null}
    </section>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import { displaySchoolYearLabel } from '@oasis/domain';
import { CheckCircle2, Save, UserPlus, XCircle } from 'lucide-react';
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
  const [status, setStatus] = useState<string | null>(null);
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
    ]);
  }

  async function assignStudent(candidate: StudentCandidate) {
    setStatus(null);
    setError(null);
    setPendingStudentId(candidate.id);
    try {
      await signUp.mutateAsync({ clubId: club.id, studentId: candidate.id });
      setStatus(`${candidate.fullName} assigned to ${club.name}.`);
      await refreshAssignments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Student assignment failed.');
    } finally {
      setPendingStudentId(null);
    }
  }

  async function removeStudent(candidate: StudentCandidate) {
    setStatus(null);
    setError(null);
    setPendingStudentId(candidate.id);
    try {
      await withdraw.mutateAsync({ clubId: club.id, studentId: candidate.id });
      setStatus(`${candidate.fullName} removed from ${club.name}.`);
      await refreshAssignments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Student removal failed.');
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
        <p className="status--error">{candidatesQuery.error.message}</p>
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
      {status ? <p className="status--success">{status}</p> : null}
      {error ? <p className="status--error">{error}</p> : null}
    </section>
  );
}

export function LeadAssignmentPanel({ club }: { club: ManagedClub }) {
  const utils = api.useUtils();
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(() => new Set());
  const [status, setStatus] = useState<string | null>(null);
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

  function toggleLead(candidate: LeadCandidate): void {
    setStatus(null);
    setSelectedUserIds((current) => {
      const next = new Set(current);
      if (next.has(candidate.id)) {
        next.delete(candidate.id);
      } else {
        next.add(candidate.id);
      }
      return next;
    });
  }

  async function saveLeads() {
    setStatus(null);
    await setAssignments.mutateAsync({
      clubId: club.id,
      userIds: [...selectedUserIds],
    });
    setStatus('Club lead assignments saved.');
    await utils.club.leadCandidates.invalidate({ clubId: club.id });
  }

  return (
    <section className="club-modal-section" aria-labelledby="club-lead-assignment-title">
      <div className="section-title">
        <div>
          <p className="muted">Club leads</p>
          <h3 id="club-lead-assignment-title">Assign Leads</h3>
        </div>
        <Badge tone="blue">{String(selectedUserIds.size)} selected</Badge>
      </div>

      {candidatesQuery.isLoading ? <div className="empty-state">Loading club leads...</div> : null}
      {candidatesQuery.error ? (
        <p className="status--error">{candidatesQuery.error.message}</p>
      ) : null}
      {!candidatesQuery.isLoading && candidates.length === 0 ? (
        <EmptyState
          detail="Create active Clubs Lead users before assigning leads."
          title="No club leads"
        />
      ) : null}

      <div className="club-assignment-list">
        {candidates.map((candidate) => {
          const selected = selectedUserIds.has(candidate.id);
          return (
            <button
              aria-pressed={selected}
              className={selected ? 'club-assignment-row is-selected' : 'club-assignment-row'}
              key={candidate.id}
              onClick={() => {
                toggleLead(candidate);
              }}
              type="button"
            >
              <div className="student-row">
                <Avatar className="student-row__avatar" name={candidate.fullName} />
                <span className="student-row__text">
                  <strong>{candidate.fullName}</strong>
                  <span>{candidate.email}</span>
                </span>
              </div>
              <Badge tone={selected ? 'green' : 'grey'}>
                {selected ? 'Assigned' : 'Available'}
              </Badge>
              <span className="club-assignment-row__action">
                <UserPlus aria-hidden="true" size={15} />
              </span>
            </button>
          );
        })}
      </div>

      <div className="clubs-form__actions">
        <Button
          disabled={!club.active || setAssignments.isPending}
          onClick={() => {
            void saveLeads();
          }}
          pending={setAssignments.isPending}
          type="button"
        >
          <Save aria-hidden="true" size={16} />
          Save Lead Assignments
        </Button>
      </div>
      {status ? <p className="status--success">{status}</p> : null}
      {setAssignments.error ? (
        <p className="status--error">{setAssignments.error.message}</p>
      ) : null}
    </section>
  );
}

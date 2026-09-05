'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Save, Trash2, UsersRound, X } from 'lucide-react';
import { friendlyErrorMessage, showErrorToast, showSuccessToast } from '@/lib/notifications';
import { roleLabel } from '@/lib/profile-display';
import { api, type RouterOutputs } from '@/lib/trpc';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, SelectInput, TextInput } from '@/components/ui/field';
import {
  addDays,
  asDateTime,
  dateFromKey,
  dateKey,
  dayLabels,
  formatDateLabel,
  formatTime,
  toTimeValue,
  type ManagedClub,
} from './club-schedule-utils';

type Candidate = RouterOutputs['club']['rotaCandidates'][number];
type ClubShift = RouterOutputs['club']['clubRotaSchedule'][number];

type ShiftForm = {
  id: string | null;
  participantUserId: string;
  date: string;
  startsAt: string;
  endsAt: string;
  notes: string;
};

function mondayFor(date: Date): Date {
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(date, diff);
}

function emptyShiftForm(_club: ManagedClub, date: string): ShiftForm {
  return {
    id: null,
    participantUserId: '',
    date,
    startsAt: '08:30',
    endsAt: '12:30',
    notes: '',
  };
}

function shiftToForm(shift: ClubShift): ShiftForm {
  return {
    id: shift.id,
    participantUserId: shift.participantUserId,
    date: shift.date,
    startsAt: formatTime(shift.startsAt),
    endsAt: formatTime(shift.endsAt),
    notes: shift.notes ?? '',
  };
}

function selectedCandidateIds(candidates: readonly Candidate[]): Set<string> {
  return new Set(
    candidates.filter((candidate) => candidate.selected).map((candidate) => candidate.id),
  );
}

function availabilityLabel(window: {
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
}): string {
  return `${dayLabels[window.dayOfWeek] ?? 'Day'} ${toTimeValue(window.startMinute)}-${toTimeValue(
    window.endMinute,
  )}`;
}

function CandidatePicker({
  candidates,
  onToggle,
  selectedUserIds,
}: {
  candidates: readonly Candidate[];
  onToggle: (userId: string) => void;
  selectedUserIds: ReadonlySet<string>;
}) {
  if (candidates.length === 0) {
    return <div className="empty-state">No active supervisors or linked parents found.</div>;
  }

  return (
    <div className="club-rota-candidates">
      {candidates.map((candidate) => (
        <label
          className={`club-rota-candidate${candidate.role === 'Parent' ? ' is-parent' : ' is-staff'}`}
          key={candidate.id}
        >
          <input
            checked={selectedUserIds.has(candidate.id)}
            onChange={() => {
              onToggle(candidate.id);
            }}
            type="checkbox"
          />
          <span>
            <strong>{candidate.fullName}</strong>
            <small>
              {roleLabel(candidate.role)} · {candidate.email}
            </small>
          </span>
        </label>
      ))}
    </div>
  );
}

export function ClubRotaPanel({ club }: { club: ManagedClub }) {
  const utils = api.useUtils();
  const initialWeek = useMemo(() => mondayFor(dateFromKey(dateKey(new Date()))), []);
  const [weekStart, setWeekStart] = useState(initialWeek);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [shiftForm, setShiftForm] = useState<ShiftForm>(() =>
    emptyShiftForm(club, dateKey(addDays(initialWeek, 1))),
  );
  const [selectedDates, setSelectedDates] = useState<string[]>([dateKey(addDays(initialWeek, 1))]);
  const [repeatScope, setRepeatScope] = useState<'week' | 'term'>('week');

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart],
  );
  const weekEnd = weekDays[6] ?? weekStart;
  const candidatesQuery = api.club.rotaCandidates.useQuery({ clubId: club.id }, { retry: false });
  const availabilityQuery = api.club.clubRotaAvailability.useQuery(
    { clubId: club.id },
    { retry: false },
  );
  const scheduleQuery = api.club.clubRotaSchedule.useQuery(
    { clubId: club.id, from: weekStart, to: weekEnd },
    { retry: false },
  );
  const operationalDatesQuery = api.calendar.operationalDates.useQuery(
    { dates: [...weekDays, dateFromKey(shiftForm.date)] },
    { retry: false },
  );
  const setParticipants = api.club.setRotaParticipants.useMutation();
  const createShiftBatch = api.club.createClubRotaShiftBatch.useMutation();
  const updateShift = api.club.updateClubRotaShift.useMutation();
  const deleteShift = api.club.deleteClubRotaShift.useMutation();

  const candidates = candidatesQuery.data ?? [];
  const selectedCandidates = candidates.filter((candidate) => selectedUserIds.has(candidate.id));
  const shifts = scheduleQuery.data ?? [];
  const availability = availabilityQuery.data ?? [];
  const selectedAvailability = availability.find((row) => row.id === shiftForm.participantUserId);
  const selectedDateStatus = operationalDatesQuery.data?.find(
    (status) => status.date === shiftForm.date,
  );
  const operatingDays = weekDays.filter((day) => {
    const status = operationalDatesQuery.data?.find((candidate) => candidate.date === dateKey(day));
    return day.getUTCDay() >= 2 && day.getUTCDay() <= 5 && status?.kind === 'operating';
  });
  const canSchedule = shiftForm.id
    ? selectedDateStatus?.kind === 'operating' || selectedDateStatus?.kind === 'fieldTrip'
    : selectedDates.length > 0;
  const mutationError =
    setParticipants.error ??
    createShiftBatch.error ??
    updateShift.error ??
    deleteShift.error;

  useEffect(() => {
    if (!candidatesQuery.data) return;
    setSelectedUserIds(selectedCandidateIds(candidatesQuery.data));
  }, [candidatesQuery.data]);

  async function refreshRota() {
    await Promise.all([
      utils.club.rotaCandidates.invalidate({ clubId: club.id }),
      utils.club.clubRotaAvailability.invalidate({ clubId: club.id }),
      utils.club.clubRotaSchedule.invalidate({ clubId: club.id, from: weekStart, to: weekEnd }),
    ]);
  }

  function toggleCandidate(userId: string) {
    setSelectedUserIds((current) => {
      const next = new Set(current);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  }

  async function saveParticipants() {
    try {
      await setParticipants.mutateAsync({ clubId: club.id, userIds: [...selectedUserIds] });
      showSuccessToast('Rota access saved.');
      await refreshRota();
    } catch (error) {
      showErrorToast(error, 'Rota access could not be saved.');
    }
  }

  async function saveShift() {
    const payload = {
      clubId: club.id,
      participantUserId: shiftForm.participantUserId,
      date: asDateTime(shiftForm.date, '00:00'),
      startsAt: asDateTime(shiftForm.date, shiftForm.startsAt),
      endsAt: asDateTime(shiftForm.date, shiftForm.endsAt),
      notes: shiftForm.notes || undefined,
    };
    try {
      if (shiftForm.id) {
        await updateShift.mutateAsync({ id: shiftForm.id, ...payload });
        showSuccessToast('Club cover updated.');
      } else {
        await createShiftBatch.mutateAsync({
          clubId: club.id,
          participantUserId: shiftForm.participantUserId,
          dates: selectedDates,
          startMinute: Number(shiftForm.startsAt.slice(0, 2)) * 60 + Number(shiftForm.startsAt.slice(3)),
          endMinute: Number(shiftForm.endsAt.slice(0, 2)) * 60 + Number(shiftForm.endsAt.slice(3)),
          repeatScope,
          notes: shiftForm.notes || undefined,
        });
        showSuccessToast('Club cover scheduled.');
      }
      setShiftForm(emptyShiftForm(club, shiftForm.date));
      setSelectedDates([shiftForm.date]);
      setRepeatScope('week');
      await refreshRota();
    } catch (error) {
      showErrorToast(error, 'Club cover could not be saved.');
    }
  }

  async function removeShift() {
    if (!shiftForm.id) return;
    try {
      await deleteShift.mutateAsync({ id: shiftForm.id });
      showSuccessToast('Club cover removed.');
      setShiftForm(emptyShiftForm(club, shiftForm.date));
      await refreshRota();
    } catch (error) {
      showErrorToast(error, 'Club cover could not be removed.');
    }
  }

  return (
    <section className="club-modal-section" aria-labelledby="club-rota-title">
      <div className="section-title">
        <div>
          <p className="muted">Cover planning</p>
          <h3 id="club-rota-title">Mini Rota</h3>
        </div>
        <Badge tone="blue">
          <UsersRound aria-hidden="true" size={14} />
          {String(selectedCandidates.length)} selected
        </Badge>
      </div>

      <div className="club-rota-grid">
        <section className="club-rota-panel">
          <div className="section-title">
            <h4>Rota access</h4>
            <Button
              onClick={() => {
                void saveParticipants();
              }}
              pending={setParticipants.isPending}
              size="sm"
              type="button"
            >
              <Save aria-hidden="true" size={14} />
              Save
            </Button>
          </div>
          {candidatesQuery.isLoading ? <div className="empty-state">Loading people...</div> : null}
          {candidatesQuery.error ? (
            <p className="status--error">{friendlyErrorMessage(candidatesQuery.error)}</p>
          ) : null}
          <CandidatePicker
            candidates={candidates}
            onToggle={toggleCandidate}
            selectedUserIds={selectedUserIds}
          />
        </section>

        <section className="club-rota-panel">
          <div className="section-title">
            <h4>{shiftForm.id ? 'Update cover' : 'Schedule cover'}</h4>
            {shiftForm.id ? <Badge tone="amber">Editing</Badge> : null}
          </div>
          <form
            className="clubs-form"
            onSubmit={(event) => {
              event.preventDefault();
              void saveShift();
            }}
          >
            {selectedDateStatus?.kind === 'closed' ? (
              <p className="status--warning">
                This date is unavailable for rota shifts: {selectedDateStatus.label}.
              </p>
            ) : selectedDateStatus?.kind === 'fieldTrip' ? (
              <p className="status--info">This cover is scheduled for a planned field trip.</p>
            ) : null}
            <Field label="Person">
              <SelectInput
                onChange={(event) => {
                  setShiftForm((current) => ({
                    ...current,
                    participantUserId: event.target.value,
                  }));
                }}
                required
                value={shiftForm.participantUserId}
              >
                <option value="">Choose cover</option>
                {selectedCandidates.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.fullName} - {roleLabel(candidate.role)}
                  </option>
                ))}
              </SelectInput>
            </Field>
            {shiftForm.id ? (
              <Field label="Date">
                <TextInput
                  onChange={(event) => {
                    setShiftForm((current) => ({ ...current, date: event.target.value }));
                  }}
                  required
                  type="date"
                  value={shiftForm.date}
                />
              </Field>
            ) : (
              <>
                <Field label="Dates" hint="Tuesday to Friday">
                  <div className="staff-rota-day-picker">
                    {operatingDays.map((day) => {
                      const value = dateKey(day);
                      return (
                        <label key={value}>
                          <input
                            checked={selectedDates.includes(value)}
                            onChange={(event) => {
                              setSelectedDates((current) =>
                                event.target.checked
                                  ? [...new Set([...current, value])]
                                  : current.filter((date) => date !== value),
                              );
                              setShiftForm((current) => ({ ...current, date: value }));
                            }}
                            type="checkbox"
                          />
                          {dayLabels[day.getUTCDay()]} {formatDateLabel(day)}
                        </label>
                      );
                    })}
                  </div>
                </Field>
                <Field label="Repeat">
                  <SelectInput
                    onChange={(event) => {
                      setRepeatScope(event.target.value as 'week' | 'term');
                    }}
                    value={repeatScope}
                  >
                    <option value="week">This week</option>
                    <option value="term">Whole term</option>
                  </SelectInput>
                </Field>
              </>
            )}
            <div className="form-grid form-grid--two rota-time-grid">
              <Field label="Start">
                <TextInput
                  onChange={(event) => {
                    setShiftForm((current) => ({ ...current, startsAt: event.target.value }));
                  }}
                  required
                  type="time"
                  value={shiftForm.startsAt}
                />
              </Field>
              <Field label="End">
                <TextInput
                  onChange={(event) => {
                    setShiftForm((current) => ({ ...current, endsAt: event.target.value }));
                  }}
                  required
                  type="time"
                  value={shiftForm.endsAt}
                />
              </Field>
            </div>
            <Field label="Notes" hint="Optional">
              <TextInput
                onChange={(event) => {
                  setShiftForm((current) => ({ ...current, notes: event.target.value }));
                }}
                value={shiftForm.notes}
              />
            </Field>
            {selectedAvailability ? (
              <div className="availability-list">
                <strong>{selectedAvailability.fullName}</strong>
                {selectedAvailability.availability.length === 0 ? (
                  <span className="muted">No volunteer availability set</span>
                ) : (
                  selectedAvailability.availability.map((window) => (
                    <span className="availability-pill" key={window.id}>
                      {availabilityLabel(window)}
                    </span>
                  ))
                )}
              </div>
            ) : null}
            <div className="clubs-form__actions">
              {shiftForm.id ? (
                <>
                  <Button
                    onClick={() => {
                      setShiftForm(emptyShiftForm(club, shiftForm.date));
                    }}
                    type="button"
                    variant="secondary"
                  >
                    <X aria-hidden="true" size={14} />
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      void removeShift();
                    }}
                    pending={deleteShift.isPending}
                    type="button"
                    variant="danger"
                  >
                    <Trash2 aria-hidden="true" size={14} />
                    Delete
                  </Button>
                </>
              ) : null}
              <Button
                disabled={!canSchedule}
                pending={createShiftBatch.isPending || updateShift.isPending}
                type="submit"
              >
                <Plus aria-hidden="true" size={14} />
                {shiftForm.id ? 'Update cover' : 'Add cover'}
              </Button>
            </div>
          </form>
        </section>
      </div>

      <section className="club-rota-panel">
        <div className="rota-toolbar">
          <div>
            <h4>Week rota</h4>
            <p>
              {formatDateLabel(weekStart)} - {formatDateLabel(weekEnd)}
            </p>
          </div>
          <div className="row-actions">
            <Button
              aria-label="Previous week"
              onClick={() => {
                setWeekStart((current) => addDays(current, -7));
              }}
              type="button"
              variant="secondary"
            >
              <ChevronLeft aria-hidden="true" size={16} />
            </Button>
            <Button
              aria-label="Next week"
              onClick={() => {
                setWeekStart((current) => addDays(current, 7));
              }}
              type="button"
              variant="secondary"
            >
              <ChevronRight aria-hidden="true" size={16} />
            </Button>
          </div>
        </div>
        <div aria-label="Rota people key" className="rota-role-key">
          <span className="rota-role-chip is-staff">Staff</span>
          <span className="rota-role-chip is-parent">Parent volunteer</span>
        </div>
        {scheduleQuery.isLoading ? <div className="empty-state">Loading club rota...</div> : null}
        {scheduleQuery.error ? (
          <p className="status--error">{friendlyErrorMessage(scheduleQuery.error)}</p>
        ) : null}
        {operatingDays.length === 0 ? <div className="empty-state">No operating days this week.</div> : null}
        <div className="rota-week-grid rota-week-grid--operating club-rota-week-grid">
          {operatingDays.map((day) => {
            const key = dateKey(day);
            const dayShifts = shifts.filter((shift) => shift.date === key);
            return (
              <article className="rota-day" key={key}>
                <header>
                  <span>{dayLabels[day.getUTCDay()]}</span>
                  <strong>{formatDateLabel(day)}</strong>
                </header>
                {dayShifts.length === 0 ? (
                  <Button
                    onClick={() => {
                      setShiftForm(emptyShiftForm(club, key));
                      setSelectedDates([key]);
                      setRepeatScope('week');
                    }}
                    size="sm"
                    type="button"
                    variant="secondary"
                  >
                    <Plus aria-hidden="true" size={14} />
                    Add cover
                  </Button>
                ) : (
                  <div className="rota-shift-list">
                    {dayShifts.map((shift) => (
                      <button
                        className={`rota-shift${shift.participant?.role === 'Parent' ? ' is-parent' : ' is-staff'}`}
                        key={shift.id}
                        onClick={() => {
                          setShiftForm(shiftToForm(shift));
                        }}
                        type="button"
                      >
                        <span>
                          {formatTime(shift.startsAt)}-{formatTime(shift.endsAt)}
                        </span>
                        <strong>{shift.participant?.fullName ?? 'Selected cover'}</strong>
                        <span
                          className={`rota-role-chip${
                            shift.participant?.role === 'Parent' ? ' is-parent' : ' is-staff'
                          }`}
                        >
                          {shift.participant?.role === 'Parent' ? 'Parent volunteer' : 'Staff'}
                        </span>
                        {shift.notes ? <em>{shift.notes}</em> : null}
                      </button>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>

      {mutationError ? (
        <p className="status--error">{friendlyErrorMessage(mutationError)}</p>
      ) : null}
    </section>
  );
}

import { CheckSquare, ChevronLeft, ChevronRight, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  dateKey,
  dayLabels,
  formatDateLabel,
  formatDateTime,
  parentVolunteerPlacementLabel,
  type ParentVolunteerDay,
  type RotaShift,
} from './rota-utils';

const MEETING_COLOUR = '#0f766e';

interface RotaWeekScheduleProps {
  clubShifts: readonly {
    source: 'club';
    id: string;
    date: string;
    startsAt: Date;
    endsAt: Date;
    notes: string | null;
    club: { id: string; name: string };
    participant: { id: string; fullName: string; role: string } | null;
  }[];
  dateStatuses: readonly {
    date: string;
    kind: 'operating' | 'fieldTrip' | 'closed';
    label: string;
  }[];
  errorMessage?: string | undefined;
  isFetching: boolean;
  isLoading: boolean;
  isBulkActionPending: boolean;
  onBulkDelete: () => void;
  onBulkEdit: () => void;
  onClearShiftSelection: () => void;
  onNextWeek: () => void;
  onPreviousWeek: () => void;
  onCreateShift: (date: string) => void;
  onRefresh: () => void;
  onSelectShift: (shift: RotaShift) => void;
  onThisWeek: () => void;
  onToggleShiftSelection: (shiftId: string) => void;
  parentVolunteerErrorMessage?: string | undefined;
  parentVolunteers: readonly ParentVolunteerDay[];
  shifts: readonly RotaShift[];
  selectedShiftIds: readonly string[];
  weekDays: readonly Date[];
  weekEnd: Date;
  weekStart: Date;
}

export function RotaWeekSchedule({
  clubShifts,
  dateStatuses,
  errorMessage,
  isFetching,
  isLoading,
  isBulkActionPending,
  onBulkDelete,
  onBulkEdit,
  onClearShiftSelection,
  onNextWeek,
  onPreviousWeek,
  onCreateShift,
  onRefresh,
  onSelectShift,
  onThisWeek,
  onToggleShiftSelection,
  parentVolunteerErrorMessage,
  parentVolunteers,
  shifts,
  selectedShiftIds,
  weekDays,
  weekEnd,
  weekStart,
}: RotaWeekScheduleProps) {
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const operatingDays = weekDays.filter((day) => {
    const status = dateStatuses.find((candidate) => candidate.date === dateKey(day));
    return day.getUTCDay() >= 2 && day.getUTCDay() <= 5 && status?.kind === 'operating';
  });
  const selectedShiftIdSet = new Set(selectedShiftIds);

  function closeSelectionMode(): void {
    setIsSelectionMode(false);
    onClearShiftSelection();
  }

  function renderShiftDetails(shift: RotaShift, shiftColour: string) {
    return (
      <>
        <span>
          {formatDateTime(shift.startsAt)}-{formatDateTime(shift.endsAt)}
        </span>
        <strong>{shift.staff?.fullName ?? 'Unassigned supervisor'}</strong>
        <span className="rota-role-chip is-staff">Staff</span>
        <small>
          <i style={{ backgroundColor: shiftColour }} />
          {shift.kind === 'Meeting' ? 'Meeting' : (shift.bandName ?? 'Band')}
        </small>
        {shift.availabilityConflict ? (
          <span className="rota-shift__warning">Unavailable — review shift</span>
        ) : null}
        {shift.notes ? <em>{shift.notes}</em> : null}
      </>
    );
  }

  return (
    <section className="panel rota-week-board">
      <div className="panel__body">
        <div className="rota-toolbar">
          <div>
            <h2>Week board</h2>
            <p>
              {formatDateLabel(weekStart)} - {formatDateLabel(weekEnd)}
            </p>
          </div>
          <div className="row-actions">
            <Button
              aria-label="Previous week"
              onClick={onPreviousWeek}
              type="button"
              variant="secondary"
            >
              <ChevronLeft aria-hidden="true" size={16} />
            </Button>
            <Button onClick={onThisWeek} type="button" variant="secondary">
              This week
            </Button>
            <Button aria-label="Next week" onClick={onNextWeek} type="button" variant="secondary">
              <ChevronRight aria-hidden="true" size={16} />
            </Button>
            <Button onClick={onRefresh} pending={isFetching} type="button" variant="secondary">
              <RefreshCw aria-hidden="true" size={16} />
              Refresh
            </Button>
          </div>
        </div>
        <div aria-label="Rota people key" className="rota-role-key">
          <span className="rota-role-chip is-staff">Staff</span>
          <span className="rota-role-chip is-parent">Parent volunteer</span>
          <span className="rota-source-chip is-centre">Centre volunteer</span>
          <span className="rota-source-chip is-clubs">Clubs volunteer</span>
        </div>
        <div className="rota-selection-toolbar">
          {isSelectionMode ? (
            <>
              <span aria-live="polite" className="rota-selection-toolbar__count">
                {selectedShiftIds.length === 0
                  ? 'Select two or more staff shifts'
                  : `${String(selectedShiftIds.length)} shifts selected`}
              </span>
              <Button
                disabled={selectedShiftIds.length < 2}
                onClick={onBulkEdit}
                size="sm"
                type="button"
                variant="secondary"
              >
                <CheckSquare aria-hidden="true" size={15} />
                Bulk edit
              </Button>
              <Button
                disabled={selectedShiftIds.length < 2}
                onClick={onBulkDelete}
                pending={isBulkActionPending}
                size="sm"
                type="button"
                variant="secondary"
              >
                <Trash2 aria-hidden="true" size={15} />
                Delete selected
              </Button>
              <Button onClick={closeSelectionMode} size="sm" type="button" variant="ghost">
                <X aria-hidden="true" size={15} />
                Done
              </Button>
            </>
          ) : (
            <Button
              onClick={() => {
                setIsSelectionMode(true);
              }}
              size="sm"
              type="button"
              variant="secondary"
            >
              <CheckSquare aria-hidden="true" size={15} />
              Select shifts
            </Button>
          )}
        </div>

        {isLoading ? <div className="empty-state">Loading rota...</div> : null}
        {errorMessage ? <p className="status--error">{errorMessage}</p> : null}
        {parentVolunteerErrorMessage ? (
          <p className="status--error">{parentVolunteerErrorMessage}</p>
        ) : null}
        {operatingDays.length === 0 ? (
          <p className="empty-state">No operating days this week.</p>
        ) : null}
        <div className="rota-week-grid rota-week-grid--operating">
          {operatingDays.map((day) => {
            const key = dateKey(day);
            const dayShifts = shifts.filter((shift) => shift.date === key);
            const dayClubShifts = clubShifts.filter((shift) => shift.date === key);
            const dateStatus = dateStatuses.find((status) => status.date === key);
            const dayParentVolunteers = parentVolunteers.filter(
              (volunteer) => volunteer.date === key,
            );
            return (
              <article className="rota-day" key={key}>
                <header>
                  <span>
                    {dayLabels[day.getUTCDay()]}
                    <strong>{formatDateLabel(day)}</strong>
                  </span>
                  <Button
                    onClick={() => {
                      onCreateShift(key);
                    }}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    <Plus aria-hidden="true" size={14} />
                    Add shift
                  </Button>
                </header>
                {dateStatus?.kind === 'closed' ? (
                  <p className="rota-day__status">{dateStatus.label}</p>
                ) : dateStatus?.kind === 'fieldTrip' ? (
                  <p className="rota-day__status is-field-trip">Planned field trip</p>
                ) : null}
                <div className="rota-parent-volunteers">
                  <span className="rota-availability-badges__label">Parent volunteers</span>
                  {dayParentVolunteers.length === 0 ? (
                    <span className="rota-availability-badge is-empty">None selected</span>
                  ) : (
                    dayParentVolunteers.map((volunteer) => (
                      <span
                        className={`rota-availability-badge is-parent ${
                          volunteer.placement === 'Centre' ? 'is-centre' : 'is-clubs'
                        }`}
                        key={volunteer.id}
                      >
                        {volunteer.parent.fullName}
                        <small>{parentVolunteerPlacementLabel(volunteer.placement)}</small>
                      </span>
                    ))
                  )}
                </div>
                {dayShifts.length === 0 ? (
                  <p className="muted">No shifts</p>
                ) : (
                  <div className="rota-shift-list">
                    {dayShifts.map((shift) => {
                      const shiftColour =
                        shift.kind === 'Meeting' ? MEETING_COLOUR : (shift.bandColour ?? '#5B90C5');

                      return isSelectionMode ? (
                        <label
                          className={`rota-shift rota-shift--selectable${
                            selectedShiftIdSet.has(shift.id) ? ' is-selected' : ''
                          }`}
                          key={shift.id}
                          style={{ borderLeftColor: shiftColour }}
                        >
                          <input
                            aria-label={`Select ${shift.staff?.fullName ?? 'unassigned supervisor'} shift on ${key}`}
                            checked={selectedShiftIdSet.has(shift.id)}
                            onChange={() => {
                              onToggleShiftSelection(shift.id);
                            }}
                            type="checkbox"
                          />
                          <span className="rota-shift--selectable__content">
                            {renderShiftDetails(shift, shiftColour)}
                          </span>
                        </label>
                      ) : (
                        <button
                          className="rota-shift"
                          key={shift.id}
                          onClick={() => {
                            onSelectShift(shift);
                          }}
                          style={{ borderLeftColor: shiftColour }}
                          type="button"
                        >
                          {renderShiftDetails(shift, shiftColour)}
                        </button>
                      );
                    })}
                  </div>
                )}
                {dayClubShifts.length > 0 ? (
                  <div className="rota-shift-list">
                    {dayClubShifts.map((shift) => (
                      <article
                        aria-label={`Clubs volunteer: ${shift.participant?.fullName ?? 'Selected cover'} for ${shift.club.name}`}
                        className="rota-shift rota-shift--club"
                        key={shift.id}
                        style={{ borderLeftColor: '#0E5C3A' }}
                      >
                        <span>
                          {formatDateTime(shift.startsAt)}-{formatDateTime(shift.endsAt)}
                        </span>
                        <strong>{shift.participant?.fullName ?? 'Selected cover'}</strong>
                        <span className="rota-role-chip is-clubs">Clubs volunteer</span>
                        <small>
                          <i style={{ backgroundColor: '#0E5C3A' }} />
                          {shift.club.name}
                        </small>
                        {shift.notes ? <em>{shift.notes}</em> : null}
                      </article>
                    ))}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

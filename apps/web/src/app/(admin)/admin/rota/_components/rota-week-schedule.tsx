import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  dateKey,
  dayLabels,
  formatDateLabel,
  formatDateTime,
  parentVolunteerPlacementLabel,
  type ParentVolunteerDay,
  type RotaDayAvailabilitySummary,
  type RotaShift,
  type StaffLunchAndClubsVolunteerDay,
} from './rota-utils';

const MEETING_COLOUR = '#0f766e';

interface RotaWeekScheduleProps {
  availabilityErrorMessage?: string | undefined;
  errorMessage?: string | undefined;
  isAvailabilityLoading: boolean;
  isFetching: boolean;
  isLoading: boolean;
  onNextWeek: () => void;
  onPreviousWeek: () => void;
  onRefresh: () => void;
  onSelectShift: (shift: RotaShift) => void;
  onThisWeek: () => void;
  parentVolunteerErrorMessage?: string | undefined;
  parentVolunteers: readonly ParentVolunteerDay[];
  staffLunchAndClubsVolunteerErrorMessage?: string | undefined;
  staffLunchAndClubsVolunteers: readonly StaffLunchAndClubsVolunteerDay[];
  staffAvailabilityByDay: readonly RotaDayAvailabilitySummary[];
  shifts: readonly RotaShift[];
  weekDays: readonly Date[];
  weekEnd: Date;
  weekStart: Date;
}

export function RotaWeekSchedule({
  availabilityErrorMessage,
  errorMessage,
  isAvailabilityLoading,
  isFetching,
  isLoading,
  onNextWeek,
  onPreviousWeek,
  onRefresh,
  onSelectShift,
  onThisWeek,
  parentVolunteerErrorMessage,
  parentVolunteers,
  staffLunchAndClubsVolunteerErrorMessage,
  staffLunchAndClubsVolunteers,
  staffAvailabilityByDay,
  shifts,
  weekDays,
  weekEnd,
  weekStart,
}: RotaWeekScheduleProps) {
  return (
    <section className="panel rota-layout__main">
      <div className="panel__body">
        <div className="rota-toolbar">
          <div>
            <h2>Week rota</h2>
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

        {isLoading ? <div className="empty-state">Loading rota...</div> : null}
        {errorMessage ? <p className="status--error">{errorMessage}</p> : null}
        {availabilityErrorMessage ? (
          <p className="status--error">{availabilityErrorMessage}</p>
        ) : null}
        {parentVolunteerErrorMessage ? (
          <p className="status--error">{parentVolunteerErrorMessage}</p>
        ) : null}
        {staffLunchAndClubsVolunteerErrorMessage ? (
          <p className="status--error">{staffLunchAndClubsVolunteerErrorMessage}</p>
        ) : null}
        <div className="rota-week-grid">
          {weekDays.map((day) => {
            const key = dateKey(day);
            const dayShifts = shifts.filter((shift) => shift.date === key);
            const dayParentVolunteers = parentVolunteers.filter(
              (volunteer) => volunteer.date === key,
            );
            const dayStaffLunchAndClubsVolunteers = staffLunchAndClubsVolunteers.filter(
              (volunteer) => volunteer.date === key,
            );
            const dayAvailability = staffAvailabilityByDay.find((summary) => summary.date === key);
            return (
              <article className="rota-day" key={key}>
                <header>
                  <span>{dayLabels[day.getUTCDay()]}</span>
                  <strong>{formatDateLabel(day)}</strong>
                </header>
                {dayAvailability ? (
                  <div className="rota-availability-badges" aria-label={`Availability for ${key}`}>
                    {isAvailabilityLoading ? (
                      <span className="rota-availability-badge is-empty">Loading availability</span>
                    ) : (
                      <>
                        <div>
                          <span className="rota-availability-badges__label">Available</span>
                          {dayAvailability.available.length === 0 ? (
                            <span className="rota-availability-badge is-empty">None set</span>
                          ) : (
                            dayAvailability.available.map((staff) => (
                              <span className="rota-availability-badge is-available" key={staff.id}>
                                {staff.label}
                                <small>{staff.detail}</small>
                              </span>
                            ))
                          )}
                        </div>
                        <div>
                          <span className="rota-availability-badges__label">Unavailable</span>
                          {dayAvailability.unavailable.length === 0 ? (
                            <span className="rota-availability-badge is-empty">None set</span>
                          ) : (
                            dayAvailability.unavailable.map((staff) => (
                              <span
                                className="rota-availability-badge is-unavailable"
                                key={staff.id}
                              >
                                {staff.label}
                                <small>{staff.detail}</small>
                              </span>
                            ))
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ) : null}
                <div className="rota-parent-volunteers">
                  <span className="rota-availability-badges__label">Parent volunteers</span>
                  {dayParentVolunteers.length === 0 ? (
                    <span className="rota-availability-badge is-empty">None selected</span>
                  ) : (
                    dayParentVolunteers.map((volunteer) => (
                      <span className="rota-availability-badge is-parent" key={volunteer.id}>
                        {volunteer.parent.fullName}
                        <small>{parentVolunteerPlacementLabel(volunteer.placement)}</small>
                      </span>
                    ))
                  )}
                </div>
                <div className="rota-parent-volunteers">
                  <span className="rota-availability-badges__label">Lunch + Clubs cover</span>
                  {dayStaffLunchAndClubsVolunteers.length === 0 ? (
                    <span className="rota-availability-badge is-empty">None selected</span>
                  ) : (
                    dayStaffLunchAndClubsVolunteers.map((volunteer) => (
                      <span className="rota-availability-badge is-staff-cover" key={volunteer.id}>
                        {volunteer.staff.fullName}
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

                      return (
                        <button
                          className="rota-shift"
                          key={shift.id}
                          onClick={() => {
                            onSelectShift(shift);
                          }}
                          style={{ borderLeftColor: shiftColour }}
                          type="button"
                        >
                          <span>
                            {formatDateTime(shift.startsAt)}-{formatDateTime(shift.endsAt)}
                          </span>
                          <strong>{shift.staff?.fullName ?? 'Unassigned supervisor'}</strong>
                          <small>
                            <i style={{ backgroundColor: shiftColour }} />
                            {shift.kind === 'Meeting' ? 'Meeting' : (shift.bandName ?? 'Band')}
                          </small>
                          {shift.notes ? <em>{shift.notes}</em> : null}
                        </button>
                      );
                    })}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

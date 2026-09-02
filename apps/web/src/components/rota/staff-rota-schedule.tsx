import {
  dateKey,
  dayLabel,
  dayNumber,
  formatDate,
  formatTime,
} from '@/app/(supervisor)/supervisor/_components/supervisor-utils';

type RotaShift = {
  bandColour: string | null;
  bandName: string | null;
  date: string;
  endsAt: Date;
  id: string;
  kind: 'Cover' | 'Meeting';
  notes: string | null;
  staff?: { fullName: string } | null;
  startsAt: Date;
};

type ParentVolunteer = {
  date: string;
  id: string;
  parent: { fullName: string };
  placement: 'Centre' | 'LunchAndClubsPrimary' | 'LunchAndClubsSecondary';
};

type StaffRotaScheduleProps = {
  isLoading: boolean;
  myShifts: readonly RotaShift[];
  onSelectDate: (date: string) => void;
  parentVolunteers: readonly ParentVolunteer[];
  queryError?: string | undefined;
  selectedDate: string;
  teamShifts: readonly RotaShift[];
  weekDays: readonly Date[];
};

function shiftLabel(shift: RotaShift): string {
  return shift.kind === 'Meeting' ? 'Meeting' : (shift.bandName ?? 'Unassigned band');
}

function volunteerPlacementLabel(volunteer: ParentVolunteer): string {
  switch (volunteer.placement) {
    case 'LunchAndClubsPrimary':
      return 'Lunch + Clubs · Primary';
    case 'LunchAndClubsSecondary':
      return 'Lunch + Clubs · Secondary';
    default:
      return 'Centre volunteer';
  }
}

function ShiftList({
  emptyMessage,
  shifts,
  showStaff = false,
}: {
  emptyMessage: string;
  shifts: readonly RotaShift[];
  showStaff?: boolean;
}) {
  if (shifts.length === 0) return <div className="staff-rota-empty">{emptyMessage}</div>;

  return (
    <div className="staff-rota-schedule-list">
      {shifts.map((shift) => (
        <article
          className="staff-rota-shift"
          key={shift.id}
          style={{ borderLeftColor: shift.bandColour ?? undefined }}
        >
          <strong>
            {showStaff && shift.staff ? `${shift.staff.fullName} · ` : null}
            {shiftLabel(shift)}
          </strong>
          <span>
            {formatTime(shift.startsAt)}–{formatTime(shift.endsAt)}
          </span>
          {shift.notes ? <em>{shift.notes}</em> : null}
        </article>
      ))}
    </div>
  );
}

function VolunteerList({ volunteers }: { volunteers: readonly ParentVolunteer[] }) {
  if (volunteers.length === 0) {
    return <div className="staff-rota-empty">No parent volunteers selected.</div>;
  }

  return (
    <div className="staff-rota-schedule-list">
      {volunteers.map((volunteer) => (
        <article className="staff-rota-volunteer" key={volunteer.id}>
          <strong>{volunteer.parent.fullName}</strong>
          <span>{volunteerPlacementLabel(volunteer)}</span>
        </article>
      ))}
    </div>
  );
}

export function StaffRotaSchedule({
  isLoading,
  myShifts,
  onSelectDate,
  parentVolunteers,
  queryError,
  selectedDate,
  teamShifts,
  weekDays,
}: StaffRotaScheduleProps) {
  const selectedDay = weekDays.find((day) => dateKey(day) === selectedDate) ?? weekDays[0];
  const selectedDayShifts = myShifts.filter((shift) => shift.date === selectedDate);
  const selectedTeamShifts = teamShifts.filter((shift) => shift.date === selectedDate);
  const selectedVolunteers = parentVolunteers.filter(
    (volunteer) => volunteer.date === selectedDate,
  );

  return (
    <section aria-labelledby="staff-rota-schedule-title" className="staff-rota-schedule">
      <div className="staff-rota-schedule__header">
        <div>
          <p className="staff-rota-eyebrow">This week</p>
          <h2 id="staff-rota-schedule-title">
            {selectedDay ? formatDate(selectedDay) : 'Your schedule'}
          </h2>
        </div>
        <span className="badge badge--blue">{String(myShifts.length)} shifts</span>
      </div>

      <div aria-label="Choose rota day" className="staff-rota-day-picker" role="group">
        {weekDays.map((day) => {
          const dayKey = dateKey(day);
          const selected = dayKey === selectedDate;
          return (
            <button
              aria-pressed={selected}
              className={`staff-rota-day-picker__day${selected ? ' is-selected' : ''}`}
              key={dayKey}
              onClick={() => {
                onSelectDate(dayKey);
              }}
              type="button"
            >
              <span>{dayLabel(day)}</span>
              <strong>{dayNumber(day)}</strong>
            </button>
          );
        })}
      </div>

      {queryError ? <p className="status--error">{queryError}</p> : null}
      {isLoading ? <div className="staff-rota-empty">Loading the rota...</div> : null}

      {!isLoading ? (
        <div className="staff-rota-schedule__columns">
          <section aria-label="Your shifts" className="staff-rota-schedule__column">
            <h3>Your shifts</h3>
            <ShiftList emptyMessage="No shift scheduled." shifts={selectedDayShifts} />
          </section>
          <section aria-label="Team cover" className="staff-rota-schedule__column">
            <h3>Team cover</h3>
            <ShiftList
              emptyMessage="No team shifts scheduled."
              shifts={selectedTeamShifts}
              showStaff
            />
          </section>
          <section aria-label="Parent volunteers" className="staff-rota-schedule__column">
            <h3>Parent volunteers</h3>
            <VolunteerList volunteers={selectedVolunteers} />
          </section>
        </div>
      ) : null}
    </section>
  );
}

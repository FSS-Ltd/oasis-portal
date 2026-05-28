import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { dateKey, dayLabels, formatDateLabel, formatDateTime, type RotaShift } from './rota-utils';

const MEETING_COLOUR = '#0f766e';

interface RotaWeekScheduleProps {
  errorMessage?: string | undefined;
  isFetching: boolean;
  isLoading: boolean;
  onNextWeek: () => void;
  onPreviousWeek: () => void;
  onRefresh: () => void;
  onSelectShift: (shift: RotaShift) => void;
  onThisWeek: () => void;
  shifts: readonly RotaShift[];
  weekDays: readonly Date[];
  weekEnd: Date;
  weekStart: Date;
}

export function RotaWeekSchedule({
  errorMessage,
  isFetching,
  isLoading,
  onNextWeek,
  onPreviousWeek,
  onRefresh,
  onSelectShift,
  onThisWeek,
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
        <div className="rota-week-grid">
          {weekDays.map((day) => {
            const key = dateKey(day);
            const dayShifts = shifts.filter((shift) => shift.date === key);
            return (
              <article className="rota-day" key={key}>
                <header>
                  <span>{dayLabels[day.getUTCDay()]}</span>
                  <strong>{formatDateLabel(day)}</strong>
                </header>
                {dayShifts.length === 0 ? (
                  <p className="muted">No shifts</p>
                ) : (
                  <div className="rota-shift-list">
                    {dayShifts.map((shift) => (
                      <button
                        className="rota-shift"
                        key={shift.id}
                        onClick={() => {
                          onSelectShift(shift);
                        }}
                        style={{
                          borderLeftColor:
                            shift.kind === 'Meeting'
                              ? MEETING_COLOUR
                              : (shift.bandColour ?? '#5B90C5'),
                        }}
                        type="button"
                      >
                        <span>
                          {formatDateTime(shift.startsAt)}-{formatDateTime(shift.endsAt)}
                        </span>
                        <strong>{shift.staff?.fullName ?? 'Unassigned supervisor'}</strong>
                        <small>
                          <i
                            style={{
                              backgroundColor:
                                shift.kind === 'Meeting'
                                  ? MEETING_COLOUR
                                  : (shift.bandColour ?? '#5B90C5'),
                            }}
                          />
                          {shift.kind === 'Meeting' ? 'Meeting' : (shift.bandName ?? 'Band')}
                        </small>
                        {shift.notes ? <em>{shift.notes}</em> : null}
                      </button>
                    ))}
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

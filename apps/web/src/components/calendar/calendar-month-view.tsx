import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  buildCalendarMonth,
  formatMonthLabel,
  weekdayLabels,
  type CalendarEvent,
} from './calendar-model';

interface CalendarMonthViewProps {
  events: readonly CalendarEvent[];
  monthKey: string;
  onNextMonth: () => void;
  onPreviousMonth: () => void;
  onToday: () => void;
}

export function CalendarMonthView({
  events,
  monthKey,
  onNextMonth,
  onPreviousMonth,
  onToday,
}: CalendarMonthViewProps) {
  const days = buildCalendarMonth(monthKey, events);

  return (
    <section
      className="panel panel__body calendar-month-panel"
      aria-labelledby="calendar-month-title"
    >
      <div className="calendar-month-toolbar">
        <div>
          <p>Calendar</p>
          <h2 id="calendar-month-title">{formatMonthLabel(monthKey)}</h2>
        </div>
        <div className="calendar-month-toolbar__actions">
          <Button
            aria-label="Previous month"
            onClick={onPreviousMonth}
            type="button"
            variant="secondary"
          >
            <ChevronLeft aria-hidden="true" size={16} />
          </Button>
          <Button onClick={onToday} type="button" variant="secondary">
            <CalendarDays aria-hidden="true" size={16} />
            Today
          </Button>
          <Button aria-label="Next month" onClick={onNextMonth} type="button" variant="secondary">
            <ChevronRight aria-hidden="true" size={16} />
          </Button>
        </div>
      </div>

      <div className="calendar-month-grid" aria-label={`${formatMonthLabel(monthKey)} calendar`}>
        {weekdayLabels.map((label) => (
          <div className="calendar-month-weekday" key={label}>
            {label}
          </div>
        ))}
        {days.map((day) => {
          const visibleEvents = day.events.slice(0, 2);
          const hiddenCount = day.events.length - visibleEvents.length;
          const className = [
            'calendar-month-day',
            day.currentMonth ? undefined : 'is-outside',
            day.today ? 'is-today' : undefined,
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <div className={className} key={day.key}>
              <span className="calendar-month-day__number">{String(day.dayNumber)}</span>
              <div className="calendar-month-day__events">
                {visibleEvents.map((event) => (
                  <span className="calendar-month-event" key={`${day.key}-${event.id}`}>
                    {event.title}
                  </span>
                ))}
                {hiddenCount > 0 ? (
                  <span className="calendar-month-more">+{String(hiddenCount)} more</span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

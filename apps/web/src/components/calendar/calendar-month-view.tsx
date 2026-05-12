import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  buildCalendarMonth,
  categoryClassNames,
  formatMonthLabel,
  weekdayLabels,
  type CalendarEvent,
  type CalendarSelectionMode,
} from './calendar-model';

interface CalendarSelection {
  endDate: string;
  mode: CalendarSelectionMode;
  startDate: string;
}

interface CalendarMonthViewProps {
  events: readonly CalendarEvent[];
  monthKey: string;
  onDateSelect?: (date: string) => void;
  onEventSelect?: (event: CalendarEvent) => void;
  onNextMonth: () => void;
  onPreviousMonth: () => void;
  onToday: () => void;
  selection?: CalendarSelection;
}

export function CalendarMonthView({
  events,
  monthKey,
  onDateSelect,
  onEventSelect,
  onNextMonth,
  onPreviousMonth,
  onToday,
  selection,
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
            isSelectedDate(day.key, selection) ? 'is-selected-date' : undefined,
            isSelectedRangeDay(day.key, selection) ? 'is-selected-range' : undefined,
            isSelectedRangeStart(day.key, selection) ? 'is-selected-range-start' : undefined,
            isSelectedRangeEnd(day.key, selection) ? 'is-selected-range-end' : undefined,
            isPendingRangeStart(day.key, selection) ? 'is-range-pending' : undefined,
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <div
              aria-label={onDateSelect ? `Select ${day.key}` : undefined}
              className={className}
              key={day.key}
              onClick={() => {
                onDateSelect?.(day.key);
              }}
              onKeyDown={(keyEvent) => {
                if (!onDateSelect) return;
                if (keyEvent.key !== 'Enter' && keyEvent.key !== ' ') return;
                keyEvent.preventDefault();
                onDateSelect(day.key);
              }}
              role={onDateSelect ? 'button' : undefined}
              tabIndex={onDateSelect ? 0 : undefined}
            >
              <span className="calendar-month-day__number">{String(day.dayNumber)}</span>
              <div className="calendar-month-day__events">
                {visibleEvents.map((event) =>
                  onEventSelect ? (
                    <button
                      className={`calendar-month-event ${categoryClassNames[event.category]}`}
                      key={`${day.key}-${event.id}`}
                      onClick={(clickEvent) => {
                        clickEvent.stopPropagation();
                        onEventSelect(event);
                      }}
                      type="button"
                    >
                      {event.title}
                    </button>
                  ) : (
                    <span
                      className={`calendar-month-event ${categoryClassNames[event.category]}`}
                      key={`${day.key}-${event.id}`}
                    >
                      {event.title}
                    </span>
                  ),
                )}
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

function isSelectedDate(key: string, selection: CalendarSelection | undefined): boolean {
  if (!selection || selection.mode !== 'single') return false;
  return selection.startDate === key;
}

function selectedRangeBounds(
  selection: CalendarSelection | undefined,
): { endDate: string; startDate: string } | null {
  if (!selection || selection.mode !== 'range' || !selection.startDate || !selection.endDate) {
    return null;
  }
  if (selection.startDate <= selection.endDate) {
    return { startDate: selection.startDate, endDate: selection.endDate };
  }
  return { startDate: selection.endDate, endDate: selection.startDate };
}

function isSelectedRangeDay(key: string, selection: CalendarSelection | undefined): boolean {
  const bounds = selectedRangeBounds(selection);
  if (!bounds) return false;
  return bounds.startDate <= key && key <= bounds.endDate;
}

function isSelectedRangeStart(key: string, selection: CalendarSelection | undefined): boolean {
  const bounds = selectedRangeBounds(selection);
  return bounds?.startDate === key;
}

function isSelectedRangeEnd(key: string, selection: CalendarSelection | undefined): boolean {
  const bounds = selectedRangeBounds(selection);
  return bounds?.endDate === key;
}

function isPendingRangeStart(key: string, selection: CalendarSelection | undefined): boolean {
  if (!selection || selection.mode !== 'range') return false;
  return selection.startDate === key && !selection.endDate;
}

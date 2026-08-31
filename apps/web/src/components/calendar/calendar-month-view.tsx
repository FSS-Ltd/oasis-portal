import type { CSSProperties } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  buildCalendarMonthWeeks,
  categoryClassNames,
  formatEventSchedule,
  formatMonthLabel,
  isCalendarEventRange,
  weekdayLabels,
  type CalendarEvent,
  type CalendarMonthDay,
  type CalendarMonthRangeSegment,
  type CalendarSelectionMode,
} from './calendar-model';

interface CalendarSelection {
  endDate: string;
  mode: CalendarSelectionMode;
  startDate: string;
}

interface CalendarMonthViewProps {
  events: readonly CalendarEvent[];
  eventOpenMode?: 'click' | 'doubleClick';
  monthKey: string;
  onDateSelect?: (date: string) => void;
  onEventDoubleSelect?: (event: CalendarEvent) => void;
  onEventSelect?: (event: CalendarEvent) => void;
  onNextMonth: () => void;
  onPreviousMonth: () => void;
  onToday: () => void;
  selection?: CalendarSelection;
}

export function CalendarMonthView({
  events,
  eventOpenMode = 'click',
  monthKey,
  onDateSelect,
  onEventDoubleSelect,
  onEventSelect,
  onNextMonth,
  onPreviousMonth,
  onToday,
  selection,
}: CalendarMonthViewProps) {
  const weeks = buildCalendarMonthWeeks(monthKey, events);
  const monthLabel = formatMonthLabel(monthKey);

  return (
    <section
      className="panel panel__body calendar-month-panel"
      aria-labelledby="calendar-month-title"
    >
      <div className="calendar-month-toolbar">
        <div>
          <p>Calendar</p>
          <h2 id="calendar-month-title">{monthLabel}</h2>
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

      <div className="calendar-month-grid" aria-label={`${monthLabel} calendar`}>
        {weekdayLabels.map((label) => (
          <div className="calendar-month-weekday" key={label}>
            {label}
          </div>
        ))}
        <div className="calendar-month-weeks">
          {weeks.map((week) => (
            <div
              className="calendar-month-week"
              key={week.days[0]?.key}
              style={
                {
                  '--calendar-range-space': `${String(week.rangeLaneCount * 24)}px`,
                } as CSSProperties
              }
            >
              {week.days.map((day, dayIndex) => (
                <CalendarMonthDayCell
                  day={day}
                  dayIndex={dayIndex}
                  eventOpenMode={eventOpenMode}
                  key={day.key}
                  onDateSelect={onDateSelect}
                  onEventDoubleSelect={onEventDoubleSelect}
                  onEventSelect={onEventSelect}
                  selection={selection}
                  showRangeSpace={week.rangeLaneCount > 0}
                />
              ))}
              {week.rangeSegments.map((segment) => (
                <CalendarMonthRangeEvent
                  eventOpenMode={eventOpenMode}
                  key={`${segment.event.id}-${String(segment.startColumn)}`}
                  onEventDoubleSelect={onEventDoubleSelect}
                  onEventSelect={onEventSelect}
                  segment={segment}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

interface CalendarMonthDayCellProps {
  day: CalendarMonthDay;
  dayIndex: number;
  eventOpenMode: 'click' | 'doubleClick';
  onDateSelect: ((date: string) => void) | undefined;
  onEventDoubleSelect: ((event: CalendarEvent) => void) | undefined;
  onEventSelect: ((event: CalendarEvent) => void) | undefined;
  selection: CalendarSelection | undefined;
  showRangeSpace: boolean;
}

function CalendarMonthDayCell({
  day,
  dayIndex,
  eventOpenMode,
  onDateSelect,
  onEventDoubleSelect,
  onEventSelect,
  selection,
  showRangeSpace,
}: CalendarMonthDayCellProps) {
  const dailyEvents = day.events.filter((event) => !isCalendarEventRange(event));
  const visibleEvents = dailyEvents.slice(0, 2);
  const hiddenCount = dailyEvents.length - visibleEvents.length;
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
      style={{ gridColumn: dayIndex + 1, gridRow: 1 }}
      tabIndex={onDateSelect ? 0 : undefined}
    >
      <span className="calendar-month-day__number">{String(day.dayNumber)}</span>
      {showRangeSpace ? (
        <span aria-hidden="true" className="calendar-month-day__range-space" />
      ) : null}
      <div className="calendar-month-day__events">
        {visibleEvents.map((event) =>
          onEventSelect ? (
            <button
              className={`calendar-month-event ${categoryClassNames[event.category]}`}
              key={`${day.key}-${event.id}`}
              onClick={(clickEvent) => {
                clickEvent.stopPropagation();
                if (eventOpenMode === 'click') {
                  onEventSelect(event);
                }
              }}
              onDoubleClick={(clickEvent) => {
                clickEvent.stopPropagation();
                (onEventDoubleSelect ?? onEventSelect)(event);
              }}
              onKeyDown={(keyEvent) => {
                if (keyEvent.key !== 'Enter' && keyEvent.key !== ' ') return;
                keyEvent.preventDefault();
                keyEvent.stopPropagation();
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
}

interface CalendarMonthRangeEventProps {
  eventOpenMode: 'click' | 'doubleClick';
  onEventDoubleSelect: ((event: CalendarEvent) => void) | undefined;
  onEventSelect: ((event: CalendarEvent) => void) | undefined;
  segment: CalendarMonthRangeSegment;
}

function CalendarMonthRangeEvent({
  eventOpenMode,
  onEventDoubleSelect,
  onEventSelect,
  segment,
}: CalendarMonthRangeEventProps) {
  const { event } = segment;
  const label = `${event.title}, ${formatEventSchedule(event)}`;
  const className = [
    'calendar-month-range-event',
    categoryClassNames[event.category],
    segment.continuesFromPreviousWeek ? 'is-range-continued-from' : 'is-range-start',
    segment.continuesToNextWeek ? 'is-range-continues-to' : 'is-range-end',
  ].join(' ');
  const style = {
    '--calendar-range-offset': `${String(segment.lane * 24)}px`,
    gridColumn: `${String(segment.startColumn + 1)} / ${String(segment.endColumn + 2)}`,
    gridRow: 1,
  } as CSSProperties;
  const content = segment.showsLabel ? event.title : <span className="sr-only">{label}</span>;

  if (!onEventSelect) {
    return (
      <span aria-label={label} className={className} role="img" style={style} title={label}>
        {content}
      </span>
    );
  }

  return (
    <button
      aria-label={label}
      className={className}
      onClick={(clickEvent) => {
        clickEvent.stopPropagation();
        if (eventOpenMode === 'click') {
          onEventSelect(event);
        }
      }}
      onDoubleClick={(clickEvent) => {
        clickEvent.stopPropagation();
        (onEventDoubleSelect ?? onEventSelect)(event);
      }}
      onKeyDown={(keyEvent) => {
        if (keyEvent.key !== 'Enter' && keyEvent.key !== ' ') return;
        keyEvent.preventDefault();
        keyEvent.stopPropagation();
        onEventSelect(event);
      }}
      style={style}
      tabIndex={segment.showsLabel ? undefined : -1}
      title={label}
      type="button"
    >
      {content}
    </button>
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

'use client';

const weekdays = [
  { value: 0, shortLabel: 'Sun', label: 'Sunday' },
  { value: 1, shortLabel: 'Mon', label: 'Monday' },
  { value: 2, shortLabel: 'Tue', label: 'Tuesday' },
  { value: 3, shortLabel: 'Wed', label: 'Wednesday' },
  { value: 4, shortLabel: 'Thu', label: 'Thursday' },
  { value: 5, shortLabel: 'Fri', label: 'Friday' },
  { value: 6, shortLabel: 'Sat', label: 'Saturday' },
] as const;

const hourOptions = Array.from({ length: 25 }, (_, index) => index);
const minuteOptions = Array.from({ length: 60 }, (_, index) => index);
const defaultLimitedMinutes = 60;

interface DailyLimitControlsProps {
  dailyLimitMinutes: number | null;
  disabled: boolean;
  onChange: (value: number | null) => void;
}

interface OffLimitWeekdaySelectorProps {
  disabled: boolean;
  onChange: (value: number[]) => void;
  value: readonly number[];
}

function durationParts(totalMinutes: number | null): { hours: number; minutes: number } {
  const minutes = totalMinutes ?? defaultLimitedMinutes;
  return {
    hours: Math.floor(minutes / 60),
    minutes: minutes % 60,
  };
}

function clampDuration(hours: number, minutes: number): number {
  if (hours >= 24) return 1_440;
  if (hours <= 0 && minutes <= 0) return 1;
  return hours * 60 + minutes;
}

export function DailyLimitControls({
  dailyLimitMinutes,
  disabled,
  onChange,
}: DailyLimitControlsProps) {
  const limited = dailyLimitMinutes !== null;
  const { hours, minutes } = durationParts(dailyLimitMinutes);
  const availableMinuteOptions = hours === 24 ? [0] : minuteOptions;

  return (
    <div className="parent-settings-duration-control">
      <div className="parent-settings-segmented" role="group" aria-label="Daily portal limit mode">
        <button
          aria-pressed={!limited}
          className={!limited ? 'is-active' : undefined}
          disabled={disabled}
          onClick={() => {
            onChange(null);
          }}
          type="button"
        >
          Unlimited
        </button>
        <button
          aria-pressed={limited}
          className={limited ? 'is-active' : undefined}
          disabled={disabled}
          onClick={() => {
            onChange(dailyLimitMinutes ?? defaultLimitedMinutes);
          }}
          type="button"
        >
          Limited
        </button>
      </div>

      <div className="parent-settings-duration-picker" aria-label="Daily portal limit duration">
        <div>
          <span>Hours</span>
          <select
            aria-label="Daily limit hours"
            disabled={disabled || !limited}
            onChange={(event) => {
              const nextHours = Number(event.target.value);
              onChange(clampDuration(nextHours, nextHours === 24 ? 0 : minutes));
            }}
            value={hours}
          >
            {hourOptions.map((value) => (
              <option key={value} value={value}>
                {String(value).padStart(2, '0')}
              </option>
            ))}
          </select>
        </div>
        <div>
          <span>Minutes</span>
          <select
            aria-label="Daily limit minutes"
            disabled={disabled || !limited}
            onChange={(event) => {
              onChange(clampDuration(hours, Number(event.target.value)));
            }}
            value={hours === 24 ? 0 : minutes}
          >
            {availableMinuteOptions.map((value) => (
              <option key={value} value={value}>
                {String(value).padStart(2, '0')}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

export function OffLimitWeekdaySelector({
  disabled,
  onChange,
  value,
}: OffLimitWeekdaySelectorProps) {
  const selected = new Set(value);

  function toggle(day: number): void {
    const next = new Set(selected);
    if (next.has(day)) {
      next.delete(day);
    } else {
      next.add(day);
    }
    onChange([...next].sort((left, right) => left - right));
  }

  return (
    <div className="parent-settings-weekdays" role="group" aria-label="Off-limit weekdays">
      {weekdays.map((day) => {
        const active = selected.has(day.value);
        return (
          <button
            aria-label={`${day.label} off limits`}
            aria-pressed={active}
            className={active ? 'is-active' : undefined}
            disabled={disabled}
            key={day.value}
            onClick={() => {
              toggle(day.value);
            }}
            type="button"
          >
            <span>{day.shortLabel}</span>
          </button>
        );
      })}
    </div>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Send, Trash2 } from 'lucide-react';
import { api } from '@/lib/trpc';
import { AttendanceCapture } from '@/components/attendance/attendance-capture';
import { Button } from '@/components/ui/button';
import { Field, SelectInput, TextInput } from '@/components/ui/field';

const weekdays = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
] as const;

type AvailabilityDraft = {
  id: string;
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
};

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function asDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function mondayFor(date: Date): Date {
  const next = new Date(date);
  const day = next.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  next.setUTCDate(next.getUTCDate() + offset);
  next.setUTCHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function toTimeValue(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function fromTimeValue(value: string): number {
  const [hour = '0', minute = '0'] = value.split(':');
  return Number(hour) * 60 + Number(minute);
}

function formatDate(value: string | Date): string {
  const date = typeof value === 'string' ? asDate(value) : value;
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: '2-digit', month: 'short' }).format(date);
}

function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  }).format(value);
}

function formatShift(shift: { date: string; startsAt: Date; endsAt: Date; bandName: string | null }): string {
  return `${formatDate(shift.date)} · ${formatDateTime(shift.startsAt)}-${formatDateTime(shift.endsAt)} · ${
    shift.bandName ?? 'Unassigned band'
  }`;
}

function emptyAvailabilityRow(): AvailabilityDraft {
  return {
    id: `draft_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    dayOfWeek: 1,
    startMinute: 540,
    endMinute: 720,
  };
}

type SupervisorDashboardClientProps = {
  canExportAttendance: boolean;
};

export function SupervisorDashboardClient({ canExportAttendance }: SupervisorDashboardClientProps) {
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [availabilityDraft, setAvailabilityDraft] = useState<AvailabilityDraft[]>([]);
  const [swapForm, setSwapForm] = useState({ fromShiftId: '', toShiftId: '' });
  const [availabilityStatus, setAvailabilityStatus] = useState<string | null>(null);
  const [swapStatus, setSwapStatus] = useState<string | null>(null);

  const date = useMemo(() => asDate(selectedDate), [selectedDate]);
  const weekStart = useMemo(() => mondayFor(date), [date]);
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);
  const utils = api.useUtils();

  const todayRotaQuery = api.rota.myRota.useQuery({ from: date, to: date }, { retry: false });
  const weekRotaQuery = api.rota.myRota.useQuery({ from: weekStart, to: weekEnd }, { retry: false });
  const availabilityQuery = api.rota.myAvailability.useQuery(undefined, { retry: false });
  const swapCandidatesQuery = api.rota.swapCandidates.useQuery({ from: weekStart, to: weekEnd }, { retry: false });

  const saveAvailability = api.rota.setMyAvailability.useMutation({
    onSuccess: async () => {
      setAvailabilityStatus('Availability saved.');
      await utils.rota.myAvailability.invalidate();
    },
  });
  const requestSwap = api.rota.requestSwap.useMutation({
    onSuccess: async () => {
      setSwapStatus('Shift swap request sent for Head review.');
      setSwapForm({ fromShiftId: '', toShiftId: '' });
      await Promise.all([
        utils.rota.myRota.invalidate({ from: weekStart, to: weekEnd }),
        utils.rota.swapCandidates.invalidate({ from: weekStart, to: weekEnd }),
      ]);
    },
  });

  useEffect(() => {
    if (!availabilityQuery.data) return;
    setAvailabilityDraft(
      availabilityQuery.data.map((window) => ({
        id: window.id,
        dayOfWeek: window.dayOfWeek,
        startMinute: window.startMinute,
        endMinute: window.endMinute,
      })),
    );
  }, [availabilityQuery.data]);

  const todayShifts = todayRotaQuery.data ?? [];
  const weekShifts = weekRotaQuery.data ?? [];
  const swapCandidates = swapCandidatesQuery.data ?? [];

  return (
    <div className="supervisor-layout">
      <section className="supervisor-layout__main">
        <section className="panel panel__body" id="attendance-capture">
          <div className="section-title">
            <div>
              <h2>Attendance capture</h2>
              <p className="muted">Mark the daily register and filter students by configured year-group bands.</p>
            </div>
            <span className="badge badge--blue">Student register</span>
          </div>
          <AttendanceCapture
            canExport={canExportAttendance}
            emptyMessage="Head of Centre can add students before the daily workflow starts."
            onSelectedDateChange={setSelectedDate}
            selectedDate={selectedDate}
            showBandFilter
          />
        </section>

        <section className="panel panel__body" id="rota">
          <div className="section-title">
            <div>
              <h2>Your rota</h2>
              <p className="muted">
                Today and week of {dateKey(weekStart)} to {dateKey(weekEnd)}.
              </p>
            </div>
            <span className="badge badge--blue">{weekShifts.length} this week</span>
          </div>

          <div className="supervisor-rota-grid">
            <div>
              <h3>Today</h3>
              {todayRotaQuery.isLoading ? <div className="empty-state">Loading today&apos;s rota...</div> : null}
              {todayRotaQuery.error ? <p className="status--error">{todayRotaQuery.error.message}</p> : null}
              {!todayRotaQuery.isLoading && todayShifts.length === 0 ? (
                <div className="empty-state">No shift scheduled for today.</div>
              ) : (
                <div className="rota-shift-list">
                  {todayShifts.map((shift) => (
                    <article
                      className="rota-shift"
                      key={shift.id}
                      style={{ borderLeftColor: shift.bandColour ?? undefined }}
                    >
                      <strong>{shift.bandName ?? 'Unassigned band'}</strong>
                      <span>
                        {formatDateTime(shift.startsAt)}-{formatDateTime(shift.endsAt)}
                      </span>
                      {shift.notes ? <em>{shift.notes}</em> : null}
                    </article>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3>This week</h3>
              {weekRotaQuery.isLoading ? <div className="empty-state">Loading weekly rota...</div> : null}
              {weekRotaQuery.error ? <p className="status--error">{weekRotaQuery.error.message}</p> : null}
              {!weekRotaQuery.isLoading && weekShifts.length === 0 ? (
                <div className="empty-state">No shifts scheduled this week.</div>
              ) : (
                <div className="rota-shift-list">
                  {weekShifts.map((shift) => (
                    <article
                      className="rota-shift"
                      key={shift.id}
                      style={{ borderLeftColor: shift.bandColour ?? undefined }}
                    >
                      <strong>{shift.bandName ?? 'Unassigned band'}</strong>
                      <span>{formatShift(shift)}</span>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </section>

      <aside className="supervisor-layout__side">
        <section className="panel panel__body">
          <div className="section-title">
            <h2>Weekly availability</h2>
            <Button
              onClick={() => setAvailabilityDraft((rows) => [...rows, emptyAvailabilityRow()])}
              size="sm"
              type="button"
              variant="secondary"
            >
              <Plus aria-hidden="true" size={14} />
              Add
            </Button>
          </div>

          {availabilityQuery.isLoading ? <div className="empty-state">Loading availability...</div> : null}
          {availabilityQuery.error ? <p className="status--error">{availabilityQuery.error.message}</p> : null}

          <div className="availability-editor">
            {availabilityDraft.length === 0 ? (
              <div className="empty-state">No availability set.</div>
            ) : (
              availabilityDraft.map((window) => (
                <div className="availability-editor__row" key={window.id}>
                  <Field label="Day">
                    <SelectInput
                      aria-label="Availability day"
                      onChange={(event) =>
                        setAvailabilityDraft((rows) =>
                          rows.map((row) =>
                            row.id === window.id ? { ...row, dayOfWeek: Number(event.target.value) } : row,
                          ),
                        )
                      }
                      value={window.dayOfWeek}
                    >
                      {weekdays.map((day) => (
                        <option key={day.value} value={day.value}>
                          {day.label}
                        </option>
                      ))}
                    </SelectInput>
                  </Field>
                  <Field label="Start">
                    <TextInput
                      aria-label="Availability start time"
                      onChange={(event) =>
                        setAvailabilityDraft((rows) =>
                          rows.map((row) =>
                            row.id === window.id ? { ...row, startMinute: fromTimeValue(event.target.value) } : row,
                          ),
                        )
                      }
                      type="time"
                      value={toTimeValue(window.startMinute)}
                    />
                  </Field>
                  <Field label="End">
                    <TextInput
                      aria-label="Availability end time"
                      onChange={(event) =>
                        setAvailabilityDraft((rows) =>
                          rows.map((row) =>
                            row.id === window.id ? { ...row, endMinute: fromTimeValue(event.target.value) } : row,
                          ),
                        )
                      }
                      type="time"
                      value={toTimeValue(window.endMinute)}
                    />
                  </Field>
                  <Button
                    aria-label="Remove availability window"
                    onClick={() => setAvailabilityDraft((rows) => rows.filter((row) => row.id !== window.id))}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    <Trash2 aria-hidden="true" size={14} />
                  </Button>
                </div>
              ))
            )}
          </div>

          <Button
            className="supervisor-submit"
            onClick={() => {
              setAvailabilityStatus(null);
              saveAvailability.mutate({
                windows: availabilityDraft.map(({ dayOfWeek, startMinute, endMinute }) => ({
                  dayOfWeek,
                  startMinute,
                  endMinute,
                })),
              });
            }}
            pending={saveAvailability.isPending}
            type="button"
          >
            Save availability
          </Button>
          {availabilityStatus ? <p className="status--success">{availabilityStatus}</p> : null}
          {saveAvailability.error ? <p className="status--error">{saveAvailability.error.message}</p> : null}
        </section>

        <section className="panel panel__body">
          <div className="section-title">
            <h2>Request shift swap</h2>
          </div>

          <div className="form-grid">
            <Field label="Your shift">
              <SelectInput
                aria-label="Your shift to swap"
                onChange={(event) => setSwapForm((form) => ({ ...form, fromShiftId: event.target.value }))}
                value={swapForm.fromShiftId}
              >
                <option value="">Choose your shift</option>
                {weekShifts.map((shift) => (
                  <option key={shift.id} value={shift.id}>
                    {formatShift(shift)}
                  </option>
                ))}
              </SelectInput>
            </Field>

            <Field label="Requested shift">
              <SelectInput
                aria-label="Requested shift to swap with"
                onChange={(event) => setSwapForm((form) => ({ ...form, toShiftId: event.target.value }))}
                value={swapForm.toShiftId}
              >
                <option value="">Choose another staff shift</option>
                {swapCandidates.map((shift) => (
                  <option key={shift.id} value={shift.id}>
                    {shift.staff?.fullName ?? 'Staff'} · {formatShift(shift)}
                  </option>
                ))}
              </SelectInput>
            </Field>
          </div>

          {swapCandidatesQuery.error ? <p className="status--error">{swapCandidatesQuery.error.message}</p> : null}
          {!swapCandidatesQuery.isLoading && swapCandidates.length === 0 ? (
            <p className="muted">No other staff shifts are available in this week.</p>
          ) : null}

          <Button
            className="supervisor-submit"
            disabled={!swapForm.fromShiftId || !swapForm.toShiftId}
            onClick={() => {
              setSwapStatus(null);
              requestSwap.mutate(swapForm);
            }}
            pending={requestSwap.isPending}
            type="button"
          >
            <Send aria-hidden="true" size={16} />
            Send request
          </Button>
          {swapStatus ? <p className="status--success">{swapStatus}</p> : null}
          {requestSwap.error ? <p className="status--error">{requestSwap.error.message}</p> : null}
        </section>
      </aside>
    </div>
  );
}

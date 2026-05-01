'use client';

import { Check, ChevronLeft, ChevronRight, Pencil, RefreshCw, Save, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { api } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Field, SelectInput, TextInput } from '@/components/ui/field';

const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

type ShiftForm = {
  id: string | null;
  staffUserId: string;
  yearGroupBandId: string;
  date: string;
  startsAt: string;
  endsAt: string;
  notes: string;
};

type AvailabilityWindow = {
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
};

type StaffAvailability = {
  id: string;
  fullName: string;
  role: string;
  availability: AvailabilityWindow[];
};

type RotaShift = {
  id: string;
  staffUserId: string;
  yearGroupBandId: string;
  date: string;
  startsAt: Date;
  endsAt: Date;
  notes: string | null;
  bandName: string | null;
  bandColour: string | null;
  staff: { fullName: string; email: string; role: string } | null;
};

const emptyShiftForm: ShiftForm = {
  id: null,
  staffUserId: '',
  yearGroupBandId: '',
  date: '',
  startsAt: '09:00',
  endsAt: '12:00',
  notes: '',
};

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function today(): Date {
  return new Date(`${dateKey(new Date())}T00:00:00.000Z`);
}

function mondayFor(date: Date): Date {
  const base = new Date(`${dateKey(date)}T00:00:00.000Z`);
  const day = base.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  base.setUTCDate(base.getUTCDate() + offset);
  return base;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function formatDateLabel(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

function formatDateTime(value: Date): string {
  return value.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  });
}

function formatMinute(minute: number): string {
  const hours = Math.floor(minute / 60);
  const minutes = minute % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function asDateTime(date: string, time: string): Date {
  return new Date(`${date}T${time}:00.000Z`);
}

function shiftToForm(shift: RotaShift): ShiftForm {
  return {
    id: shift.id,
    staffUserId: shift.staffUserId,
    yearGroupBandId: shift.yearGroupBandId,
    date: shift.date,
    startsAt: formatDateTime(shift.startsAt),
    endsAt: formatDateTime(shift.endsAt),
    notes: shift.notes ?? '',
  };
}

function availabilityLabel(window: AvailabilityWindow): string {
  const dayLabel = dayLabels[window.dayOfWeek] ?? 'Unknown';
  return `${dayLabel} ${formatMinute(window.startMinute)}-${formatMinute(window.endMinute)}`;
}

export function RotaSchedulerClient() {
  const [weekStart, setWeekStart] = useState(() => mondayFor(today()));
  const [shiftForm, setShiftForm] = useState<ShiftForm>(() => ({
    ...emptyShiftForm,
    date: dateKey(mondayFor(today())),
  }));
  const utils = api.useUtils();

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart],
  );
  const weekEnd = weekDays[6] ?? weekStart;
  const scheduleQuery = api.rota.weekSchedule.useQuery(
    { from: weekStart, to: weekEnd },
    { retry: false },
  );
  const staffQuery = api.rota.listStaff.useQuery(undefined, { retry: false });
  const availabilityQuery = api.rota.staffAvailability.useQuery(undefined, { retry: false });
  const bandsQuery = api.admin.listYearGroupBands.useQuery(undefined, { retry: false });
  const swapsQuery = api.rota.pendingSwapRequests.useQuery(undefined, { retry: false });

  const activeBands = useMemo(
    () => (bandsQuery.data ?? []).filter((band) => band.active),
    [bandsQuery.data],
  );
  const shifts = (scheduleQuery.data ?? []) as RotaShift[];
  const staffAvailability = (availabilityQuery.data ?? []) as StaffAvailability[];

  const refreshRota = async () => {
    await Promise.all([
      utils.rota.weekSchedule.invalidate({ from: weekStart, to: weekEnd }),
      utils.rota.staffAvailability.invalidate(),
      utils.rota.pendingSwapRequests.invalidate(),
    ]);
  };

  const createShift = api.rota.createShift.useMutation({
    async onSuccess() {
      setShiftForm({ ...emptyShiftForm, date: shiftForm.date });
      await refreshRota();
    },
  });
  const updateShift = api.rota.updateShift.useMutation({
    async onSuccess() {
      setShiftForm({ ...emptyShiftForm, date: shiftForm.date });
      await refreshRota();
    },
  });
  const approveSwap = api.rota.approveSwap.useMutation({
    async onSuccess() {
      await refreshRota();
    },
  });
  const rejectSwap = api.rota.rejectSwap.useMutation({
    async onSuccess() {
      await refreshRota();
    },
  });

  const selectedStaffAvailability = staffAvailability.find(
    (staff) => staff.id === shiftForm.staffUserId,
  );
  const mutationError =
    createShift.error ?? updateShift.error ?? approveSwap.error ?? rejectSwap.error;

  return (
    <div className="rota-layout">
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
                onClick={() => {
                  setWeekStart((current) => addDays(current, -7));
                }}
                type="button"
                variant="secondary"
              >
                <ChevronLeft aria-hidden="true" size={16} />
              </Button>
              <Button
                onClick={() => {
                  const nextWeek = mondayFor(today());
                  setWeekStart(nextWeek);
                  setShiftForm((current) => ({ ...current, date: dateKey(nextWeek) }));
                }}
                type="button"
                variant="secondary"
              >
                This week
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
              <Button
                onClick={() => {
                  void scheduleQuery.refetch();
                }}
                pending={scheduleQuery.isFetching}
                type="button"
                variant="secondary"
              >
                <RefreshCw aria-hidden="true" size={16} />
                Refresh
              </Button>
            </div>
          </div>

          {scheduleQuery.isLoading ? <div className="empty-state">Loading rota...</div> : null}
          {scheduleQuery.error ? (
            <p className="status--error">{scheduleQuery.error.message}</p>
          ) : null}
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
                            setShiftForm(shiftToForm(shift));
                          }}
                          style={{ borderLeftColor: shift.bandColour ?? '#5B90C5' }}
                          type="button"
                        >
                          <span>
                            {formatDateTime(shift.startsAt)}-{formatDateTime(shift.endsAt)}
                          </span>
                          <strong>{shift.staff?.fullName ?? 'Unassigned staff'}</strong>
                          <small>
                            <i style={{ backgroundColor: shift.bandColour ?? '#5B90C5' }} />
                            {shift.bandName ?? 'Band'}
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

      <aside className="rota-layout__side">
        <section className="panel">
          <div className="panel__body">
            <div className="section-title">
              <h2>{shiftForm.id ? 'Update shift' : 'Create shift'}</h2>
              {shiftForm.id ? <span className="badge">Editing</span> : null}
            </div>
            <form
              className="form-grid"
              onSubmit={(event) => {
                event.preventDefault();
                const payload = {
                  staffUserId: shiftForm.staffUserId,
                  yearGroupBandId: shiftForm.yearGroupBandId,
                  date: asDateTime(shiftForm.date, '00:00'),
                  startsAt: asDateTime(shiftForm.date, shiftForm.startsAt),
                  endsAt: asDateTime(shiftForm.date, shiftForm.endsAt),
                  notes: shiftForm.notes || undefined,
                };
                if (shiftForm.id) {
                  updateShift.mutate({ id: shiftForm.id, ...payload });
                } else {
                  createShift.mutate(payload);
                }
              }}
            >
              <Field label="Staff member">
                <SelectInput
                  onChange={(event) => {
                    setShiftForm({ ...shiftForm, staffUserId: event.target.value });
                  }}
                  required
                  value={shiftForm.staffUserId}
                >
                  <option value="">Choose staff</option>
                  {(staffQuery.data ?? []).map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.fullName} - {staff.role}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="Year-group band">
                <SelectInput
                  onChange={(event) => {
                    setShiftForm({ ...shiftForm, yearGroupBandId: event.target.value });
                  }}
                  required
                  value={shiftForm.yearGroupBandId}
                >
                  <option value="">Choose band</option>
                  {activeBands.map((band) => (
                    <option key={band.id} value={band.id}>
                      {band.name}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="Date">
                <TextInput
                  onChange={(event) => {
                    setShiftForm({ ...shiftForm, date: event.target.value });
                  }}
                  required
                  type="date"
                  value={shiftForm.date}
                />
              </Field>
              <div className="form-grid form-grid--two rota-time-grid">
                <Field label="Start time">
                  <TextInput
                    onChange={(event) => {
                      setShiftForm({ ...shiftForm, startsAt: event.target.value });
                    }}
                    required
                    type="time"
                    value={shiftForm.startsAt}
                  />
                </Field>
                <Field label="End time">
                  <TextInput
                    onChange={(event) => {
                      setShiftForm({ ...shiftForm, endsAt: event.target.value });
                    }}
                    required
                    type="time"
                    value={shiftForm.endsAt}
                  />
                </Field>
              </div>
              <Field label="Notes">
                <TextInput
                  onChange={(event) => {
                    setShiftForm({ ...shiftForm, notes: event.target.value });
                  }}
                  value={shiftForm.notes}
                />
              </Field>
              {mutationError ? <p className="status--error">{mutationError.message}</p> : null}
              {createShift.isSuccess || updateShift.isSuccess ? (
                <p className="status--success">Shift saved</p>
              ) : null}
              <div className="row-actions">
                {shiftForm.id ? (
                  <Button
                    onClick={() => {
                      setShiftForm({ ...emptyShiftForm, date: shiftForm.date });
                    }}
                    type="button"
                    variant="secondary"
                  >
                    <X aria-hidden="true" size={16} />
                    Cancel
                  </Button>
                ) : null}
                <Button pending={createShift.isPending || updateShift.isPending} type="submit">
                  {shiftForm.id ? (
                    <Pencil aria-hidden="true" size={16} />
                  ) : (
                    <Save aria-hidden="true" size={16} />
                  )}
                  {shiftForm.id ? 'Update shift' : 'Create shift'}
                </Button>
              </div>
            </form>
          </div>
        </section>

        <section className="panel">
          <div className="panel__body">
            <div className="section-title">
              <h2>Availability</h2>
            </div>
            {availabilityQuery.isLoading ? (
              <div className="empty-state">Loading availability...</div>
            ) : null}
            {availabilityQuery.error ? (
              <p className="status--error">{availabilityQuery.error.message}</p>
            ) : null}
            {selectedStaffAvailability ? (
              <div className="availability-list">
                <strong>{selectedStaffAvailability.fullName}</strong>
                {selectedStaffAvailability.availability.length === 0 ? (
                  <span className="muted">No availability set</span>
                ) : (
                  selectedStaffAvailability.availability.map((window) => (
                    <span
                      className="availability-pill"
                      key={`${String(window.dayOfWeek)}-${String(window.startMinute)}`}
                    >
                      {availabilityLabel(window)}
                    </span>
                  ))
                )}
              </div>
            ) : (
              <div className="availability-list">
                {staffAvailability.slice(0, 6).map((staff) => (
                  <div className="availability-row" key={staff.id}>
                    <strong>{staff.fullName}</strong>
                    <span>
                      {staff.availability.length === 0
                        ? 'No availability'
                        : staff.availability.map(availabilityLabel).join(', ')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel__body">
            <div className="section-title">
              <h2>Shift swaps</h2>
              <span className="badge">{swapsQuery.data?.length ?? 0} pending</span>
            </div>
            {swapsQuery.isLoading ? <div className="empty-state">Loading swaps...</div> : null}
            {swapsQuery.error ? <p className="status--error">{swapsQuery.error.message}</p> : null}
            {(swapsQuery.data ?? []).length === 0 ? (
              <div className="empty-state">No pending shift swaps</div>
            ) : (
              <div className="swap-list">
                {(swapsQuery.data ?? []).map((swap) => (
                  <article className="swap-card" key={swap.id}>
                    <strong>
                      {swap.requester.fullName} with {swap.targetUser.fullName}
                    </strong>
                    <span>
                      {swap.fromShift.date} {formatDateTime(swap.fromShift.startsAt)} for{' '}
                      {swap.toShift.date} {formatDateTime(swap.toShift.startsAt)}
                    </span>
                    <div className="row-actions">
                      <Button
                        onClick={() => {
                          rejectSwap.mutate({ id: swap.id });
                        }}
                        pending={rejectSwap.isPending}
                        type="button"
                        variant="secondary"
                      >
                        <X aria-hidden="true" size={16} />
                        Reject
                      </Button>
                      <Button
                        onClick={() => {
                          approveSwap.mutate({ id: swap.id });
                        }}
                        pending={approveSwap.isPending}
                        type="button"
                      >
                        <Check aria-hidden="true" size={16} />
                        Approve
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </aside>
    </div>
  );
}

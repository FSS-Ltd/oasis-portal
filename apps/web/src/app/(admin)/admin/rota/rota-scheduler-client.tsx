'use client';

import { Check, Pencil, Save, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { friendlyErrorMessage, showErrorToast, showSuccessToast } from '@/lib/notifications';
import { roleLabel } from '@/lib/profile-display';
import { api } from '@/lib/trpc';
import { MyAvailabilityEditor } from '@/components/rota/my-availability-editor';
import { MonthlyAvailabilityEditor } from '@/components/rota/monthly-availability-editor';
import { Button } from '@/components/ui/button';
import { Field, SelectInput, TextInput } from '@/components/ui/field';
import { RotaWeekSchedule } from './_components/rota-week-schedule';
import {
  addDays,
  asDateTime,
  availabilityLabel,
  dateKey,
  emptyShiftForm,
  formatDateTime,
  mondayFor,
  monthlyAvailabilityLabel,
  shiftToForm,
  today,
  type RotaShift,
  type ShiftForm,
  type StaffAvailability,
  type StaffMonthlyAvailability,
} from './_components/rota-utils';

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
  const monthlyAvailabilityQuery = api.rota.staffMonthlyAvailability.useQuery(
    { from: weekStart, to: weekEnd },
    { retry: false },
  );
  const bandsQuery = api.admin.listYearGroupBands.useQuery(undefined, { retry: false });
  const swapsQuery = api.rota.pendingSwapRequests.useQuery(undefined, { retry: false });

  const activeBands = useMemo(
    () => (bandsQuery.data ?? []).filter((band) => band.active),
    [bandsQuery.data],
  );
  const shifts = (scheduleQuery.data ?? []) as RotaShift[];
  const staffAvailability = (availabilityQuery.data ?? []) as StaffAvailability[];
  const staffMonthlyAvailability = (monthlyAvailabilityQuery.data ??
    []) as StaffMonthlyAvailability[];

  const refreshRota = async () => {
    await Promise.all([
      utils.rota.weekSchedule.invalidate({ from: weekStart, to: weekEnd }),
      utils.rota.staffAvailability.invalidate(),
      utils.rota.staffMonthlyAvailability.invalidate({ from: weekStart, to: weekEnd }),
      utils.rota.pendingSwapRequests.invalidate(),
    ]);
  };

  const createShift = api.rota.createShift.useMutation({
    async onSuccess() {
      setShiftForm({ ...emptyShiftForm, date: shiftForm.date });
      showSuccessToast('Shift saved.');
      await refreshRota();
    },
    onError(error) {
      showErrorToast(error, 'Shift could not be saved.');
    },
  });
  const updateShift = api.rota.updateShift.useMutation({
    async onSuccess() {
      setShiftForm({ ...emptyShiftForm, date: shiftForm.date });
      showSuccessToast('Shift saved.');
      await refreshRota();
    },
    onError(error) {
      showErrorToast(error, 'Shift could not be saved.');
    },
  });
  const approveSwap = api.rota.approveSwap.useMutation({
    async onSuccess() {
      showSuccessToast('Shift swap approved.');
      await refreshRota();
    },
    onError(error) {
      showErrorToast(error, 'Shift swap could not be approved.');
    },
  });
  const rejectSwap = api.rota.rejectSwap.useMutation({
    async onSuccess() {
      showSuccessToast('Shift swap rejected.');
      await refreshRota();
    },
    onError(error) {
      showErrorToast(error, 'Shift swap could not be rejected.');
    },
  });
  const deleteShift = api.rota.deleteShift.useMutation({
    async onSuccess() {
      setShiftForm({ ...emptyShiftForm, date: shiftForm.date });
      showSuccessToast('Shift removed.');
      await refreshRota();
    },
    onError(error) {
      showErrorToast(error, 'Shift could not be removed.');
    },
  });

  const selectedStaffAvailability = staffAvailability.find(
    (staff) => staff.id === shiftForm.staffUserId,
  );
  const selectedStaffMonthlyAvailability = staffMonthlyAvailability.find(
    (staff) => staff.id === shiftForm.staffUserId,
  );
  const mutationError =
    createShift.error ??
    updateShift.error ??
    deleteShift.error ??
    approveSwap.error ??
    rejectSwap.error;

  return (
    <div className="rota-layout">
      <RotaWeekSchedule
        errorMessage={scheduleQuery.error ? friendlyErrorMessage(scheduleQuery.error) : undefined}
        isFetching={scheduleQuery.isFetching}
        isLoading={scheduleQuery.isLoading}
        onNextWeek={() => {
          setWeekStart((current) => addDays(current, 7));
        }}
        onPreviousWeek={() => {
          setWeekStart((current) => addDays(current, -7));
        }}
        onRefresh={() => {
          void scheduleQuery.refetch();
        }}
        onSelectShift={(shift) => {
          setShiftForm(shiftToForm(shift));
        }}
        onThisWeek={() => {
          const nextWeek = mondayFor(today());
          setWeekStart(nextWeek);
          setShiftForm((current) => ({ ...current, date: dateKey(nextWeek) }));
        }}
        shifts={shifts}
        weekDays={weekDays}
        weekEnd={weekEnd}
        weekStart={weekStart}
      />

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
                  kind: shiftForm.kind,
                  ...(shiftForm.kind === 'Cover'
                    ? { yearGroupBandId: shiftForm.yearGroupBandId }
                    : {}),
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
              <Field label="Supervisor">
                <SelectInput
                  onChange={(event) => {
                    setShiftForm({ ...shiftForm, staffUserId: event.target.value });
                  }}
                  required
                  value={shiftForm.staffUserId}
                >
                  <option value="">Choose supervisor</option>
                  {(staffQuery.data ?? []).map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.fullName} - {roleLabel(staff.role)}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="Shift type">
                <SelectInput
                  onChange={(event) => {
                    const kind = event.target.value as ShiftForm['kind'];
                    setShiftForm({
                      ...shiftForm,
                      kind,
                      yearGroupBandId: kind === 'Meeting' ? '' : shiftForm.yearGroupBandId,
                    });
                  }}
                  required
                  value={shiftForm.kind}
                >
                  <option value="Cover">Year-group cover</option>
                  <option value="Meeting">Meeting</option>
                </SelectInput>
              </Field>
              {shiftForm.kind === 'Cover' ? (
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
              ) : null}
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
              {mutationError ? (
                <p className="status--error">{friendlyErrorMessage(mutationError)}</p>
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
                {shiftForm.id ? (
                  <Button
                    onClick={() => {
                      if (!shiftForm.id) return;
                      deleteShift.mutate({ id: shiftForm.id });
                    }}
                    pending={deleteShift.isPending}
                    type="button"
                    variant="secondary"
                  >
                    <Trash2 aria-hidden="true" size={16} />
                    Remove
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

        <MyAvailabilityEditor title="My availability" />
        <MonthlyAvailabilityEditor title="My monthly availability" />

        <section className="panel">
          <div className="panel__body">
            <div className="section-title">
              <h2>Weekly availability</h2>
            </div>
            {availabilityQuery.isLoading ? (
              <div className="empty-state">Loading availability...</div>
            ) : null}
            {availabilityQuery.error ? (
              <p className="status--error">{friendlyErrorMessage(availabilityQuery.error)}</p>
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
              <h2>Monthly availability</h2>
            </div>
            {monthlyAvailabilityQuery.isLoading ? (
              <div className="empty-state">Loading monthly availability...</div>
            ) : null}
            {monthlyAvailabilityQuery.error ? (
              <p className="status--error">
                {friendlyErrorMessage(monthlyAvailabilityQuery.error)}
              </p>
            ) : null}
            {selectedStaffMonthlyAvailability ? (
              <div className="availability-list">
                <strong>{selectedStaffMonthlyAvailability.fullName}</strong>
                {selectedStaffMonthlyAvailability.availability.length === 0 ? (
                  <span className="muted">No monthly availability set for this week</span>
                ) : (
                  selectedStaffMonthlyAvailability.availability.map((window) => (
                    <span className="availability-pill" key={window.id}>
                      {monthlyAvailabilityLabel(window)}
                    </span>
                  ))
                )}
              </div>
            ) : (
              <div className="availability-list">
                {staffMonthlyAvailability.slice(0, 6).map((staff) => (
                  <div className="availability-row" key={staff.id}>
                    <strong>{staff.fullName}</strong>
                    <span>
                      {staff.availability.length === 0
                        ? 'No monthly availability'
                        : staff.availability.map(monthlyAvailabilityLabel).join(', ')}
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
            {swapsQuery.error ? (
              <p className="status--error">{friendlyErrorMessage(swapsQuery.error)}</p>
            ) : null}
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

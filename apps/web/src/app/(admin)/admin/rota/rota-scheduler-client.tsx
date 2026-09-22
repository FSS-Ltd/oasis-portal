'use client';

import { CalendarDays, Check, HandHeart, Save } from 'lucide-react';
import { type KeyboardEvent, useMemo, useState } from 'react';
import { canManageStaffParentVolunteerAccess, type Role } from '@oasis/domain';
import { friendlyErrorMessage, showErrorToast, showSuccessToast } from '@/lib/notifications';
import { api } from '@/lib/trpc';
import { MyAvailabilityEditor } from '@/components/rota/my-availability-editor';
import { MonthlyAvailabilityEditor } from '@/components/rota/monthly-availability-editor';
import { RotaAvailabilityBoard } from './_components/rota-availability-board';
import { buildStaffAvailabilityByDay } from './_components/rota-availability-utils';
import { RotaBulkShiftEditor } from './_components/rota-bulk-shift-editor';
import { RotaShiftEditor, type RotaBatchScheduleResult } from './_components/rota-shift-editor';
import { RotaSwapReview } from './_components/rota-swap-review';
import { RotaVolunteerAccess } from './_components/rota-volunteer-access';
import { RotaWeekSchedule } from './_components/rota-week-schedule';
import {
  adminRotaWorkspaceTabs,
  nextAdminRotaWorkspaceTab,
  type AdminRotaWorkspaceTab,
} from './_components/admin-rota-workspace-tabs';
import {
  addDays,
  asDateTime,
  dateKey,
  emptyShiftForm,
  formatDateLabel,
  mondayFor,
  minuteFromTime,
  shiftToForm,
  today,
  type ParentVolunteerDay,
  type RotaShift,
  type ShiftForm,
  type StaffAvailability,
  type StaffMonthlyAvailability,
} from './_components/rota-utils';

type RotaSchedulerClientProps = {
  currentUserRole: Role;
};

export function RotaSchedulerClient({ currentUserRole }: RotaSchedulerClientProps) {
  const [activeTab, setActiveTab] = useState<AdminRotaWorkspaceTab>('week');
  const [weekStart, setWeekStart] = useState(() => mondayFor(today()));
  const [shiftForm, setShiftForm] = useState<ShiftForm>(() => ({
    ...emptyShiftForm,
    date: dateKey(addDays(mondayFor(today()), 1)),
  }));
  const [selectedDates, setSelectedDates] = useState<string[]>(() => [
    dateKey(addDays(mondayFor(today()), 1)),
  ]);
  const [repeatScope, setRepeatScope] = useState<'week' | 'term'>('week');
  const [batchScheduleResult, setBatchScheduleResult] = useState<RotaBatchScheduleResult>();
  const [selectedShiftIds, setSelectedShiftIds] = useState<string[]>([]);
  const [isBulkEditing, setIsBulkEditing] = useState(false);
  const utils = api.useUtils();
  const canManageVolunteerAccess = canManageStaffParentVolunteerAccess({ role: currentUserRole });
  const tabs = useMemo(
    () => adminRotaWorkspaceTabs(canManageVolunteerAccess),
    [canManageVolunteerAccess],
  );
  const hasVolunteerAccessTab = tabs.some((tab) => tab.id === 'volunteerAccess');

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart],
  );
  const weekEnd = weekDays[6] ?? weekStart;
  const operationalDatesQuery = api.calendar.operationalDates.useQuery(
    { dates: [...weekDays, asDateTime(shiftForm.date, '00:00')] },
    { retry: false },
  );
  const scheduleQuery = api.rota.weekSchedule.useQuery(
    { from: weekStart, to: weekEnd },
    { retry: false },
  );
  const combinedScheduleQuery = api.rota.combinedSchedule.useQuery(
    { from: weekStart, to: weekEnd },
    { retry: false },
  );
  const staffQuery = api.rota.listStaff.useQuery(undefined, { retry: false });
  const availabilityQuery = api.rota.staffAvailability.useQuery(undefined, { retry: false });
  const monthlyAvailabilityQuery = api.rota.staffMonthlyAvailability.useQuery(
    { from: weekStart, to: weekEnd },
    { retry: false },
  );
  const parentVolunteerScheduleQuery = api.rota.parentVolunteerSchedule.useQuery(
    { from: weekStart, to: weekEnd },
    { retry: false },
  );
  const bandsQuery = api.admin.listYearGroupBands.useQuery(undefined, { retry: false });
  const swapsQuery = api.rota.pendingSwapRequests.useQuery(undefined, { retry: false });

  const activeBands = useMemo(
    () => (bandsQuery.data ?? []).filter((band) => band.active),
    [bandsQuery.data],
  );
  const availableDates = useMemo(
    () =>
      (operationalDatesQuery.data ?? [])
        .filter((status) => {
          const date = new Date(`${status.date}T00:00:00.000Z`);
          return status.kind === 'operating' && date.getUTCDay() >= 2 && date.getUTCDay() <= 5;
        })
        .map((status) => {
          const date = new Date(`${status.date}T00:00:00.000Z`);
          return {
            label: `${date.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' })} ${formatDateLabel(date)}`,
            value: status.date,
          };
        }),
    [operationalDatesQuery.data],
  );
  const shifts = (scheduleQuery.data ?? []) as RotaShift[];
  const clubShifts = (combinedScheduleQuery.data ?? []).filter(
    (
      shift,
    ): shift is Extract<
      NonNullable<typeof combinedScheduleQuery.data>[number],
      { source: 'club' }
    > => shift.source === 'club',
  );
  const staffAvailability = (availabilityQuery.data ?? []) as StaffAvailability[];
  const staffMonthlyAvailability = (monthlyAvailabilityQuery.data ??
    []) as StaffMonthlyAvailability[];
  const parentVolunteers = (parentVolunteerScheduleQuery.data ?? []) as ParentVolunteerDay[];
  const staffAvailabilityByDay = useMemo(
    () => buildStaffAvailabilityByDay({ staffAvailability, staffMonthlyAvailability, weekDays }),
    [staffAvailability, staffMonthlyAvailability, weekDays],
  );
  const availabilityErrorMessage =
    availabilityQuery.error || monthlyAvailabilityQuery.error
      ? friendlyErrorMessage(availabilityQuery.error ?? monthlyAvailabilityQuery.error)
      : undefined;

  const refreshRota = async () => {
    await Promise.all([
      utils.rota.weekSchedule.invalidate({ from: weekStart, to: weekEnd }),
      utils.rota.combinedSchedule.invalidate({ from: weekStart, to: weekEnd }),
      utils.rota.staffAvailability.invalidate(),
      utils.rota.staffMonthlyAvailability.invalidate({ from: weekStart, to: weekEnd }),
      utils.rota.parentVolunteerSchedule.invalidate({ from: weekStart, to: weekEnd }),
      utils.rota.pendingSwapRequests.invalidate(),
    ]);
  };

  const createShiftBatch = api.rota.createShiftBatch.useMutation({
    async onSuccess(data) {
      setShiftForm({ ...emptyShiftForm, date: shiftForm.date });
      setSelectedDates([shiftForm.date]);
      setRepeatScope('week');
      setBatchScheduleResult({ count: data.count, dates: data.dates, skipped: data.skipped });
      showSuccessToast(
        data.skipped.length > 0
          ? `${String(data.count)} shifts saved; ${String(data.skipped.length)} dates skipped.`
          : 'Shifts saved.',
      );
      await refreshRota();
    },
    onError(error) {
      showErrorToast(error, 'Shifts could not be saved.');
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

  const bulkReassignShifts = api.rota.bulkReassignShifts.useMutation({
    async onSuccess(data) {
      setIsBulkEditing(false);
      setSelectedShiftIds([]);
      showSuccessToast(
        data.count === 1 ? '1 shift reassigned.' : `${String(data.count)} shifts reassigned.`,
      );
      await refreshRota();
    },
    onError(error) {
      showErrorToast(error, 'Selected shifts could not be reassigned.');
    },
  });
  const bulkDeleteShifts = api.rota.bulkDeleteShifts.useMutation({
    async onSuccess(data) {
      setIsBulkEditing(false);
      setSelectedShiftIds([]);
      showSuccessToast(
        data.count === 1 ? '1 shift removed.' : `${String(data.count)} shifts removed.`,
      );
      await refreshRota();
    },
    onError(error) {
      showErrorToast(error, 'Selected shifts could not be removed.');
    },
  });

  const shiftMutationError = createShiftBatch.error ?? updateShift.error ?? deleteShift.error;
  const bulkShiftMutationError = bulkReassignShifts.error ?? bulkDeleteShifts.error;

  function selectTab(event: KeyboardEvent<HTMLButtonElement>): void {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;

    event.preventDefault();
    const nextTab = nextAdminRotaWorkspaceTab(activeTab, event.key, tabs);
    if (!nextTab) return;

    setActiveTab(nextTab);
    document.getElementById(`admin-rota-tab-${nextTab}`)?.focus();
  }

  function showShiftEditor(shift?: RotaShift): void {
    if (shift) {
      setShiftForm(shiftToForm(shift));
    }
    setIsBulkEditing(false);
    setBatchScheduleResult(undefined);
    setActiveTab('week');
    requestAnimationFrame(() => {
      document.getElementById('admin-rota-tab-week')?.focus();
    });
  }

  function createShiftForDate(date: string): void {
    setIsBulkEditing(false);
    setShiftForm((current) => ({ ...current, id: null, date }));
    setSelectedDates([date]);
    setBatchScheduleResult(undefined);
  }

  function selectWeek(nextWeek: Date): void {
    const firstOperatingDate = dateKey(addDays(nextWeek, 1));
    setWeekStart(nextWeek);
    setShiftForm((current) => ({ ...current, date: firstOperatingDate }));
    setSelectedDates([firstOperatingDate]);
    setSelectedShiftIds([]);
    setIsBulkEditing(false);
  }

  function toggleShiftSelection(shiftId: string): void {
    setSelectedShiftIds((current) =>
      current.includes(shiftId)
        ? current.filter((id) => id !== shiftId)
        : [...current, shiftId],
    );
  }

  return (
    <section aria-label="Rota planning workspace" className="admin-rota-workspace">
      <div className="admin-rota-workspace__topbar">
        <div>
          <p className="staff-rota-eyebrow">Rota planning</p>
          <p className="admin-rota-workspace__summary">
            {formatDateLabel(weekStart)} - {formatDateLabel(weekEnd)}
          </p>
        </div>
        <span className="badge badge--blue">{swapsQuery.data?.length ?? 0} swap requests</span>
      </div>

      <div
        aria-label="Rota planning sections"
        className={`admin-rota-tabs${hasVolunteerAccessTab ? '' : ' admin-rota-tabs--three'}`}
        role="tablist"
      >
        {tabs.map((tab) => {
          const selected = activeTab === tab.id;
          const Icon =
            tab.id === 'week'
              ? CalendarDays
              : tab.id === 'availability'
                ? Save
                : tab.id === 'swaps'
                  ? Check
                  : HandHeart;
          return (
            <button
              aria-controls={`admin-rota-panel-${tab.id}`}
              aria-selected={selected}
              className={`admin-rota-tab${selected ? ' is-selected' : ''}`}
              id={`admin-rota-tab-${tab.id}`}
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
              }}
              onKeyDown={selectTab}
              role="tab"
              tabIndex={selected ? 0 : -1}
              type="button"
            >
              <Icon aria-hidden="true" size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div
        aria-labelledby="admin-rota-tab-week"
        className="admin-rota-panel"
        hidden={activeTab !== 'week'}
        id="admin-rota-panel-week"
        role="tabpanel"
      >
        <div className="admin-rota-planning-layout">
          <RotaWeekSchedule
            clubShifts={clubShifts}
            errorMessage={
              scheduleQuery.error || combinedScheduleQuery.error
                ? friendlyErrorMessage(scheduleQuery.error ?? combinedScheduleQuery.error)
                : undefined
            }
            isFetching={scheduleQuery.isFetching || combinedScheduleQuery.isFetching}
            isLoading={scheduleQuery.isLoading || combinedScheduleQuery.isLoading}
            isBulkActionPending={bulkDeleteShifts.isPending || bulkReassignShifts.isPending}
            dateStatuses={operationalDatesQuery.data ?? []}
            onBulkDelete={() => {
              if (
                selectedShiftIds.length >= 2 &&
                window.confirm(`Remove ${String(selectedShiftIds.length)} selected shifts?`)
              ) {
                bulkDeleteShifts.mutate({ ids: selectedShiftIds });
              }
            }}
            onBulkEdit={() => {
              if (selectedShiftIds.length >= 2) setIsBulkEditing(true);
            }}
            onClearShiftSelection={() => {
              setSelectedShiftIds([]);
              setIsBulkEditing(false);
            }}
            onCreateShift={createShiftForDate}
            onNextWeek={() => {
              selectWeek(addDays(weekStart, 7));
            }}
            onPreviousWeek={() => {
              selectWeek(addDays(weekStart, -7));
            }}
            onRefresh={() => {
              void Promise.all([scheduleQuery.refetch(), combinedScheduleQuery.refetch()]);
            }}
            onSelectShift={(shift) => {
              showShiftEditor(shift);
            }}
            onThisWeek={() => {
              selectWeek(mondayFor(today()));
            }}
            onToggleShiftSelection={toggleShiftSelection}
            parentVolunteerErrorMessage={
              parentVolunteerScheduleQuery.error
                ? friendlyErrorMessage(parentVolunteerScheduleQuery.error)
                : undefined
            }
            parentVolunteers={parentVolunteers}
            shifts={shifts}
            selectedShiftIds={selectedShiftIds}
            weekDays={weekDays}
            weekEnd={weekEnd}
            weekStart={weekStart}
          />
          {isBulkEditing ? (
            <RotaBulkShiftEditor
              errorMessage={
                bulkShiftMutationError ? friendlyErrorMessage(bulkShiftMutationError) : undefined
              }
              isSaving={bulkReassignShifts.isPending}
              onCancel={() => {
                setIsBulkEditing(false);
              }}
              onSubmit={(staffUserId) => {
                bulkReassignShifts.mutate({ ids: selectedShiftIds, staffUserId });
              }}
              selectedCount={selectedShiftIds.length}
              staff={staffQuery.data ?? []}
            />
          ) : (
            <RotaShiftEditor
              activeBands={activeBands}
              availableDates={availableDates}
              dateStatus={operationalDatesQuery.data?.find(
                (status) => status.date === shiftForm.date,
              )}
              errorMessage={shiftMutationError ? friendlyErrorMessage(shiftMutationError) : undefined}
              form={shiftForm}
              isDeleting={deleteShift.isPending}
              isSaving={createShiftBatch.isPending || updateShift.isPending}
              onCancel={() => {
                setShiftForm({ ...emptyShiftForm, date: shiftForm.date });
              }}
              onChange={(nextForm) => {
                setBatchScheduleResult(undefined);
                setShiftForm(nextForm);
              }}
              onChangeRepeatScope={(nextRepeatScope) => {
                setBatchScheduleResult(undefined);
                setRepeatScope(nextRepeatScope);
              }}
              onChangeSelectedDates={(dates) => {
                setBatchScheduleResult(undefined);
                setSelectedDates(dates);
              }}
              onDelete={() => {
                if (shiftForm.id) {
                  deleteShift.mutate({ id: shiftForm.id });
                }
              }}
              onSubmit={() => {
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
                  createShiftBatch.mutate({
                    staffUserId: shiftForm.staffUserId,
                    kind: shiftForm.kind,
                    ...(shiftForm.kind === 'Cover'
                      ? { yearGroupBandId: shiftForm.yearGroupBandId }
                      : {}),
                    dates: selectedDates,
                    startMinute: minuteFromTime(shiftForm.startsAt),
                    endMinute: minuteFromTime(shiftForm.endsAt),
                    repeatScope,
                    notes: shiftForm.notes || undefined,
                  });
                }
              }}
              repeatScope={repeatScope}
              scheduleResult={batchScheduleResult}
              selectedDates={selectedDates}
              staff={staffQuery.data ?? []}
            />
          )}
        </div>
      </div>

      <div
        aria-labelledby="admin-rota-tab-availability"
        className="admin-rota-panel admin-rota-panel--availability"
        hidden={activeTab !== 'availability'}
        id="admin-rota-panel-availability"
        role="tabpanel"
      >
        <RotaAvailabilityBoard
          errorMessage={availabilityErrorMessage}
          isLoading={availabilityQuery.isLoading || monthlyAvailabilityQuery.isLoading}
          staffAvailabilityByDay={staffAvailabilityByDay}
          weekDays={weekDays}
        />
        <div className="admin-rota-personal-availability">
          <MyAvailabilityEditor title="Set my weekly availability" />
          <MonthlyAvailabilityEditor title="Set my unavailable dates" />
        </div>
      </div>

      <div
        aria-labelledby="admin-rota-tab-swaps"
        className="admin-rota-panel"
        hidden={activeTab !== 'swaps'}
        id="admin-rota-panel-swaps"
        role="tabpanel"
      >
        <RotaSwapReview
          errorMessage={swapsQuery.error ? friendlyErrorMessage(swapsQuery.error) : undefined}
          isApproving={approveSwap.isPending}
          isLoading={swapsQuery.isLoading}
          isRejecting={rejectSwap.isPending}
          onApprove={(id) => {
            approveSwap.mutate({ id });
          }}
          onReject={(id) => {
            rejectSwap.mutate({ id });
          }}
          swaps={swapsQuery.data ?? []}
        />
      </div>

      {hasVolunteerAccessTab ? (
        <div
          aria-labelledby="admin-rota-tab-volunteerAccess"
          className="admin-rota-panel"
          hidden={activeTab !== 'volunteerAccess'}
          id="admin-rota-panel-volunteerAccess"
          role="tabpanel"
        >
          <RotaVolunteerAccess />
        </div>
      ) : null}
    </section>
  );
}

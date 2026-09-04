'use client';

import { CalendarDays, Check, HandHeart, Pencil, Save } from 'lucide-react';
import { type KeyboardEvent, useMemo, useState } from 'react';
import { canManageStaffParentVolunteerAccess, type Role } from '@oasis/domain';
import { friendlyErrorMessage, showErrorToast, showSuccessToast } from '@/lib/notifications';
import { api } from '@/lib/trpc';
import { MyAvailabilityEditor } from '@/components/rota/my-availability-editor';
import { MonthlyAvailabilityEditor } from '@/components/rota/monthly-availability-editor';
import { RotaAvailabilityBoard } from './_components/rota-availability-board';
import { buildStaffAvailabilityByDay } from './_components/rota-availability-utils';
import { RotaShiftEditor } from './_components/rota-shift-editor';
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
    date: dateKey(mondayFor(today())),
  }));
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
  const shifts = (scheduleQuery.data ?? []) as RotaShift[];
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
      utils.rota.staffAvailability.invalidate(),
      utils.rota.staffMonthlyAvailability.invalidate({ from: weekStart, to: weekEnd }),
      utils.rota.parentVolunteerSchedule.invalidate({ from: weekStart, to: weekEnd }),
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

  const shiftMutationError = createShift.error ?? updateShift.error ?? deleteShift.error;

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
    setActiveTab('shifts');
    requestAnimationFrame(() => {
      document.getElementById('admin-rota-tab-shifts')?.focus();
    });
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
        className={`admin-rota-tabs${hasVolunteerAccessTab ? '' : ' admin-rota-tabs--four'}`}
        role="tablist"
      >
        {tabs.map((tab) => {
          const selected = activeTab === tab.id;
          const Icon =
            tab.id === 'week'
              ? CalendarDays
              : tab.id === 'shifts'
                ? Pencil
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
            showShiftEditor(shift);
          }}
          onThisWeek={() => {
            const nextWeek = mondayFor(today());
            setWeekStart(nextWeek);
            setShiftForm((current) => ({ ...current, date: dateKey(nextWeek) }));
          }}
          parentVolunteerErrorMessage={
            parentVolunteerScheduleQuery.error
              ? friendlyErrorMessage(parentVolunteerScheduleQuery.error)
              : undefined
          }
          parentVolunteers={parentVolunteers}
          shifts={shifts}
          weekDays={weekDays}
          weekEnd={weekEnd}
          weekStart={weekStart}
        />
      </div>

      <div
        aria-labelledby="admin-rota-tab-shifts"
        className="admin-rota-panel"
        hidden={activeTab !== 'shifts'}
        id="admin-rota-panel-shifts"
        role="tabpanel"
      >
        <RotaShiftEditor
          activeBands={activeBands}
          errorMessage={shiftMutationError ? friendlyErrorMessage(shiftMutationError) : undefined}
          form={shiftForm}
          isDeleting={deleteShift.isPending}
          isSaving={createShift.isPending || updateShift.isPending}
          onCancel={() => {
            setShiftForm({ ...emptyShiftForm, date: shiftForm.date });
          }}
          onChange={setShiftForm}
          onDelete={() => {
            if (shiftForm.id) {
              deleteShift.mutate({ id: shiftForm.id });
            }
          }}
          onSubmit={() => {
            const payload = {
              staffUserId: shiftForm.staffUserId,
              kind: shiftForm.kind,
              ...(shiftForm.kind === 'Cover' ? { yearGroupBandId: shiftForm.yearGroupBandId } : {}),
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
          staff={staffQuery.data ?? []}
        />
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

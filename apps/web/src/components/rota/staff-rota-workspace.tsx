'use client';

import { type KeyboardEvent, useMemo, useState } from 'react';
import { CalendarDays, Save, Send } from 'lucide-react';
import { friendlyErrorMessage, showErrorToast, showSuccessToast } from '@/lib/notifications';
import { api } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Field, SelectInput } from '@/components/ui/field';
import { MonthlyAvailabilityEditor } from './monthly-availability-editor';
import { MyAvailabilityEditor } from './my-availability-editor';
import { StaffRotaSchedule } from './staff-rota-schedule';
import {
  nextStaffRotaWorkspaceTab,
  staffRotaWorkspaceTabs,
  type StaffRotaWorkspaceTab,
} from './staff-rota-workspace-tabs';
import {
  addDays,
  asDate,
  dateKey,
  formatShift,
  mondayFor,
  todayKey,
} from '@/app/(supervisor)/supervisor/_components/supervisor-utils';

export function StaffRotaWorkspace() {
  const utils = api.useUtils();
  const [activeTab, setActiveTab] = useState<StaffRotaWorkspaceTab>('schedule');
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [swapForm, setSwapForm] = useState({ fromShiftId: '', toShiftId: '' });
  const date = useMemo(() => asDate(selectedDate), [selectedDate]);
  const weekStart = useMemo(() => mondayFor(date), [date]);
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart],
  );

  const myRotaQuery = api.rota.myRota.useQuery({ from: weekStart, to: weekEnd }, { retry: false });
  const myCombinedRotaQuery = api.rota.myCombinedSchedule.useQuery(
    { from: weekStart, to: weekEnd },
    { retry: false },
  );
  const teamScheduleQuery = api.rota.teamSchedule.useQuery(
    { from: weekStart, to: weekEnd },
    { retry: false },
  );
  const parentVolunteerScheduleQuery = api.rota.parentVolunteerSchedule.useQuery(
    { from: weekStart, to: weekEnd },
    { retry: false },
  );
  const swapCandidatesQuery = api.rota.swapCandidates.useQuery(
    { from: weekStart, to: weekEnd },
    { retry: false },
  );

  const requestSwap = api.rota.requestSwap.useMutation({
    onSuccess: async () => {
      showSuccessToast('Shift swap request sent for Head review.');
      setSwapForm({ fromShiftId: '', toShiftId: '' });
      await Promise.all([
        utils.rota.myRota.invalidate({ from: weekStart, to: weekEnd }),
        utils.rota.myCombinedSchedule.invalidate({ from: weekStart, to: weekEnd }),
        utils.rota.swapCandidates.invalidate({ from: weekStart, to: weekEnd }),
      ]);
    },
    onError: (error) => {
      showErrorToast(error, 'Shift swap request could not be sent.');
    },
  });

  const scheduleError = [
    myRotaQuery.error,
    myCombinedRotaQuery.error,
    teamScheduleQuery.error,
    parentVolunteerScheduleQuery.error,
  ]
    .map((error) => (error ? friendlyErrorMessage(error) : null))
    .find((error): error is string => error !== null);
  const isScheduleLoading =
    myCombinedRotaQuery.isLoading ||
    teamScheduleQuery.isLoading ||
    parentVolunteerScheduleQuery.isLoading;
  const myShifts = myCombinedRotaQuery.data ?? [];
  const teamShifts = teamScheduleQuery.data ?? [];
  const parentVolunteers = parentVolunteerScheduleQuery.data ?? [];
  const swapCandidates = swapCandidatesQuery.data ?? [];

  function selectTab(event: KeyboardEvent<HTMLButtonElement>): void {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;

    event.preventDefault();
    const nextTab = nextStaffRotaWorkspaceTab(activeTab, event.key);
    if (!nextTab) return;

    setActiveTab(nextTab);
    document.getElementById(`staff-rota-tab-${nextTab}`)?.focus();
  }

  return (
    <section aria-label="Staff rota workspace" className="staff-rota-workspace">
      <div className="staff-rota-workspace__topbar">
        <div>
          <p className="staff-rota-eyebrow">Your weekly rota</p>
          <p className="staff-rota-workspace__summary">
            {dateKey(weekStart)} to {dateKey(weekEnd)}
          </p>
        </div>
        <span className="badge badge--blue">Weekly planning</span>
      </div>

      <div aria-label="Rota workspace sections" className="staff-rota-tabs" role="tablist">
        {staffRotaWorkspaceTabs.map((tab) => {
          const selected = activeTab === tab.id;
          const Icon =
            tab.id === 'schedule' ? CalendarDays : tab.id === 'availability' ? Save : Send;
          return (
            <button
              aria-controls={`staff-rota-panel-${tab.id}`}
              aria-selected={selected}
              className={`staff-rota-tab${selected ? ' is-selected' : ''}`}
              id={`staff-rota-tab-${tab.id}`}
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
        aria-labelledby="staff-rota-tab-schedule"
        className="staff-rota-panel"
        hidden={activeTab !== 'schedule'}
        id="staff-rota-panel-schedule"
        role="tabpanel"
      >
        <StaffRotaSchedule
          isLoading={isScheduleLoading}
          myShifts={myShifts}
          onSelectDate={setSelectedDate}
          parentVolunteers={parentVolunteers}
          queryError={scheduleError}
          selectedDate={selectedDate}
          teamShifts={teamShifts}
          weekDays={weekDays}
        />
      </div>

      <div
        aria-labelledby="staff-rota-tab-availability"
        className="staff-rota-panel staff-rota-panel--settings"
        hidden={activeTab !== 'availability'}
        id="staff-rota-panel-availability"
        role="tabpanel"
      >
        <MyAvailabilityEditor />
        <MonthlyAvailabilityEditor />
      </div>

      <section
        aria-labelledby="staff-rota-tab-swap"
        className="panel panel__body staff-rota-swap-panel"
        hidden={activeTab !== 'swap'}
        id="staff-rota-panel-swap"
        role="tabpanel"
      >
        <div className="section-title">
          <div>
            <p className="staff-rota-eyebrow">Keep the team covered</p>
            <h2>Request a shift swap</h2>
            <p className="muted">
              Choose a shift this week and a colleague&apos;s available shift.
            </p>
          </div>
        </div>

        <div className="staff-rota-swap-panel__form">
          <Field label="Your shift">
            <SelectInput
              aria-label="Your shift to swap"
              onChange={(event) => {
                setSwapForm((form) => ({ ...form, fromShiftId: event.target.value }));
              }}
              value={swapForm.fromShiftId}
            >
              <option value="">Choose your shift</option>
              {(myRotaQuery.data ?? []).map((shift) => (
                <option key={shift.id} value={shift.id}>
                  {formatShift(shift)}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Requested shift">
            <SelectInput
              aria-label="Requested shift to swap with"
              onChange={(event) => {
                setSwapForm((form) => ({ ...form, toShiftId: event.target.value }));
              }}
              value={swapForm.toShiftId}
            >
              <option value="">Choose another supervisor shift</option>
              {swapCandidates.map((shift) => (
                <option key={shift.id} value={shift.id}>
                  {shift.staff?.fullName ?? 'Supervisor'} · {formatShift(shift)}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Button
            disabled={!swapForm.fromShiftId || !swapForm.toShiftId}
            onClick={() => {
              requestSwap.mutate(swapForm);
            }}
            pending={requestSwap.isPending}
            type="button"
          >
            <Send aria-hidden="true" size={16} />
            Send request
          </Button>
        </div>

        {swapCandidatesQuery.error ? (
          <p className="status--error">{friendlyErrorMessage(swapCandidatesQuery.error)}</p>
        ) : null}
        {!swapCandidatesQuery.isLoading && swapCandidates.length === 0 ? (
          <p className="muted">No other supervisor shifts are available this week.</p>
        ) : null}
        {requestSwap.error ? (
          <p className="status--error">{friendlyErrorMessage(requestSwap.error)}</p>
        ) : null}
      </section>
    </section>
  );
}

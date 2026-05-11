'use client';

import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Save, Send } from 'lucide-react';
import { displaySchoolYearLabel } from '@oasis/domain';
import { api } from '@/lib/trpc';
import { AttendanceCapture } from '@/components/attendance/attendance-capture';
import { MyAvailabilityEditor } from '@/components/rota/my-availability-editor';
import { Button } from '@/components/ui/button';
import { Field, SelectInput, TextInput } from '@/components/ui/field';
import { SupervisorDashboardOverview } from './_components/supervisor-dashboard-overview';
import {
  addDays,
  asDate,
  dateKey,
  formatDateTime,
  formatShift,
  formatShortDateTime,
  messageDashboardAdapter,
  mondayFor,
  todayKey,
  type BehaviourType,
  type BehaviourVisibility,
} from './_components/supervisor-utils';

type SupervisorDashboardClientProps = {
  canExportAttendance: boolean;
  canRecordAttendance?: boolean;
  view?: 'dashboard' | 'attendance' | 'behaviour' | 'rota';
};

export function SupervisorDashboardClient({
  canExportAttendance,
  canRecordAttendance = false,
  view = 'dashboard',
}: SupervisorDashboardClientProps) {
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [swapForm, setSwapForm] = useState({ fromShiftId: '', toShiftId: '' });
  const [behaviourForm, setBehaviourForm] = useState({
    type: 'Merit' as BehaviourType,
    visibility: 'General' as BehaviourVisibility,
    category: '',
    note: '',
    amount: '1',
  });
  const [swapStatus, setSwapStatus] = useState<string | null>(null);
  const [behaviourStatus, setBehaviourStatus] = useState<string | null>(null);

  const date = useMemo(() => asDate(selectedDate), [selectedDate]);
  const weekStart = useMemo(() => mondayFor(date), [date]);
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);
  const utils = api.useUtils();

  const usesStudentRoster = view === 'dashboard' || view === 'attendance' || view === 'behaviour';
  const usesRota = view === 'dashboard' || view === 'rota';

  const attendanceRosterQuery = api.attendance.forDate.useQuery(
    { date },
    { enabled: usesStudentRoster, retry: false },
  );
  const todayRotaQuery = api.rota.myRota.useQuery(
    { from: date, to: date },
    { enabled: usesRota, retry: false },
  );
  const weekRotaQuery = api.rota.myRota.useQuery(
    { from: weekStart, to: weekEnd },
    { enabled: usesRota, retry: false },
  );
  const teamScheduleQuery = api.rota.teamSchedule.useQuery(
    { from: weekStart, to: weekEnd },
    { enabled: view === 'rota', retry: false },
  );
  const swapCandidatesQuery = api.rota.swapCandidates.useQuery(
    { from: weekStart, to: weekEnd },
    { enabled: view === 'rota', retry: false },
  );
  const mySwapRequestsQuery = api.rota.mySwapRequests.useQuery(undefined, {
    enabled: view === 'dashboard',
    retry: false,
  });
  const dashboardActivityQuery = api.behaviour.dashboardActivity.useQuery(
    { date },
    { enabled: view === 'dashboard', retry: false },
  );
  const noticesQuery = api.notice.listForStaff.useQuery(undefined, {
    enabled: view === 'dashboard',
    retry: false,
  });
  const behaviourQuery = api.behaviour.listForStudent.useQuery(
    { studentId: selectedStudentId, includeSensitive: false, date },
    { enabled: view === 'behaviour' && selectedStudentId.length > 0, retry: false },
  );

  const selectedStudent =
    attendanceRosterQuery.data?.find((student) => student.studentId === selectedStudentId) ?? null;

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
  const logBehaviour = api.behaviour.log.useMutation({
    onSuccess: async (_result, input) => {
      setBehaviourStatus(
        input.visibility === 'Sensitive'
          ? 'Sensitive demerit saved. Head, Head of Discipline, and you can view it.'
          : 'Behaviour saved.',
      );
      setBehaviourForm((current) => ({
        ...current,
        category: '',
        note: '',
        amount: current.type === 'Merit' ? current.amount : '1',
      }));
      await utils.behaviour.listForStudent.invalidate({
        studentId: input.studentId,
        includeSensitive: false,
        date,
      });
    },
  });

  useEffect(() => {
    const rows = attendanceRosterQuery.data ?? [];
    if (selectedStudentId || rows.length === 0) return;
    setSelectedStudentId(rows[0]?.studentId ?? '');
  }, [attendanceRosterQuery.data, selectedStudentId]);

  const todayShifts = todayRotaQuery.data ?? [];
  const weekShifts = weekRotaQuery.data ?? [];
  const teamShifts = teamScheduleQuery.data ?? [];
  const swapCandidates = swapCandidatesQuery.data ?? [];
  const mySwapRequests = mySwapRequestsQuery.data ?? [];
  const behaviourEntries = behaviourQuery.data?.entries ?? [];
  const rosterRows = attendanceRosterQuery.data ?? [];
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart],
  );
  const dashboardMessages = useMemo(() => messageDashboardAdapter(), []);
  const dashboardNotices = useMemo(
    () =>
      (noticesQuery.data ?? []).slice(0, 4).map((notice) => ({
        id: notice.id,
        title: notice.title,
        bodyPreview: notice.body.length > 96 ? `${notice.body.slice(0, 93)}...` : notice.body,
        postedAt: notice.createdAt,
        read: notice.read,
      })),
    [noticesQuery.data],
  );
  const dashboardActivity = dashboardActivityQuery.data?.entries ?? [];
  const presentCount = rosterRows.filter((row) => row.status === 'Present').length;
  const absentCount = rosterRows.filter((row) => row.status === 'Absent').length;
  const lateCount = rosterRows.filter((row) => row.status === 'Late').length;
  const totalStudents = rosterRows.length;
  const openItems = dashboardMessages.length + mySwapRequests.length;
  const unreadNotices = dashboardNotices.filter((notice) => !notice.read).length;

  function handleStudentChange(studentId: string): void {
    setSelectedStudentId(studentId);
    setBehaviourStatus(null);
  }

  async function submitBehaviour(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedStudentId) return;

    setBehaviourStatus(null);
    await logBehaviour.mutateAsync({
      studentId: selectedStudentId,
      type: behaviourForm.type,
      visibility: behaviourForm.visibility,
      category: behaviourForm.category,
      note: behaviourForm.note.trim() ? behaviourForm.note : undefined,
      ...(behaviourForm.type === 'Merit' ? { amount: Number(behaviourForm.amount) } : {}),
    });
  }

  if (view === 'dashboard') {
    return (
      <SupervisorDashboardOverview
        absentCount={absentCount}
        attendanceError={attendanceRosterQuery.error?.message}
        dashboardActivity={dashboardActivity}
        dashboardActivityError={dashboardActivityQuery.error?.message}
        dashboardActivityLoading={dashboardActivityQuery.isLoading}
        dashboardMessages={dashboardMessages}
        dashboardNotices={dashboardNotices}
        dashboardNoticesError={noticesQuery.error?.message}
        dashboardNoticesLoading={noticesQuery.isLoading}
        date={date}
        lateCount={lateCount}
        mySwapRequests={mySwapRequests}
        mySwapRequestsError={mySwapRequestsQuery.error?.message}
        mySwapRequestsLoading={mySwapRequestsQuery.isLoading}
        openItems={openItems}
        presentCount={presentCount}
        todayShifts={todayShifts}
        totalStudents={totalStudents}
        unreadNotices={unreadNotices}
        weekDays={weekDays}
        weekEnd={weekEnd}
        weekRotaError={weekRotaQuery.error?.message}
        weekShifts={weekShifts}
        weekStart={weekStart}
      />
    );
  }

  return (
    <div className="supervisor-layout">
      <section className="supervisor-layout__main">
        {view === 'attendance' ? (
          <section className="panel panel__body" id="attendance-capture">
            <div className="section-title">
              <div>
                <h2>Attendance capture</h2>
                <p className="muted">
                  Mark the daily register and filter students by configured year-group bands.
                </p>
              </div>
              <span className="badge badge--blue">Student register</span>
            </div>
            <AttendanceCapture
              canExport={canExportAttendance}
              canRecord={canRecordAttendance}
              emptyMessage="Head of Centre can add students to populate the register."
              onSelectedDateChange={setSelectedDate}
              selectedDate={selectedDate}
              showBandFilter
            />
          </section>
        ) : null}

        {view === 'behaviour' ? (
          <section className="panel panel__body supervisor-workflow" id="behaviour-entry">
            <div className="section-title">
              <div>
                <h2>Behaviour entry</h2>
                <p className="muted">
                  Record merits, demerits, and visibility-controlled notes for the selected student.
                </p>
              </div>
              <span className="badge badge--blue">Merit workflow</span>
            </div>

            <div className="supervisor-selected-student">
              <Field label="Selected student">
                <SelectInput
                  aria-label="Selected student for behaviour"
                  disabled={
                    attendanceRosterQuery.isLoading ||
                    (attendanceRosterQuery.data ?? []).length === 0
                  }
                  onChange={(event) => {
                    handleStudentChange(event.target.value);
                  }}
                  value={selectedStudentId}
                >
                  <option value="">Choose a student</option>
                  {(attendanceRosterQuery.data ?? []).map((student) => (
                    <option key={student.studentId} value={student.studentId}>
                      {student.studentName} · {displaySchoolYearLabel(student.yearGroup)}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              {selectedStudent ? (
                <div className="student-context-card">
                  <strong>{selectedStudent.studentName}</strong>
                  <span>{displaySchoolYearLabel(selectedStudent.yearGroup)}</span>
                  <span>{selectedStudent.status ?? 'Attendance unmarked'}</span>
                </div>
              ) : null}
            </div>
            {attendanceRosterQuery.error ? (
              <p className="status--error">{attendanceRosterQuery.error.message}</p>
            ) : null}

            <div className="supervisor-workflow-grid">
              <form
                className="form-grid"
                onSubmit={(event) => {
                  void submitBehaviour(event);
                }}
              >
                <div className="form-grid form-grid--two">
                  <Field label="Type">
                    <SelectInput
                      aria-label="Behaviour type"
                      onChange={(event) => {
                        const nextType = event.target.value as BehaviourType;
                        setBehaviourForm((form) => ({
                          ...form,
                          type: nextType,
                          visibility:
                            nextType === 'Merit' && form.visibility === 'Sensitive'
                              ? 'General'
                              : form.visibility,
                        }));
                      }}
                      value={behaviourForm.type}
                    >
                      <option value="Merit">Merit</option>
                      <option value="Demerit">Demerit</option>
                    </SelectInput>
                  </Field>
                  <Field label="Visibility">
                    <SelectInput
                      aria-label="Behaviour visibility"
                      onChange={(event) => {
                        setBehaviourForm((form) => ({
                          ...form,
                          visibility: event.target.value as BehaviourVisibility,
                        }));
                      }}
                      value={behaviourForm.visibility}
                    >
                      <option value="General">General</option>
                      <option disabled={behaviourForm.type === 'Merit'} value="Sensitive">
                        Sensitive
                      </option>
                    </SelectInput>
                  </Field>
                </div>
                <Field label="Category">
                  <TextInput
                    aria-label="Behaviour category"
                    maxLength={120}
                    onChange={(event) => {
                      setBehaviourForm((form) => ({ ...form, category: event.target.value }));
                    }}
                    required
                    value={behaviourForm.category}
                  />
                </Field>
                {behaviourForm.type === 'Merit' ? (
                  <Field label="Merit amount">
                    <TextInput
                      aria-label="Merit amount"
                      min={1}
                      onChange={(event) => {
                        setBehaviourForm((form) => ({ ...form, amount: event.target.value }));
                      }}
                      required
                      type="number"
                      value={behaviourForm.amount}
                    />
                  </Field>
                ) : null}
                <Field
                  label="Note"
                  hint="Sensitive demerits are visible to Head, Head of Discipline, and the supervisor who recorded them."
                >
                  <textarea
                    aria-label="Behaviour note"
                    className="input textarea"
                    maxLength={2000}
                    onChange={(event) => {
                      setBehaviourForm((form) => ({ ...form, note: event.target.value }));
                    }}
                    rows={4}
                    value={behaviourForm.note}
                  />
                </Field>
                <Button
                  disabled={!selectedStudentId}
                  pending={logBehaviour.isPending}
                  type="submit"
                >
                  <Save aria-hidden="true" size={16} />
                  Save behaviour
                </Button>
                {behaviourStatus ? <p className="status--success">{behaviourStatus}</p> : null}
                {logBehaviour.error ? (
                  <p className="status--error">{logBehaviour.error.message}</p>
                ) : null}
              </form>

              <div className="activity-list" aria-label="Student behaviour activity">
                <h3>General activity</h3>
                {behaviourQuery.isLoading ? (
                  <div className="empty-state">Loading behaviour...</div>
                ) : null}
                {behaviourQuery.error ? (
                  <p className="status--error">{behaviourQuery.error.message}</p>
                ) : null}
                {!behaviourQuery.isLoading && selectedStudentId && behaviourEntries.length === 0 ? (
                  <div className="empty-state">No General behaviour entries yet.</div>
                ) : null}
                {behaviourEntries.map((entry) => (
                  <article className="activity-row" key={entry.id}>
                    <span
                      className={
                        entry.type === 'Merit' ? 'badge badge--green' : 'badge badge--amber'
                      }
                    >
                      {entry.type}
                    </span>
                    <div>
                      <strong>{entry.category}</strong>
                      <span>
                        {entry.meritDelta > 0
                          ? `+${String(entry.meritDelta)}`
                          : String(entry.meritDelta)}{' '}
                        · {formatShortDateTime(entry.createdAt)}
                      </span>
                      {entry.note ? <p>{entry.note}</p> : null}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {view === 'rota' ? (
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
                {todayRotaQuery.isLoading ? (
                  <div className="empty-state">Loading today&apos;s rota...</div>
                ) : null}
                {todayRotaQuery.error ? (
                  <p className="status--error">{todayRotaQuery.error.message}</p>
                ) : null}
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
                <h3>Team this week</h3>
                {teamScheduleQuery.isLoading ? (
                  <div className="empty-state">Loading team rota...</div>
                ) : null}
                {teamScheduleQuery.error ? (
                  <p className="status--error">{teamScheduleQuery.error.message}</p>
                ) : null}
                {!teamScheduleQuery.isLoading && teamShifts.length === 0 ? (
                  <div className="empty-state">No team shifts scheduled this week.</div>
                ) : (
                  <div className="rota-shift-list">
                    {teamShifts.map((shift) => (
                      <article
                        className="rota-shift"
                        key={shift.id}
                        style={{ borderLeftColor: shift.bandColour ?? undefined }}
                      >
                        <strong>
                          {shift.staff?.fullName ?? 'Staff'} · {shift.bandName ?? 'Unassigned band'}
                        </strong>
                        <span>{formatShift(shift)}</span>
                        {shift.notes ? <em>{shift.notes}</em> : null}
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        ) : null}
      </section>

      {view === 'rota' ? (
        <aside className="supervisor-layout__side">
          <MyAvailabilityEditor />

          <section className="panel panel__body">
            <div className="section-title">
              <h2>Request shift swap</h2>
            </div>

            <div className="form-grid">
              <Field label="Your shift">
                <SelectInput
                  aria-label="Your shift to swap"
                  onChange={(event) => {
                    setSwapForm((form) => ({ ...form, fromShiftId: event.target.value }));
                  }}
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
            </div>

            {swapCandidatesQuery.error ? (
              <p className="status--error">{swapCandidatesQuery.error.message}</p>
            ) : null}
            {!swapCandidatesQuery.isLoading && swapCandidates.length === 0 ? (
              <p className="muted">No other supervisor shifts are available in this week.</p>
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
            {requestSwap.error ? (
              <p className="status--error">{requestSwap.error.message}</p>
            ) : null}
          </section>
        </aside>
      ) : null}
    </div>
  );
}

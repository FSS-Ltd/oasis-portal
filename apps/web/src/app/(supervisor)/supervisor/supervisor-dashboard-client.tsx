'use client';

import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Plus, Save, Send, Trash2 } from 'lucide-react';
import { displaySchoolYearLabel } from '@oasis/domain';
import { api } from '@/lib/trpc';
import { AttendanceCapture } from '@/components/attendance/attendance-capture';
import { BehaviourStudentSelector } from '@/components/behaviour/behaviour-student-selector';
import {
  DailyDemeritBadge,
  useDailyDemeritStatusMap,
} from '@/components/behaviour/daily-demerit-badge';
import { MyAvailabilityEditor } from '@/components/rota/my-availability-editor';
import { Button } from '@/components/ui/button';
import { Field, SelectInput, TextInput } from '@/components/ui/field';
import { friendlyErrorMessage, showErrorToast, showSuccessToast } from '@/lib/notifications';
import { SupervisorDashboardOverview } from './_components/supervisor-dashboard-overview';
import {
  addDays,
  asDate,
  batchBehaviourSuccessMessage,
  behaviourLogSuccessMessage,
  dateKey,
  formatDateTime,
  formatShift,
  formatShortDateTime,
  messageDashboardAdapter,
  mondayFor,
  todayKey,
  type BatchBehaviourType,
  type BehaviourType,
  type BehaviourVisibility,
} from './_components/supervisor-utils';

type SupervisorDashboardClientProps = {
  canExportAttendance: boolean;
  canRecordAttendance?: boolean;
  view?: 'dashboard' | 'attendance' | 'behaviour' | 'rota';
};

type EntryMode = 'single' | 'batch';

interface BatchEntryForm {
  id: string;
  category: string;
  note: string;
  amount: string;
  count: string;
}

function newBatchEntry(): BatchEntryForm {
  return {
    id: crypto.randomUUID(),
    category: '',
    note: '',
    amount: '1',
    count: '1',
  };
}

function totalBatchEntries(entries: readonly BatchEntryForm[]): number {
  return entries.reduce((sum, entry) => sum + (Number(entry.count) || 0), 0);
}

export function SupervisorDashboardClient({
  canExportAttendance,
  canRecordAttendance = false,
  view = 'dashboard',
}: SupervisorDashboardClientProps) {
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [entryMode, setEntryMode] = useState<EntryMode>('single');
  const [batchType, setBatchType] = useState<BatchBehaviourType>('Merit');
  const [batchEntries, setBatchEntries] = useState<BatchEntryForm[]>(() => [newBatchEntry()]);
  const [swapForm, setSwapForm] = useState({ fromShiftId: '', toShiftId: '' });
  const [behaviourForm, setBehaviourForm] = useState({
    type: 'Merit' as BehaviourType,
    visibility: 'General' as BehaviourVisibility,
    category: '',
    note: '',
    amount: '1',
  });

  const date = useMemo(() => asDate(selectedDate), [selectedDate]);
  const weekStart = useMemo(() => mondayFor(date), [date]);
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);
  const utils = api.useUtils();

  const usesStudentRoster = view === 'dashboard' || view === 'attendance' || view === 'behaviour';
  const usesRota = view === 'dashboard' || view === 'rota';
  const demeritStatusQuery = useDailyDemeritStatusMap(date, usesStudentRoster);

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
    { studentId: selectedStudentIds[0] ?? '', includeSensitive: false, date },
    { enabled: view === 'behaviour' && selectedStudentIds.length > 0, retry: false },
  );

  const selectedStudent =
    attendanceRosterQuery.data?.find((student) => student.studentId === selectedStudentIds[0]) ??
    null;

  const requestSwap = api.rota.requestSwap.useMutation({
    onSuccess: async () => {
      showSuccessToast('Shift swap request sent for Head review.');
      setSwapForm({ fromShiftId: '', toShiftId: '' });
      await Promise.all([
        utils.rota.myRota.invalidate({ from: weekStart, to: weekEnd }),
        utils.rota.swapCandidates.invalidate({ from: weekStart, to: weekEnd }),
      ]);
    },
    onError: (error) => {
      showErrorToast(error, 'Shift swap request could not be sent.');
    },
  });
  const logBehaviour = api.behaviour.logForStudents.useMutation({
    onSuccess: async (_result, input) => {
      showSuccessToast(behaviourLogSuccessMessage(input));
      setBehaviourForm((current) => ({
        ...current,
        category: '',
        note: '',
        amount: current.type === 'Demerit' ? '1' : current.amount,
        visibility: current.type === 'General' ? 'Sensitive' : current.visibility,
      }));
      await Promise.all([
        ...input.studentIds.map((studentId) =>
          utils.behaviour.listForStudent.invalidate({
            studentId,
            includeSensitive: false,
            date,
          }),
        ),
        utils.behaviour.dailyDemeritStatuses.invalidate({ date }),
        utils.childLog.supervisorNotesHistory.invalidate(),
      ]);
    },
    onError: (error) => {
      showErrorToast(error, 'Behaviour could not be saved.');
    },
  });
  const logManyBehaviour = api.behaviour.logManyForStudents.useMutation({
    onSuccess: async (_result, input) => {
      showSuccessToast(batchBehaviourSuccessMessage(input));
      setBatchEntries([newBatchEntry()]);
      await Promise.all([
        ...input.studentIds.map((studentId) =>
          utils.behaviour.listForStudent.invalidate({
            studentId,
            includeSensitive: false,
            date,
          }),
        ),
        utils.behaviour.dailyDemeritStatuses.invalidate({ date }),
        utils.childLog.supervisorNotesHistory.invalidate(),
      ]);
    },
    onError: (error) => {
      showErrorToast(error, 'Behaviour entries could not be saved.');
    },
  });

  useEffect(() => {
    const rows = attendanceRosterQuery.data ?? [];
    if (selectedStudentIds.length > 0 || rows.length === 0) return;
    setSelectedStudentIds(rows[0] ? [rows[0].studentId] : []);
  }, [attendanceRosterQuery.data, selectedStudentIds.length]);

  const todayShifts = todayRotaQuery.data ?? [];
  const weekShifts = weekRotaQuery.data ?? [];
  const teamShifts = teamScheduleQuery.data ?? [];
  const swapCandidates = swapCandidatesQuery.data ?? [];
  const mySwapRequests = mySwapRequestsQuery.data ?? [];
  const behaviourEntries = behaviourQuery.data?.entries ?? [];
  const rosterRows = useMemo(() => attendanceRosterQuery.data ?? [], [attendanceRosterQuery.data]);
  const rosterStudentIds = useMemo(
    () => rosterRows.map((student) => student.studentId),
    [rosterRows],
  );
  const rosterStudentOptions = useMemo(
    () =>
      rosterRows.map((student) => ({
        id: student.studentId,
        label: student.studentName,
        description: displaySchoolYearLabel(student.yearGroup),
        demeritStatus: demeritStatusQuery.statusByStudentId.get(student.studentId),
      })),
    [demeritStatusQuery.statusByStudentId, rosterRows],
  );
  const selectedStudentCount = selectedStudentIds.length;
  const batchEntryCount = totalBatchEntries(batchEntries);
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
  const onTimeCount = rosterRows.filter((row) => row.status === 'Present').length;
  const absentCount = rosterRows.filter((row) => row.status === 'Absent').length;
  const lateCount = rosterRows.filter((row) => row.status === 'Late').length;
  const totalStudents = rosterRows.length;
  const openItems = dashboardMessages.length + mySwapRequests.length;
  const unreadNotices = dashboardNotices.filter((notice) => !notice.read).length;

  useEffect(() => {
    setSelectedStudentIds((current) =>
      current.filter((studentId) => rosterStudentIds.includes(studentId)),
    );
  }, [rosterStudentIds]);

  function handleStudentChange(studentIds: readonly string[]): void {
    setSelectedStudentIds(studentIds.filter((studentId) => rosterStudentIds.includes(studentId)));
  }

  async function submitBehaviour(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selectedStudentIds.length === 0) return;

    try {
      await logBehaviour.mutateAsync({
        studentIds: selectedStudentIds,
        type: behaviourForm.type,
        visibility: behaviourForm.visibility,
        category: behaviourForm.category,
        note: behaviourForm.note.trim() ? behaviourForm.note : undefined,
        ...(behaviourForm.type === 'Merit' ? { amount: Number(behaviourForm.amount) } : {}),
      });
    } catch {
      // Mutation onError shows the friendly notification.
    }
  }

  async function submitBatchBehaviour(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selectedStudentIds.length === 0) return;

    try {
      await logManyBehaviour.mutateAsync({
        studentIds: selectedStudentIds,
        type: batchType,
        entries: batchEntries.map((entry) => ({
          category: entry.category,
          note: entry.note.trim() ? entry.note : undefined,
          count: Number(entry.count),
          ...(batchType === 'Merit' ? { amount: Number(entry.amount) } : {}),
        })),
      });
    } catch {
      // Mutation onError shows the friendly notification.
    }
  }

  function setBatchEntry(id: string, patch: Partial<Omit<BatchEntryForm, 'id'>>): void {
    setBatchEntries((current) =>
      current.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
    );
  }

  if (view === 'dashboard') {
    return (
      <SupervisorDashboardOverview
        absentCount={absentCount}
        attendanceError={
          attendanceRosterQuery.error
            ? friendlyErrorMessage(attendanceRosterQuery.error)
            : undefined
        }
        dashboardActivity={dashboardActivity}
        dashboardActivityError={
          dashboardActivityQuery.error
            ? friendlyErrorMessage(dashboardActivityQuery.error)
            : undefined
        }
        dashboardActivityLoading={dashboardActivityQuery.isLoading}
        dashboardMessages={dashboardMessages}
        dashboardNotices={dashboardNotices}
        dashboardNoticesError={
          noticesQuery.error ? friendlyErrorMessage(noticesQuery.error) : undefined
        }
        dashboardNoticesLoading={noticesQuery.isLoading}
        date={date}
        lateCount={lateCount}
        mySwapRequests={mySwapRequests}
        mySwapRequestsError={
          mySwapRequestsQuery.error ? friendlyErrorMessage(mySwapRequestsQuery.error) : undefined
        }
        mySwapRequestsLoading={mySwapRequestsQuery.isLoading}
        onTimeCount={onTimeCount}
        openItems={openItems}
        todayShifts={todayShifts}
        totalStudents={totalStudents}
        unreadNotices={unreadNotices}
        weekDays={weekDays}
        weekEnd={weekEnd}
        weekRotaError={weekRotaQuery.error ? friendlyErrorMessage(weekRotaQuery.error) : undefined}
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
              <BehaviourStudentSelector
                disabled={
                  attendanceRosterQuery.isLoading || (attendanceRosterQuery.data ?? []).length === 0
                }
                hint={`${String(selectedStudentCount)} of ${String(rosterRows.length)} selected. Behaviour activity shows the first selected student.`}
                label="Selected students"
                loading={attendanceRosterQuery.isLoading}
                onChange={handleStudentChange}
                options={rosterStudentOptions}
                selectedIds={selectedStudentIds}
              />
              {selectedStudent ? (
                <div className="student-context-card">
                  <strong>{selectedStudent.studentName}</strong>
                  <span>{displaySchoolYearLabel(selectedStudent.yearGroup)}</span>
                  <span>{selectedStudent.status ?? 'Attendance unmarked'}</span>
                  <DailyDemeritBadge
                    status={demeritStatusQuery.statusByStudentId.get(selectedStudent.studentId)}
                  />
                </div>
              ) : null}
            </div>
            {attendanceRosterQuery.error ? (
              <p className="status--error">{friendlyErrorMessage(attendanceRosterQuery.error)}</p>
            ) : null}

            <div className="supervisor-workflow-grid">
              <div className="form-grid">
                <div className="form-grid form-grid--two">
                  <Field label="Entry mode">
                    <SelectInput
                      aria-label="Behaviour entry mode"
                      onChange={(event) => {
                        setEntryMode(event.target.value as EntryMode);
                      }}
                      value={entryMode}
                    >
                      <option value="single">Single</option>
                      <option value="batch">Batch</option>
                    </SelectInput>
                  </Field>
                </div>

                {entryMode === 'single' ? (
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
                              category: nextType === 'General' ? 'Misc' : form.category,
                              visibility:
                                nextType === 'General'
                                  ? 'Sensitive'
                                  : nextType === 'Demerit'
                                    ? 'Sensitive'
                                    : form.visibility === 'Sensitive'
                                      ? 'General'
                                      : form.visibility,
                              amount:
                                nextType === 'Demerit'
                                  ? '1'
                                  : nextType === 'Merit' && form.type !== 'Merit'
                                    ? '1'
                                    : form.amount,
                            }));
                          }}
                          value={behaviourForm.type}
                        >
                          <option value="Merit">Merit</option>
                          <option value="Demerit">Demerit</option>
                          <option value="General">General mark</option>
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
                    {behaviourForm.type === 'General' ? (
                      <p className="field__hint">
                        General marks have no merit value. General visibility notifies linked
                        guardians.
                      </p>
                    ) : null}
                    <Field
                      label="Note"
                      hint="Sensitive entries are visible to heads and the recording staff author where allowed."
                    >
                      <textarea
                        aria-label="Behaviour note"
                        className="input textarea"
                        maxLength={2000}
                        onChange={(event) => {
                          setBehaviourForm((form) => ({ ...form, note: event.target.value }));
                        }}
                        required={behaviourForm.type === 'General'}
                        rows={4}
                        value={behaviourForm.note}
                      />
                    </Field>
                    <Button
                      disabled={selectedStudentCount === 0}
                      pending={logBehaviour.isPending}
                      type="submit"
                    >
                      <Save aria-hidden="true" size={16} />
                      {behaviourForm.type === 'Demerit' ? 'Save demerit' : 'Save behaviour'}
                    </Button>
                    {logBehaviour.error ? (
                      <p className="status--error">{friendlyErrorMessage(logBehaviour.error)}</p>
                    ) : null}
                  </form>
                ) : (
                  <form
                    className="form-grid"
                    onSubmit={(event) => {
                      void submitBatchBehaviour(event);
                    }}
                  >
                    <Field label="Type">
                      <SelectInput
                        aria-label="Batch behaviour type"
                        onChange={(event) => {
                          const nextType = event.target.value as BatchBehaviourType;
                          setBatchType(nextType);
                          setBatchEntries([newBatchEntry()]);
                        }}
                        value={batchType}
                      >
                        <option value="Merit">Merit</option>
                        <option value="Demerit">Demerit</option>
                      </SelectInput>
                    </Field>
                    {batchEntries.map((entry, index) => (
                      <div className="form-grid" key={entry.id}>
                        <Field label={`Entry ${String(index + 1)} category`}>
                          <TextInput
                            aria-label={`Entry ${String(index + 1)} category`}
                            maxLength={120}
                            onChange={(event) => {
                              setBatchEntry(entry.id, { category: event.target.value });
                            }}
                            required
                            value={entry.category}
                          />
                        </Field>
                        {batchType === 'Merit' ? (
                          <Field label={`Entry ${String(index + 1)} amount`}>
                            <TextInput
                              aria-label={`Entry ${String(index + 1)} merit amount`}
                              min={1}
                              onChange={(event) => {
                                setBatchEntry(entry.id, { amount: event.target.value });
                              }}
                              required
                              type="number"
                              value={entry.amount}
                            />
                          </Field>
                        ) : null}
                        <Field label={`Entry ${String(index + 1)} quantity`}>
                          <TextInput
                            aria-label={`Entry ${String(index + 1)} quantity`}
                            max={50}
                            min={1}
                            onChange={(event) => {
                              setBatchEntry(entry.id, { count: event.target.value });
                            }}
                            required
                            type="number"
                            value={entry.count}
                          />
                        </Field>
                        <Field label={`Entry ${String(index + 1)} note`}>
                          <textarea
                            aria-label={`Entry ${String(index + 1)} note`}
                            className="input textarea"
                            maxLength={2000}
                            onChange={(event) => {
                              setBatchEntry(entry.id, { note: event.target.value });
                            }}
                            rows={3}
                            value={entry.note}
                          />
                        </Field>
                        {batchEntries.length > 1 ? (
                          <Button
                            onClick={() => {
                              setBatchEntries((current) =>
                                current.filter((candidate) => candidate.id !== entry.id),
                              );
                            }}
                            type="button"
                            variant="ghost"
                          >
                            <Trash2 aria-hidden="true" size={16} />
                            Remove entry
                          </Button>
                        ) : null}
                      </div>
                    ))}
                    <Button
                      onClick={() => {
                        setBatchEntries((current) => [...current, newBatchEntry()]);
                      }}
                      type="button"
                      variant="secondary"
                    >
                      <Plus aria-hidden="true" size={16} />
                      Add entry
                    </Button>
                    <Button
                      disabled={selectedStudentCount === 0}
                      pending={logManyBehaviour.isPending}
                      type="submit"
                    >
                      <Save aria-hidden="true" size={16} />
                      Save {String(batchEntryCount * Math.max(selectedStudentCount, 1))} entries
                    </Button>
                    {logManyBehaviour.error ? (
                      <p className="status--error">
                        {friendlyErrorMessage(logManyBehaviour.error)}
                      </p>
                    ) : null}
                  </form>
                )}
              </div>

              <div className="activity-list" aria-label="Student behaviour activity">
                <h3>Behaviour activity</h3>
                {behaviourQuery.isLoading ? (
                  <div className="empty-state">Loading behaviour...</div>
                ) : null}
                {behaviourQuery.error ? (
                  <p className="status--error">{friendlyErrorMessage(behaviourQuery.error)}</p>
                ) : null}
                {!behaviourQuery.isLoading &&
                selectedStudentIds.length > 0 &&
                behaviourEntries.length === 0 ? (
                  <div className="empty-state">No General behaviour entries yet.</div>
                ) : null}
                {behaviourEntries.map((entry) => (
                  <article className="activity-row" key={entry.id}>
                    <span
                      className={
                        entry.type === 'Merit'
                          ? 'badge badge--green'
                          : entry.type === 'General'
                            ? 'badge badge--blue'
                            : 'badge badge--amber'
                      }
                    >
                      {entry.type === 'General' ? 'General mark' : entry.type}
                    </span>
                    <div>
                      <strong>{entry.category}</strong>
                      <span>
                        {entry.type === 'General'
                          ? 'No merit value'
                          : entry.meritDelta > 0
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
                  <p className="status--error">{friendlyErrorMessage(todayRotaQuery.error)}</p>
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
                  <p className="status--error">{friendlyErrorMessage(teamScheduleQuery.error)}</p>
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
              <p className="status--error">{friendlyErrorMessage(swapCandidatesQuery.error)}</p>
            ) : null}
            {!swapCandidatesQuery.isLoading && swapCandidates.length === 0 ? (
              <p className="muted">No other supervisor shifts are available in this week.</p>
            ) : null}

            <Button
              className="supervisor-submit"
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
            {requestSwap.error ? (
              <p className="status--error">{friendlyErrorMessage(requestSwap.error)}</p>
            ) : null}
          </section>
        </aside>
      ) : null}
    </div>
  );
}

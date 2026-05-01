'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { api } from '@/lib/trpc';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { SelectInput, TextInput } from '@/components/ui/field';
import { PaceProgressTable } from './pace-progress-table';
import { PaceScoreModal } from './pace-score-modal';
import {
  asDate,
  todayKey,
  type PaceRosterStudent,
  type PaceSubject,
  type PaceTestType,
} from './pace-workflow-utils';

const EMPTY_ROSTER_STUDENTS: readonly PaceRosterStudent[] = [];

export function PaceWorkflowClient() {
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<PaceSubject | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const date = useMemo(() => asDate(selectedDate), [selectedDate]);
  const utils = api.useUtils();

  const rosterQuery = api.pace.roster.useQuery({ date }, { retry: false });
  const roster = rosterQuery.data;
  const students = roster?.students ?? EMPTY_ROSTER_STUDENTS;
  const selectedStudent =
    students.find((student) => student.studentId === selectedStudentId) ?? null;
  const canEditDate = roster?.fullAccess ?? false;

  const paceQuery = api.pace.forStudent.useQuery(
    { studentId: selectedStudentId, date },
    { enabled: selectedStudentId.length > 0, retry: false },
  );
  const subjects = paceQuery.data?.subjects ?? [];
  const recordPace = api.pace.record.useMutation({
    async onSuccess(result) {
      setStatus(
        result.advanced
          ? `PACE recorded. Current PACE advanced to ${String(result.newPaceNumber)}.`
          : 'PACE score saved.',
      );
      setSelectedSubject(null);
      await Promise.all([
        utils.pace.forStudent.invalidate({ studentId: result.studentId, date }),
        utils.pace.roster.invalidate({ date }),
      ]);
    },
  });

  useEffect(() => {
    if (students.length === 0) {
      setSelectedStudentId('');
      return;
    }
    if (!students.some((student) => student.studentId === selectedStudentId)) {
      setSelectedStudentId(students[0]?.studentId ?? '');
    }
  }, [selectedStudentId, students]);

  function handleStudentChange(studentId: string): void {
    setSelectedStudentId(studentId);
    setSelectedSubject(null);
    setStatus(null);
  }

  async function saveScore(input: {
    completedAt: string;
    paceNumber: number;
    score: number;
    subjectId: string;
    testType: PaceTestType;
  }): Promise<void> {
    if (!selectedStudentId) return;
    setStatus(null);
    await recordPace.mutateAsync({
      studentId: selectedStudentId,
      subjectId: input.subjectId,
      paceNumber: input.paceNumber,
      testType: input.testType,
      score: input.score,
      completedAt: asDate(input.completedAt),
    });
  }

  return (
    <div className="pace-workflow-page">
      <header className="pace-workflow-header">
        <div className="pace-workflow-header__primary">
          <h1>PACE Progress</h1>
          <span className="pace-workflow-header__select">
            <SelectInput
              aria-label="PACE student"
              disabled={rosterQuery.isLoading || students.length === 0}
              onChange={(event) => {
                handleStudentChange(event.target.value);
              }}
              value={selectedStudentId}
            >
              <option value="">Choose a child</option>
              {students.map((student) => (
                <option key={student.studentId} value={student.studentId}>
                  {student.studentName}
                </option>
              ))}
            </SelectInput>
          </span>
          <Button
            disabled={!selectedStudent || subjects.length === 0}
            onClick={() => {
              setSelectedSubject(subjects.find((subject) => subject.active) ?? subjects[0] ?? null);
            }}
            type="button"
          >
            <Plus aria-hidden="true" size={16} />
            Record New Score
          </Button>
        </div>
        <div className="pace-workflow-header__secondary">
          {canEditDate ? (
            <TextInput
              aria-label="PACE roster date"
              onChange={(event) => {
                setSelectedDate(event.target.value);
                setStatus(null);
              }}
              type="date"
              value={selectedDate}
            />
          ) : null}
          <Button
            onClick={() => {
              void rosterQuery.refetch();
              void paceQuery.refetch();
            }}
            pending={rosterQuery.isFetching || paceQuery.isFetching}
            type="button"
            variant="secondary"
          >
            <RefreshCw aria-hidden="true" size={16} />
            Refresh
          </Button>
        </div>
      </header>

      {rosterQuery.error ? <p className="status--error">{rosterQuery.error.message}</p> : null}

      {!rosterQuery.isLoading && students.length === 0 ? (
        <EmptyState
          detail={
            roster?.fullAccess
              ? 'Create active children before recording PACE progress.'
              : 'Your Supervisor account has no PACE children assigned for today.'
          }
          title="No children available"
        />
      ) : null}

      {selectedStudent ? (
        <>
          <section className="pace-student-summary">
            <Avatar className="pace-student-summary__avatar" name={selectedStudent.studentName} />
            <div>
              <h2>{selectedStudent.studentName}</h2>
              <p>
                {selectedStudent.yearGroupLabel}
                {selectedStudent.band ? ` · ${selectedStudent.band.name}` : ''}
                {subjects.length > 0 ? ` · ${String(subjects.length)} subjects` : ''}
              </p>
            </div>
          </section>

          {paceQuery.data?.warnings.dailyLimitEnabled ? (
            <div
              className={
                paceQuery.data.warnings.atLimit
                  ? 'workflow-alert workflow-alert--danger'
                  : 'workflow-alert'
              }
            >
              <strong>
                {paceQuery.data.warnings.atLimit
                  ? 'Daily PACE test limit reached'
                  : `${String(paceQuery.data.warnings.remaining)} PACE test(s) remaining today`}
              </strong>
              <span>
                {String(paceQuery.data.warnings.count)} of {String(paceQuery.data.warnings.limit)}{' '}
                tests recorded for {paceQuery.data.today.date}.
              </span>
            </div>
          ) : null}

          <PaceProgressTable
            errorMessage={paceQuery.error?.message}
            loading={paceQuery.isLoading}
            onUpdateScore={setSelectedSubject}
            subjects={subjects}
          />
        </>
      ) : null}

      {status ? <p className="status--success">{status}</p> : null}

      {selectedSubject && selectedStudent ? (
        <PaceScoreModal
          canEditDate={canEditDate}
          completedDate={roster?.date ?? selectedDate}
          errorMessage={recordPace.error?.message}
          onClose={() => {
            setSelectedSubject(null);
          }}
          onSave={saveScore}
          pending={recordPace.isPending}
          studentName={selectedStudent.studentName}
          studentYearLabel={selectedStudent.yearGroupLabel}
          subject={selectedSubject}
          subjects={subjects}
        />
      ) : null}
    </div>
  );
}

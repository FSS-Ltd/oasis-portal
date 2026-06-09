'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { api } from '@/lib/trpc';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { SelectInput, TextInput } from '@/components/ui/field';
import { friendlyErrorMessage, showErrorToast, showSuccessToast } from '@/lib/notifications';
import { PaceApprovalModal } from './pace-approval-modal';
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
type PaceEditableRecord = NonNullable<PaceSubject['currentScoreRecord']>;
type PaceApprovalRecord = NonNullable<PaceSubject['latestFinalTest']>;
type PaceModalState =
  | { initialTestType?: PaceTestType | undefined; mode: 'create'; subject: PaceSubject }
  | { mode: 'update'; record: PaceEditableRecord; subject: PaceSubject };

interface PaceWorkflowClientProps {
  canManageProgress: boolean;
}

function paceRecordStatus(result: {
  advanced: boolean;
  awardedMerits: number;
  newPaceNumber: number | undefined;
}): string {
  const meritMessage =
    result.awardedMerits > 0
      ? ` ${String(result.awardedMerits)} merit${result.awardedMerits === 1 ? '' : 's'} awarded.`
      : '';
  return result.advanced
    ? `PACE recorded. Current PACE advanced to ${String(result.newPaceNumber)}.${meritMessage}`
    : `PACE score saved.${meritMessage}`;
}

function paceUpdateStatus(result: {
  advanced: boolean;
  awardedMerits: number;
  newPaceNumber: number | undefined;
}): string {
  const meritMessage =
    result.awardedMerits > 0
      ? ` ${String(result.awardedMerits)} merit${result.awardedMerits === 1 ? '' : 's'} now linked.`
      : '';
  return result.advanced && result.newPaceNumber
    ? `PACE score updated. Current PACE is ${String(result.newPaceNumber)}.${meritMessage}`
    : `PACE score updated.${meritMessage}`;
}

function nextRecordTestType(subject: PaceSubject): PaceTestType {
  return subject.latestSelfTest ? 'FinalTest' : 'SelfTest';
}

function firstRecordableSubject(subjects: readonly PaceSubject[]): PaceSubject | null {
  return subjects.find((subject) => subject.active) ?? subjects[0] ?? null;
}

export function PaceWorkflowClient({ canManageProgress }: PaceWorkflowClientProps) {
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [scoreModal, setScoreModal] = useState<PaceModalState | null>(null);
  const [approvalModal, setApprovalModal] = useState<{
    record: PaceApprovalRecord;
    subject: PaceSubject;
  } | null>(null);
  const date = useMemo(() => asDate(selectedDate), [selectedDate]);
  const utils = api.useUtils();

  async function invalidatePaceMutationViews(studentId: string): Promise<void> {
    await Promise.all([
      utils.pace.forStudent.invalidate(),
      utils.pace.roster.invalidate(),
      utils.childLog.drillThrough.invalidate({ studentId }),
      utils.childLog.snapshot.invalidate(),
      utils.childLog.centreSnapshot.invalidate(),
      utils.childLog.parentDashboard.invalidate(),
    ]);
  }

  const rosterQuery = api.pace.roster.useQuery({ date }, { retry: false });
  const roster = rosterQuery.data;
  const students = roster?.students ?? EMPTY_ROSTER_STUDENTS;
  const selectedStudent =
    students.find((student) => student.studentId === selectedStudentId) ?? null;
  const canEditDate = roster?.canEditDate ?? false;

  const paceQuery = api.pace.forStudent.useQuery(
    { studentId: selectedStudentId, date },
    { enabled: selectedStudentId.length > 0, retry: false },
  );
  const subjects = paceQuery.data?.subjects ?? [];
  const recordPace = api.pace.record.useMutation({
    async onSuccess(result) {
      showSuccessToast(paceRecordStatus(result));
      setScoreModal(null);
      await invalidatePaceMutationViews(result.studentId);
    },
    onError(error) {
      showErrorToast(error, 'PACE score could not be saved.');
    },
  });
  const updatePace = api.pace.updateRecord.useMutation({
    async onSuccess(result) {
      showSuccessToast(paceUpdateStatus(result));
      setScoreModal(null);
      await invalidatePaceMutationViews(result.studentId);
    },
    onError(error) {
      showErrorToast(error, 'PACE score could not be updated.');
    },
  });
  const approveAdvance = api.pace.approveFailedFinalTestAdvance.useMutation({
    async onSuccess(result) {
      showSuccessToast(`Advance approved. Current PACE is ${String(result.newPaceNumber)}.`);
      setApprovalModal(null);
      await invalidatePaceMutationViews(result.studentId);
    },
    onError(error) {
      showErrorToast(error, 'PACE advance could not be approved.');
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
    setScoreModal(null);
    setApprovalModal(null);
  }

  async function saveScore(input: {
    completedAt: string;
    paceNumber: number;
    recordId?: string | undefined;
    score: number;
    startedAt?: string | undefined;
    subjectId: string;
    testType: PaceTestType;
  }): Promise<void> {
    if (!selectedStudentId) return;
    if (input.recordId) {
      await updatePace.mutateAsync({
        recordId: input.recordId,
        subjectId: input.subjectId,
        paceNumber: input.paceNumber,
        score: input.score,
        completedAt: asDate(input.completedAt),
        startedAt: asDate(input.startedAt ?? input.completedAt),
      });
      return;
    }
    await recordPace.mutateAsync({
      studentId: selectedStudentId,
      subjectId: input.subjectId,
      paceNumber: input.paceNumber,
      testType: input.testType,
      score: input.score,
      completedAt: asDate(input.completedAt),
    });
  }

  async function approveFailedFinalTest(input: { notes: string; recordId: string }): Promise<void> {
    await approveAdvance.mutateAsync(input);
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
          {canManageProgress ? (
            <Button
              disabled={!selectedStudent || subjects.length === 0}
              onClick={() => {
                const subject = firstRecordableSubject(subjects);
                setScoreModal(
                  subject
                    ? { initialTestType: nextRecordTestType(subject), mode: 'create', subject }
                    : null,
                );
              }}
              type="button"
            >
              <Plus aria-hidden="true" size={16} />
              Record New Score
            </Button>
          ) : null}
        </div>
        <div className="pace-workflow-header__secondary">
          {canEditDate ? (
            <TextInput
              aria-label="PACE roster date"
              onChange={(event) => {
                setSelectedDate(event.target.value);
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

      {rosterQuery.error ? (
        <p className="status--error">{friendlyErrorMessage(rosterQuery.error)}</p>
      ) : null}

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
            canManageProgress={canManageProgress}
            errorMessage={paceQuery.error ? friendlyErrorMessage(paceQuery.error) : undefined}
            loading={paceQuery.isLoading}
            onApproveAdvance={(subject, record) => {
              setApprovalModal({ record, subject });
            }}
            onRecordScore={(subject) => {
              setScoreModal({
                initialTestType: nextRecordTestType(subject),
                mode: 'create',
                subject,
              });
            }}
            onUpdateScore={(subject, record) => {
              setScoreModal({ mode: 'update', record, subject });
            }}
            subjects={subjects}
          />
        </>
      ) : null}

      {canManageProgress && scoreModal && selectedStudent ? (
        <PaceScoreModal
          canEditDate={canEditDate}
          completedDate={roster?.date ?? selectedDate}
          errorMessage={
            recordPace.error
              ? friendlyErrorMessage(recordPace.error)
              : updatePace.error
                ? friendlyErrorMessage(updatePace.error)
                : undefined
          }
          initialRecord={scoreModal.mode === 'update' ? scoreModal.record : undefined}
          initialTestType={scoreModal.mode === 'create' ? scoreModal.initialTestType : undefined}
          mode={scoreModal.mode}
          onClose={() => {
            setScoreModal(null);
          }}
          onSave={saveScore}
          pending={recordPace.isPending || updatePace.isPending}
          studentName={selectedStudent.studentName}
          studentYearLabel={selectedStudent.yearGroupLabel}
          subject={scoreModal.subject}
          subjects={subjects}
        />
      ) : null}
      {canManageProgress && approvalModal ? (
        <PaceApprovalModal
          errorMessage={
            approveAdvance.error ? friendlyErrorMessage(approveAdvance.error) : undefined
          }
          onClose={() => {
            if (!approveAdvance.isPending) setApprovalModal(null);
          }}
          onSave={approveFailedFinalTest}
          pending={approveAdvance.isPending}
          record={{
            id: approvalModal.record.id,
            paceNumber: approvalModal.record.paceNumber,
            score: approvalModal.record.score,
            subjectName: approvalModal.subject.name,
          }}
        />
      ) : null}
    </div>
  );
}

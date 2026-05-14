'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { ArrowLeft, Edit3, Trash2, X } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { displaySchoolYearLabel } from '@oasis/domain';
import { api, type RouterOutputs } from '@/lib/trpc';
import { ConfirmationDialog } from '@/components/admin/confirmation-dialog';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, SelectInput, TextInput } from '@/components/ui/field';
import { categoriesFor } from '@/components/behaviour/behaviour-categories';
import {
  type EditablePaceRecord,
  PaceRecordEditModal,
} from '@/components/pace/pace-record-edit-modal';
import { asDate } from '@/components/pace/pace-workflow-utils';
import {
  AttendanceRing,
  EmptyCard,
  LegendRow,
  MeritSparkline,
  ScoreDonut,
  SnapshotBadge,
  SnapshotStatCard,
  SummaryTotal,
} from '@/components/child-log/snapshot-widgets';
import { formatShortDate, scoreLabel, scoreTone } from '@/components/child-log/snapshot-utils';
import { AttendanceCalendar } from './attendance-calendar';
import { NotesList } from './notes-list';

type DrillThrough = RouterOutputs['childLog']['drillThrough'];
type DrillThroughTab = 'overview' | 'attendance' | 'behaviour' | 'pace' | 'merits' | 'notes';
type BehaviourEntry = DrillThrough['behaviour'][number];
type NoteEntry = DrillThrough['notes'][number];
type PaceEntry = DrillThrough['pace'][number];

const DRILL_THROUGH_TABS = [
  ['overview', 'Overview'],
  ['attendance', 'Attendance'],
  ['behaviour', 'Behaviour'],
  ['pace', 'Pace'],
  ['merits', 'Merits'],
  ['notes', 'Notes'],
] as const satisfies readonly (readonly [DrillThroughTab, string])[];

interface StudentDrillThroughContentProps {
  backHref: Route;
  backLabel: string;
  onEdit?: (() => void) | undefined;
  canManageCorrections?: boolean;
  studentId: string;
}

interface BehaviourCorrectionDraft {
  id: string;
  type: BehaviourEntry['type'];
  category: string;
  note: string;
  visibility: BehaviourEntry['visibility'];
  amount: string;
}

interface NoteCorrectionDraft {
  id: string;
  note: string;
  sensitive: boolean;
}

function signed(value: number): string {
  return value > 0 ? `+${String(value)}` : String(value);
}

function behaviourValue(entry: { type: string; meritDelta: number }): string {
  return entry.type === 'General' ? 'No merit value' : signed(entry.meritDelta);
}

function behaviourTone(entry: { type: string; meritDelta: number }): 'blue' | 'green' | 'red' {
  if (entry.type === 'General') return 'blue';
  return entry.meritDelta > 0 ? 'green' : 'red';
}

function formatLongDate(value: Date | string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function StudentHero({
  backHref,
  backLabel,
  data,
  onEdit,
}: {
  backHref: Route;
  backLabel: string;
  data: DrillThrough;
  onEdit?: (() => void) | undefined;
}) {
  return (
    <div className="student-drillthrough__top">
      <Link className="student-drillthrough__back" href={backHref}>
        <ArrowLeft aria-hidden="true" size={14} />
        {backLabel}
      </Link>
      <section className="panel panel__body student-detail-hero">
        <div className="student-detail-hero__identity">
          <Avatar className="student-detail-hero__avatar" name={data.student.fullName} />
          <div>
            <h1>{data.student.fullName}</h1>
            <p>
              {displaySchoolYearLabel(data.student.yearGroup)} · Enrolled{' '}
              {formatLongDate(data.student.enrolmentDate)}
            </p>
          </div>
        </div>
        <div className="student-detail-hero__actions">
          <Badge tone={data.student.active ? 'green' : 'amber'}>
            {data.student.active ? 'Active' : 'Inactive'}
          </Badge>
          {onEdit ? (
            <Button onClick={onEdit} size="sm" type="button" variant="secondary">
              <Edit3 aria-hidden="true" size={14} />
              Edit Profile
            </Button>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function StudentTabs({
  activeTab,
  onSelect,
}: {
  activeTab: DrillThroughTab;
  onSelect: (tab: DrillThroughTab) => void;
}) {
  return (
    <div className="student-detail-tabs" role="tablist">
      {DRILL_THROUGH_TABS.map(([id, label]) => (
        <button
          aria-selected={activeTab === id}
          className={activeTab === id ? 'is-selected' : undefined}
          key={id}
          onClick={() => {
            onSelect(id);
          }}
          role="tab"
          type="button"
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function OverviewTab({
  canManageCorrections,
  data,
  onDeletePace,
  onEditPace,
}: {
  canManageCorrections: boolean;
  data: DrillThrough;
  onDeletePace: (entry: PaceEntry) => void;
  onEditPace: (entry: PaceEntry) => void;
}) {
  const presentDays = data.attendance.filter((row) => row.status === 'Present').length;
  const lateDays = data.attendance.filter((row) => row.status === 'Late').length;
  const absentDays = data.attendance.filter((row) => row.status === 'Absent').length;
  const meritsEarned = data.behaviour
    .filter((entry) => entry.meritDelta > 0)
    .reduce((sum, entry) => sum + entry.meritDelta, 0);
  const demeritsTotal = data.behaviour
    .filter((entry) => entry.meritDelta < 0)
    .reduce((sum, entry) => sum + entry.meritDelta, 0);
  const netMerits = meritsEarned + demeritsTotal;
  const avgPaceScore =
    data.pace.length > 0
      ? Math.round(data.pace.reduce((sum, item) => sum + item.score, 0) / data.pace.length)
      : null;

  return (
    <div className="snapshot-tab-panel">
      <div className="student-detail-summary-grid">
        <SnapshotStatCard
          accent="blue"
          label="Total Merit Balance"
          sub={`Spend: ${String(data.metrics.meritBalances.Spend)} · Saving: ${String(
            data.metrics.meritBalances.Saving,
          )}`}
          value={String(data.metrics.totalMerits)}
        />
        <SnapshotStatCard
          accent="blue"
          label="PACEs Completed"
          sub="this academic year"
          value={String(data.metrics.pacesCompletedThisAcademicYear)}
        />
        <SnapshotStatCard
          accent={data.metrics.attendanceRate === null ? 'amber' : 'green'}
          label="Attendance Rate"
          sub={`${String(data.metrics.presentDays)}/${String(
            data.metrics.recordedAttendanceDays,
          )} days this year`}
          value={
            data.metrics.attendanceRate === null ? '—' : `${String(data.metrics.attendanceRate)}%`
          }
        />
      </div>

      <div className="snapshot-stat-grid">
        <section className="panel panel__body snapshot-attendance-card">
          <h3>Attendance</h3>
          <div>
            <AttendanceRing absent={absentDays} late={lateDays} present={presentDays} />
            <div className="snapshot-attendance-card__legend">
              <LegendRow label="Present" tone="green" value={presentDays} />
              <LegendRow label="Late" tone="amber" value={lateDays} />
              <LegendRow label="Absent" tone="red" value={absentDays} />
            </div>
          </div>
        </section>
        <SnapshotStatCard
          accent="green"
          label="Merits earned"
          sub={`across ${String(data.behaviour.filter((entry) => entry.meritDelta > 0).length)} entries`}
          value={`+${String(meritsEarned)}`}
        />
        <SnapshotStatCard
          accent={demeritsTotal < 0 ? 'red' : 'blue'}
          label="Demerits"
          sub={`net: ${netMerits >= 0 ? '+' : ''}${String(netMerits)} this period`}
          value={demeritsTotal ? String(demeritsTotal) : '—'}
        />
        <SnapshotStatCard
          accent={scoreTone(avgPaceScore)}
          label="Avg PACE score"
          sub={`${String(data.pace.length)} test${data.pace.length === 1 ? '' : 's'} this year`}
          value={avgPaceScore === null ? '—' : `${String(avgPaceScore)}%`}
        />
      </div>

      <div className="snapshot-overview-grid">
        <section className="panel panel__body snapshot-merit-chart">
          <h3>Merit Activity</h3>
          <MeritSparkline entries={data.behaviour} />
          <div className="snapshot-merit-chart__totals">
            <SummaryTotal
              label="Merits"
              tone="green"
              value={meritsEarned > 0 ? `+${String(meritsEarned)}` : '0'}
            />
            <SummaryTotal
              label="Demerits"
              tone="red"
              value={demeritsTotal ? String(demeritsTotal) : '0'}
            />
            <SummaryTotal
              label="Net"
              tone={netMerits >= 0 ? 'navy' : 'red'}
              value={`${netMerits >= 0 ? '+' : ''}${String(netMerits)}`}
            />
          </div>
        </section>
        <section className="panel panel__body snapshot-pace-compact">
          <h3>PACE scores</h3>
          {data.pace.length === 0 ? (
            <p className="muted">No PACE scores recorded this academic year.</p>
          ) : null}
          {data.pace.slice(0, 5).map((item) => (
            <div key={item.id}>
              <span className={`snapshot-score-pill is-${scoreTone(item.score)}`}>
                {item.score}%
              </span>
              <div>
                <strong>
                  {item.subjectName} <span>PACE {item.paceNumber}</span>
                </strong>
                <p>
                  {item.testType} · {formatShortDate(item.completedAt ?? item.createdAt)}
                </p>
                {item.approval ? (
                  <p>
                    Approved advance by {item.approval.approvedByName} · {item.approval.notes}
                  </p>
                ) : null}
              </div>
              <span className="snapshot-pace-actions">
                <span>{item.testType}</span>
                {canManageCorrections ? (
                  <>
                    <Button
                      aria-label={`Edit ${item.testType} score for ${item.subjectName}`}
                      className="pace-score-edit-button"
                      onClick={() => {
                        onEditPace(item);
                      }}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      <Edit3 aria-hidden="true" size={14} />
                      <span className="sr-only">Edit PACE score</span>
                    </Button>
                    <Button
                      aria-label={`Delete ${item.testType} score for ${item.subjectName}`}
                      className="pace-score-edit-button"
                      onClick={() => {
                        onDeletePace(item);
                      }}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      <Trash2 aria-hidden="true" size={14} />
                      <span className="sr-only">Delete PACE score</span>
                    </Button>
                  </>
                ) : null}
              </span>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}

function AttendanceTab({ data }: { data: DrillThrough }) {
  return (
    <AttendanceCalendar
      attendance={data.attendance}
      earliestDateKey={data.range.from}
      fallbackDateKey={data.range.to}
    />
  );
}

function BehaviourTab({
  canManageCorrections,
  data,
  onDelete,
  onEdit,
}: {
  canManageCorrections: boolean;
  data: DrillThrough;
  onDelete: (entry: BehaviourEntry) => void;
  onEdit: (entry: BehaviourEntry) => void;
}) {
  return (
    <div className="snapshot-tab-panel snapshot-list-panel">
      {data.behaviour.length === 0 ? (
        <EmptyCard>No behaviour entries this academic year.</EmptyCard>
      ) : null}
      {data.behaviour.map((entry) => (
        <article
          className={
            entry.type === 'General'
              ? 'panel panel__body snapshot-behaviour-row'
              : entry.meritDelta > 0
                ? 'panel panel__body snapshot-behaviour-row is-merit'
                : 'panel panel__body snapshot-behaviour-row is-demerit'
          }
          key={entry.id}
        >
          <span>{behaviourValue(entry)}</span>
          <div>
            <div>
              <SnapshotBadge tone={behaviourTone(entry)}>
                {entry.type === 'General' ? 'General mark' : entry.type}
              </SnapshotBadge>
              <SnapshotBadge tone="blue">{entry.category}</SnapshotBadge>
              {entry.visibility === 'Sensitive' ? (
                <SnapshotBadge tone="amber">Sensitive</SnapshotBadge>
              ) : null}
            </div>
            {entry.note ? <p>{entry.note}</p> : null}
            <small>
              Recorded by <strong>{entry.recordedByName}</strong>
            </small>
            {canManageCorrections ? (
              <div className="lifecycle-actions">
                <Button
                  onClick={() => {
                    onEdit(entry);
                  }}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  <Edit3 aria-hidden="true" size={14} />
                  Edit
                </Button>
                <Button
                  onClick={() => {
                    onDelete(entry);
                  }}
                  size="sm"
                  type="button"
                  variant="danger"
                >
                  <Trash2 aria-hidden="true" size={14} />
                  Delete
                </Button>
              </div>
            ) : null}
          </div>
          <time>{formatShortDate(entry.createdAt)}</time>
        </article>
      ))}
    </div>
  );
}

function PaceTab({
  canManageCorrections,
  data,
  onDelete,
  onEdit,
}: {
  canManageCorrections: boolean;
  data: DrillThrough;
  onDelete: (entry: PaceEntry) => void;
  onEdit: (entry: PaceEntry) => void;
}) {
  return (
    <div className="snapshot-tab-panel snapshot-list-panel">
      {data.pace.length === 0 ? (
        <EmptyCard>No PACE scores recorded this academic year.</EmptyCard>
      ) : null}
      {data.pace.map((item) => (
        <article className="panel panel__body snapshot-pace-row" key={item.id}>
          <ScoreDonut score={item.score} />
          <div className="snapshot-pace-row__main">
            <div>
              <h3>{item.subjectName}</h3>
              <SnapshotBadge tone={item.testType === 'PACE Test' ? 'green' : 'blue'}>
                {item.testType}
              </SnapshotBadge>
            </div>
            <p>PACE #{item.paceNumber}</p>
            <span>
              Date: <strong>{formatShortDate(item.completedAt ?? item.createdAt)}</strong> ·
              Supervisor: <strong>{item.recordedByName}</strong>
            </span>
            {item.approval ? (
              <p>
                Approved advance by <strong>{item.approval.approvedByName}</strong>:{' '}
                {item.approval.notes}
              </p>
            ) : null}
            {canManageCorrections ? (
              <div className="lifecycle-actions">
                <Button
                  onClick={() => {
                    onEdit(item);
                  }}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  <Edit3 aria-hidden="true" size={14} />
                  Edit
                </Button>
                <Button
                  onClick={() => {
                    onDelete(item);
                  }}
                  size="sm"
                  type="button"
                  variant="danger"
                >
                  <Trash2 aria-hidden="true" size={14} />
                  Delete
                </Button>
              </div>
            ) : null}
          </div>
          <div className="snapshot-score-bar">
            <div>
              <span>Score</span>
              <strong>
                {item.score}/{item.maxScore}
              </strong>
            </div>
            <span>
              <i style={{ width: `${String(item.score)}%` }} />
            </span>
            <small>{scoreLabel(item.score)}</small>
          </div>
        </article>
      ))}
    </div>
  );
}

function MeritsTab({ data }: { data: DrillThrough }) {
  const accounts = [
    ['Spend Account', data.metrics.meritBalances.Spend, 'red', 'Available to spend in Merit Shop'],
    ['Saving Account', data.metrics.meritBalances.Saving, 'blue', 'Transferred from Spend'],
    ['Investment Account', data.metrics.meritBalances.Investment, 'green', 'Investment balance'],
  ] as const;

  return (
    <div className="student-merit-grid">
      {accounts.map(([label, value, tone, description]) => (
        <SnapshotStatCard
          accent={tone}
          key={label}
          label={label}
          sub={description}
          value={String(value)}
        />
      ))}
    </div>
  );
}

function NotesTab({
  canManageCorrections,
  data,
  onDelete,
  onEdit,
}: {
  canManageCorrections: boolean;
  data: DrillThrough;
  onDelete: (note: NoteEntry) => void;
  onEdit: (note: NoteEntry) => void;
}) {
  return (
    <NotesList
      canManageCorrections={canManageCorrections}
      notes={data.notes}
      onDelete={onDelete}
      onEdit={onEdit}
    />
  );
}

export function StudentDrillThroughContent({
  backHref,
  backLabel,
  canManageCorrections = false,
  onEdit,
  studentId,
}: StudentDrillThroughContentProps) {
  const [activeTab, setActiveTab] = useState<DrillThroughTab>('overview');
  const drillThroughQuery = api.childLog.drillThrough.useQuery({ studentId }, { retry: false });
  const utils = api.useUtils();
  const [behaviourDraft, setBehaviourDraft] = useState<BehaviourCorrectionDraft | null>(null);
  const [behaviourDelete, setBehaviourDelete] = useState<BehaviourEntry | null>(null);
  const [noteDraft, setNoteDraft] = useState<NoteCorrectionDraft | null>(null);
  const [noteDelete, setNoteDelete] = useState<NoteEntry | null>(null);
  const [paceDraft, setPaceDraft] = useState<PaceEntry | null>(null);
  const [paceDelete, setPaceDelete] = useState<PaceEntry | null>(null);
  const updateBehaviour = api.behaviour.updateEntry.useMutation({
    onSuccess: async () => {
      setBehaviourDraft(null);
      await utils.childLog.drillThrough.invalidate({ studentId });
    },
  });
  const deleteBehaviour = api.behaviour.deleteEntry.useMutation({
    onSuccess: async () => {
      setBehaviourDelete(null);
      await utils.childLog.drillThrough.invalidate({ studentId });
    },
  });
  const updateNote = api.childNotes.update.useMutation({
    onSuccess: async () => {
      setNoteDraft(null);
      await utils.childLog.drillThrough.invalidate({ studentId });
    },
  });
  const deleteNote = api.childNotes.delete.useMutation({
    onSuccess: async () => {
      setNoteDelete(null);
      await utils.childLog.drillThrough.invalidate({ studentId });
    },
  });
  const updatePace = api.pace.updateRecord.useMutation({
    onSuccess: async () => {
      setPaceDraft(null);
      await utils.childLog.drillThrough.invalidate({ studentId });
    },
  });
  const deletePace = api.pace.deleteRecord.useMutation({
    onSuccess: async () => {
      setPaceDelete(null);
      await utils.childLog.drillThrough.invalidate({ studentId });
    },
  });
  const data = drillThroughQuery.data;

  function editBehaviour(entry: BehaviourEntry): void {
    setBehaviourDraft({
      id: entry.id,
      type: entry.type,
      category: entry.category,
      note: entry.note ?? '',
      visibility: entry.visibility,
      amount: String(
        entry.type === 'Demerit' ? Math.abs(entry.meritDelta) : Math.max(entry.meritDelta, 1),
      ),
    });
  }

  async function submitBehaviourCorrection(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!behaviourDraft) return;
    await updateBehaviour.mutateAsync({
      id: behaviourDraft.id,
      category: behaviourDraft.category,
      note: behaviourDraft.note.trim() ? behaviourDraft.note : null,
      visibility: behaviourDraft.visibility,
      ...(behaviourDraft.type !== 'General' ? { amount: Number(behaviourDraft.amount) } : {}),
    });
  }

  async function submitNoteCorrection(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!noteDraft) return;
    await updateNote.mutateAsync({
      id: noteDraft.id,
      note: noteDraft.note,
      sensitive: noteDraft.sensitive,
    });
  }

  async function savePaceCorrection(input: {
    completedAt: string;
    recordId: string;
    score: number;
    startedAt: string;
  }): Promise<void> {
    await updatePace.mutateAsync({
      completedAt: asDate(input.completedAt),
      recordId: input.recordId,
      score: input.score,
      startedAt: asDate(input.startedAt),
    });
  }

  if (drillThroughQuery.isLoading) {
    return <div className="empty-state">Loading student record...</div>;
  }

  if (drillThroughQuery.error || !data) {
    return (
      <div className="empty-state status--error">
        {drillThroughQuery.error?.message ?? 'Student record not found'}
      </div>
    );
  }

  return (
    <div className="student-drillthrough">
      <StudentHero backHref={backHref} backLabel={backLabel} data={data} onEdit={onEdit} />
      <StudentTabs activeTab={activeTab} onSelect={setActiveTab} />
      {activeTab === 'overview' ? (
        <OverviewTab
          canManageCorrections={canManageCorrections}
          data={data}
          onDeletePace={setPaceDelete}
          onEditPace={setPaceDraft}
        />
      ) : null}
      {activeTab === 'attendance' ? <AttendanceTab data={data} /> : null}
      {activeTab === 'behaviour' ? (
        <BehaviourTab
          canManageCorrections={canManageCorrections}
          data={data}
          onDelete={setBehaviourDelete}
          onEdit={editBehaviour}
        />
      ) : null}
      {activeTab === 'pace' ? (
        <PaceTab
          canManageCorrections={canManageCorrections}
          data={data}
          onDelete={setPaceDelete}
          onEdit={setPaceDraft}
        />
      ) : null}
      {activeTab === 'merits' ? <MeritsTab data={data} /> : null}
      {activeTab === 'notes' ? (
        <NotesTab
          canManageCorrections={canManageCorrections}
          data={data}
          onDelete={setNoteDelete}
          onEdit={(note) => {
            setNoteDraft({ id: note.id, note: note.note, sensitive: note.sensitive });
          }}
        />
      ) : null}
      {behaviourDraft ? (
        <CorrectionModal
          errorMessage={updateBehaviour.error?.message}
          onClose={() => {
            if (!updateBehaviour.isPending) setBehaviourDraft(null);
          }}
          pending={updateBehaviour.isPending}
          title="Edit behaviour entry"
        >
          <form
            className="form-grid"
            onSubmit={(event) => {
              void submitBehaviourCorrection(event);
            }}
          >
            <Field label="Category">
              <SelectInput
                aria-label="Behaviour category"
                onChange={(event) => {
                  setBehaviourDraft((current) =>
                    current ? { ...current, category: event.target.value } : current,
                  );
                }}
                required
                value={behaviourDraft.category}
              >
                {categoriesFor(behaviourDraft.type).map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Notes">
              <textarea
                aria-label="Behaviour note"
                className="input textarea"
                maxLength={2000}
                onChange={(event) => {
                  setBehaviourDraft((current) =>
                    current ? { ...current, note: event.target.value } : current,
                  );
                }}
                required={behaviourDraft.type === 'General'}
                rows={4}
                value={behaviourDraft.note}
              />
            </Field>
            <Field label="Visibility">
              <SelectInput
                aria-label="Behaviour visibility"
                onChange={(event) => {
                  setBehaviourDraft((current) =>
                    current
                      ? {
                          ...current,
                          visibility: event.target.value as BehaviourEntry['visibility'],
                        }
                      : current,
                  );
                }}
                value={behaviourDraft.visibility}
              >
                <option value="General">General</option>
                <option value="Sensitive">Sensitive</option>
              </SelectInput>
            </Field>
            {behaviourDraft.type !== 'General' ? (
              <Field label={behaviourDraft.type === 'Merit' ? 'Merit amount' : 'Demerit deduction'}>
                <TextInput
                  aria-label={
                    behaviourDraft.type === 'Merit' ? 'Merit amount' : 'Demerit deduction'
                  }
                  min={1}
                  onChange={(event) => {
                    setBehaviourDraft((current) =>
                      current ? { ...current, amount: event.target.value } : current,
                    );
                  }}
                  required
                  type="number"
                  value={behaviourDraft.amount}
                />
              </Field>
            ) : null}
            <Button pending={updateBehaviour.isPending} type="submit">
              Save entry
            </Button>
          </form>
        </CorrectionModal>
      ) : null}
      {noteDraft ? (
        <CorrectionModal
          errorMessage={updateNote.error?.message}
          onClose={() => {
            if (!updateNote.isPending) setNoteDraft(null);
          }}
          pending={updateNote.isPending}
          title="Edit note"
        >
          <form
            className="form-grid"
            onSubmit={(event) => {
              void submitNoteCorrection(event);
            }}
          >
            <textarea
              aria-label="Child note"
              className="input textarea"
              maxLength={3000}
              onChange={(event) => {
                setNoteDraft((current) =>
                  current ? { ...current, note: event.target.value } : current,
                );
              }}
              required
              rows={4}
              value={noteDraft.note}
            />
            <SelectInput
              aria-label="Note sensitivity"
              onChange={(event) => {
                setNoteDraft((current) =>
                  current ? { ...current, sensitive: event.target.value === 'true' } : current,
                );
              }}
              value={String(noteDraft.sensitive)}
            >
              <option value="false">General</option>
              <option value="true">Sensitive</option>
            </SelectInput>
            <Button pending={updateNote.isPending} type="submit">
              Save note
            </Button>
          </form>
        </CorrectionModal>
      ) : null}
      {paceDraft ? (
        <PaceRecordEditModal
          errorMessage={updatePace.error?.message}
          onClose={() => {
            if (!updatePace.isPending) setPaceDraft(null);
          }}
          onSave={savePaceCorrection}
          pending={updatePace.isPending}
          record={drillThroughPaceToEditable(data.student.fullName, paceDraft)}
        />
      ) : null}
      <ConfirmationDialog
        confirmLabel="Delete entry"
        errorMessage={deleteBehaviour.error?.message}
        onCancel={() => {
          if (!deleteBehaviour.isPending) setBehaviourDelete(null);
        }}
        onConfirm={() => {
          if (behaviourDelete) void deleteBehaviour.mutateAsync({ id: behaviourDelete.id });
        }}
        open={behaviourDelete !== null}
        pending={deleteBehaviour.isPending}
        title="Delete behaviour entry?"
      >
        <p>This removes the entry from views and applies any merit correction rows.</p>
      </ConfirmationDialog>
      <ConfirmationDialog
        confirmLabel="Delete note"
        errorMessage={deleteNote.error?.message}
        onCancel={() => {
          if (!deleteNote.isPending) setNoteDelete(null);
        }}
        onConfirm={() => {
          if (noteDelete) void deleteNote.mutateAsync({ id: noteDelete.id });
        }}
        open={noteDelete !== null}
        pending={deleteNote.isPending}
        title="Delete note?"
      >
        <p>This removes the note from student views while keeping an audit trail.</p>
      </ConfirmationDialog>
      <ConfirmationDialog
        confirmLabel="Delete test"
        errorMessage={deletePace.error?.message}
        onCancel={() => {
          if (!deletePace.isPending) setPaceDelete(null);
        }}
        onConfirm={() => {
          if (paceDelete) void deletePace.mutateAsync({ recordId: paceDelete.id });
        }}
        open={paceDelete !== null}
        pending={deletePace.isPending}
        title="Delete PACE test?"
      >
        <p>This permanently removes the test record and recalculates PACE progress.</p>
      </ConfirmationDialog>
    </div>
  );
}

function drillThroughPaceToEditable(studentName: string, entry: PaceEntry): EditablePaceRecord {
  return {
    id: entry.id,
    completedAt: entry.completedAt,
    createdAt: entry.createdAt,
    paceNumber: entry.paceNumber,
    score: entry.score,
    startedAt: entry.startedAt,
    studentName,
    subjectName: entry.subjectName,
    testType: entry.testType,
  };
}

function CorrectionModal({
  children,
  errorMessage,
  onClose,
  pending,
  title,
}: {
  children: ReactNode;
  errorMessage?: string | undefined;
  onClose: () => void;
  pending: boolean;
  title: string;
}) {
  return (
    <div className="admin-confirmation-backdrop">
      <section aria-modal="true" className="admin-confirmation-dialog" role="dialog">
        <header className="admin-confirmation-dialog__header">
          <div>
            <h2>{title}</h2>
          </div>
          <Button
            aria-label="Close"
            disabled={pending}
            onClick={onClose}
            size="sm"
            type="button"
            variant="ghost"
          >
            <X aria-hidden="true" size={16} />
          </Button>
        </header>
        {errorMessage ? <p className="status--error">{errorMessage}</p> : null}
        {children}
      </section>
    </div>
  );
}

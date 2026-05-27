'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { BarChart3, Edit3, Lock, Plus, Trash2 } from 'lucide-react';
import { displaySchoolYearLabel } from '@oasis/domain';
import { ConfirmationDialog } from '@/components/admin/confirmation-dialog';
import { Button } from '@/components/ui/button';
import { Field, SelectInput, TextInput } from '@/components/ui/field';
import { friendlyErrorMessage, showErrorToast, showSuccessToast } from '@/lib/notifications';
import { api, type RouterOutputs } from '@/lib/trpc';
import { useDailyDemeritStatusMap } from '@/components/behaviour/daily-demerit-badge';
import { BehaviourStudentSelector } from '@/components/behaviour/behaviour-student-selector';
import {
  categoriesFor,
  meritCategories,
  type BehaviourType,
} from '@/components/behaviour/behaviour-categories';
import {
  DemeritStagePreviewPanel,
  previewBatchDemeritStage,
  previewSingleDemeritStage,
} from '@/components/behaviour/demerit-stage-preview';

type BatchBehaviourType = Exclude<BehaviourType, 'General'>;
type BehaviourVisibility = 'General' | 'Sensitive';
export type BehaviourSensitiveMode = 'none' | 'demerit-only' | 'all';
type TrendBucket = 'daily' | 'weekly' | 'monthly';
type EntryMode = 'single' | 'batch';
type RecentBehaviourEntry = RouterOutputs['behaviour']['recentEntries']['entries'][number];

interface BatchEntryForm {
  id: string;
  category: string;
  note: string;
  amount: string;
  count: string;
}

interface EditingEntryForm {
  id: string;
  type: BehaviourType;
  category: string;
  note: string;
  visibility: BehaviourVisibility;
  amount: string;
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function defaultFrom(): string {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return dateKey(date);
}

function formatTime(value: Date | string): string {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function avatarColour(index: number): string {
  return ['#7C3F98', '#8B1E2D', '#0E7892', '#5B90C5', '#006B4A', '#B45309'][index % 6] ?? '#5B90C5';
}

function canUseSensitiveMode(mode: BehaviourSensitiveMode, type: BehaviourType): boolean {
  return mode === 'all' || (mode === 'demerit-only' && (type === 'Demerit' || type === 'General'));
}

function newBatchEntry(type: BatchBehaviourType): BatchEntryForm {
  const categories = categoriesFor(type);
  return {
    id: crypto.randomUUID(),
    category: categories[0] ?? 'Misc',
    note: '',
    amount: '1',
    count: '1',
  };
}

function totalBatchEntries(entries: readonly BatchEntryForm[]): number {
  return entries.reduce((sum, entry) => sum + (Number(entry.count) || 0), 0);
}

function studentCountLabel(count: number): string {
  return `${String(count)} ${count === 1 ? 'student' : 'students'}`;
}

function singleEntrySuccessMessage(type: BehaviourType, studentCount: number): string {
  if (type === 'Merit') return `Merit recorded for ${studentCountLabel(studentCount)}.`;
  if (type === 'Demerit') return `Demerit recorded for ${studentCountLabel(studentCount)}.`;
  return `General mark recorded for ${studentCountLabel(studentCount)}.`;
}

function batchEntrySuccessMessage(
  type: BatchBehaviourType,
  entryCount: number,
  studentCount: number,
): string {
  return `${String(entryCount)} ${type.toLowerCase()} ${
    entryCount === 1 ? 'entry' : 'entries'
  } recorded for ${studentCountLabel(studentCount)}.`;
}

export function BehaviourLogClient({
  canManageEntries,
  canLogBehaviour,
  sensitiveMode,
  showTrends = false,
}: {
  canManageEntries: boolean;
  canLogBehaviour: boolean;
  sensitiveMode: BehaviourSensitiveMode;
  showTrends?: boolean;
}) {
  const [type, setType] = useState<BehaviourType>('Merit');
  const [entryMode, setEntryMode] = useState<EntryMode>('single');
  const [batchType, setBatchType] = useState<BatchBehaviourType>('Merit');
  const [batchEntries, setBatchEntries] = useState<BatchEntryForm[]>(() => [
    newBatchEntry('Merit'),
  ]);
  const [studentIds, setStudentIds] = useState<string[]>([]);
  const [category, setCategory] = useState<string>(meritCategories[0]);
  const [note, setNote] = useState('');
  const [visibility, setVisibility] = useState<BehaviourVisibility>('General');
  const [amount, setAmount] = useState('5');
  const [date, setDate] = useState(dateKey(new Date()));
  const [editingEntry, setEditingEntry] = useState<EditingEntryForm | null>(null);
  const [deleteEntry, setDeleteEntry] = useState<RecentBehaviourEntry | null>(null);
  const selectedDateValue = useMemo(() => new Date(`${date}T00:00:00.000Z`), [date]);

  const studentsQuery = api.student.list.useQuery(undefined, { retry: false });
  const recentQuery = api.behaviour.recentEntries.useQuery(
    { date: selectedDateValue },
    { retry: false },
  );
  const demeritStatusQuery = useDailyDemeritStatusMap(selectedDateValue);
  const utils = api.useUtils();
  const logBehaviour = api.behaviour.logForStudents.useMutation({
    onSuccess: async (_result, input) => {
      showSuccessToast(singleEntrySuccessMessage(input.type, input.studentIds.length));
      setNote('');
      setVisibility(
        canUseSensitiveMode(sensitiveMode, input.type) &&
          (input.type === 'General' || input.type === 'Demerit')
          ? 'Sensitive'
          : 'General',
      );
      await Promise.all([
        utils.behaviour.recentEntries.invalidate({ date: new Date(`${date}T00:00:00.000Z`) }),
        utils.behaviour.trends.invalidate(),
        utils.behaviour.dailyDemeritStatuses.invalidate({ date: selectedDateValue }),
        utils.childLog.supervisorNotesHistory.invalidate(),
      ]);
    },
    onError: (error) => {
      showErrorToast(error, 'Behaviour could not be saved.');
    },
  });
  const logManyBehaviour = api.behaviour.logManyForStudents.useMutation({
    onSuccess: async (_result, input) => {
      showSuccessToast(
        batchEntrySuccessMessage(input.type, input.entries.length, input.studentIds.length),
      );
      setBatchEntries([newBatchEntry(input.type)]);
      await Promise.all([
        utils.behaviour.recentEntries.invalidate({ date: new Date(`${date}T00:00:00.000Z`) }),
        utils.behaviour.trends.invalidate(),
        utils.behaviour.dailyDemeritStatuses.invalidate({ date: selectedDateValue }),
        utils.childLog.supervisorNotesHistory.invalidate(),
      ]);
    },
    onError: (error) => {
      showErrorToast(error, 'Behaviour entries could not be saved.');
    },
  });
  const updateEntry = api.behaviour.updateEntry.useMutation({
    onSuccess: async () => {
      showSuccessToast('Behaviour entry updated.');
      setEditingEntry(null);
      await Promise.all([
        utils.behaviour.recentEntries.invalidate({ date: new Date(`${date}T00:00:00.000Z`) }),
        utils.behaviour.trends.invalidate(),
        utils.behaviour.dailyDemeritStatuses.invalidate({ date: selectedDateValue }),
      ]);
    },
    onError: (error) => {
      showErrorToast(error, 'Behaviour entry could not be updated.');
    },
  });
  const deleteEntryMutation = api.behaviour.deleteEntry.useMutation({
    onSuccess: async () => {
      showSuccessToast('Behaviour entry deleted.');
      setDeleteEntry(null);
      await Promise.all([
        utils.behaviour.recentEntries.invalidate({ date: new Date(`${date}T00:00:00.000Z`) }),
        utils.behaviour.trends.invalidate(),
        utils.behaviour.dailyDemeritStatuses.invalidate({ date: selectedDateValue }),
      ]);
    },
    onError: (error) => {
      showErrorToast(error, 'Behaviour entry could not be deleted.');
    },
  });

  const categories = categoriesFor(type);
  const batchCategories = categoriesFor(batchType);
  const entries = recentQuery.data?.entries ?? [];
  const students = useMemo(() => studentsQuery.data ?? [], [studentsQuery.data]);
  const studentOptions = useMemo(
    () =>
      students.map((student) => ({
        id: student.id,
        label: student.fullName,
        description: displaySchoolYearLabel(student.yearGroup),
        demeritStatus: demeritStatusQuery.statusByStudentId.get(student.id),
      })),
    [demeritStatusQuery.statusByStudentId, students],
  );
  const allStudentIds = useMemo(
    () => studentOptions.map((student) => student.id),
    [studentOptions],
  );
  const selectedStudentCount = studentIds.length;
  const batchEntryCount = totalBatchEntries(batchEntries);
  const singleDemeritPreview = useMemo(
    () =>
      type === 'Demerit'
        ? previewSingleDemeritStage(studentIds, demeritStatusQuery.statusByStudentId, category)
        : null,
    [category, demeritStatusQuery.statusByStudentId, studentIds, type],
  );
  const batchDemeritPreview = useMemo(
    () =>
      batchType === 'Demerit'
        ? previewBatchDemeritStage(studentIds, demeritStatusQuery.statusByStudentId, batchEntries)
        : null,
    [batchEntries, batchType, demeritStatusQuery.statusByStudentId, studentIds],
  );

  useEffect(() => {
    const firstStudent = studentsQuery.data?.[0];
    if (studentIds.length === 0 && firstStudent) setStudentIds([firstStudent.id]);
  }, [studentIds.length, studentsQuery.data]);

  useEffect(() => {
    setStudentIds((current) => current.filter((studentId) => allStudentIds.includes(studentId)));
  }, [allStudentIds]);

  useEffect(() => {
    setCategory((current) => (categories.includes(current) ? current : (categories[0] ?? 'Misc')));
  }, [categories]);

  useEffect(() => {
    if (visibility === 'Sensitive' && !canUseSensitiveMode(sensitiveMode, type)) {
      setVisibility('General');
    }
  }, [sensitiveMode, type, visibility]);

  function chooseVisibility(next: BehaviourVisibility): void {
    if (next === 'Sensitive' && !canUseSensitiveMode(sensitiveMode, type)) return;
    setVisibility(next);
  }

  function chooseStudents(values: readonly string[]): void {
    setStudentIds(values.filter((value) => allStudentIds.includes(value)));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canLogBehaviour || studentIds.length === 0) return;
    try {
      await logBehaviour.mutateAsync({
        studentIds,
        type,
        category,
        note: note.trim() ? note : undefined,
        visibility,
        ...(type === 'Merit' ? { amount: Number(amount) } : {}),
      });
    } catch {
      // Mutation onError shows the friendly notification.
    }
  }

  async function submitBatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canLogBehaviour || studentIds.length === 0) return;
    try {
      await logManyBehaviour.mutateAsync({
        studentIds,
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

  function startEditingEntry(entry: RecentBehaviourEntry): void {
    setEditingEntry({
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

  async function submitEntryEdit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!editingEntry) return;
    try {
      await updateEntry.mutateAsync({
        id: editingEntry.id,
        category: editingEntry.category,
        note: editingEntry.note.trim() ? editingEntry.note : null,
        visibility: editingEntry.visibility,
        ...(editingEntry.type === 'Merit' ? { amount: Number(editingEntry.amount) } : {}),
      });
    } catch {
      // Mutation onError shows the friendly notification.
    }
  }

  return (
    <div className="behaviour-log-page">
      <h1>Behaviour Log</h1>

      <div className="behaviour-log-layout">
        <section className="panel panel__body behaviour-log-form-card">
          <h2>Log New Entry</h2>
          {!canLogBehaviour ? (
            <div className="workflow-alert">
              Behaviour reporting access is enabled for this account. Recording new entries still
              requires Head/full-admin or Supervisor access.
            </div>
          ) : null}
          <div aria-label="Entry mode" className="behaviour-toggle" role="group">
            {(['single', 'batch'] as const).map((mode) => (
              <button
                className={mode === entryMode ? 'is-selected' : undefined}
                disabled={!canLogBehaviour}
                key={mode}
                onClick={() => {
                  setEntryMode(mode);
                }}
                type="button"
              >
                {mode === 'single' ? 'Single' : 'Batch'}
              </button>
            ))}
          </div>
          {entryMode === 'single' ? (
            <form
              className="behaviour-log-form"
              onSubmit={(event) => {
                void submit(event);
              }}
            >
              <div aria-label="Behaviour type" className="behaviour-toggle" role="group">
                {(['Merit', 'Demerit', 'General'] as const).map((item) => (
                  <button
                    className={item === type ? `is-selected is-${item.toLowerCase()}` : undefined}
                    disabled={!canLogBehaviour}
                    key={item}
                    onClick={() => {
                      setType(item);
                      setCategory(categoriesFor(item)[0] ?? 'Misc');
                      if (item === 'General') {
                        setVisibility(
                          canUseSensitiveMode(sensitiveMode, item) ? 'Sensitive' : 'General',
                        );
                      }
                      if (item === 'Demerit') {
                        setAmount('5');
                        setVisibility(
                          canUseSensitiveMode(sensitiveMode, item) ? 'Sensitive' : 'General',
                        );
                      }
                    }}
                    type="button"
                  >
                    {item === 'General' ? 'General mark' : item}
                  </button>
                ))}
              </div>

              <BehaviourStudentSelector
                disabled={!canLogBehaviour}
                hint={`${String(selectedStudentCount)} of ${String(students.length)} selected`}
                label="Students"
                loading={studentsQuery.isLoading}
                onChange={chooseStudents}
                options={studentOptions}
                selectedIds={studentIds}
              />

              <Field label="Category">
                <SelectInput
                  aria-label="Category"
                  disabled={!canLogBehaviour}
                  onChange={(event) => {
                    setCategory(event.target.value);
                  }}
                  value={category}
                >
                  {categories.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </SelectInput>
              </Field>

              <Field label="Notes">
                <textarea
                  aria-label="Notes"
                  className="input textarea"
                  disabled={!canLogBehaviour}
                  maxLength={2000}
                  onChange={(event) => {
                    setNote(event.target.value);
                  }}
                  placeholder="Describe the behaviour..."
                  required={type === 'General' || Boolean(singleDemeritPreview?.noteRequired)}
                  rows={4}
                  value={note}
                />
              </Field>
              {type === 'Demerit' ? (
                <DemeritStagePreviewPanel preview={singleDemeritPreview} />
              ) : null}

              <Field label="Visibility">
                <div aria-label="Visibility" className="behaviour-visibility-toggle" role="group">
                  {(['General', 'Sensitive'] as const).map((item) => (
                    <button
                      className={item === visibility ? 'is-selected' : undefined}
                      disabled={
                        !canLogBehaviour ||
                        (item === 'Sensitive' && !canUseSensitiveMode(sensitiveMode, type))
                      }
                      key={item}
                      onClick={() => {
                        chooseVisibility(item);
                      }}
                      type="button"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </Field>
              {visibility === 'Sensitive' ? (
                <p className="behaviour-sensitive-note">
                  <Lock aria-hidden="true" size={13} />
                  Sensitive entries are visible to heads and the recording staff author where
                  allowed.
                </p>
              ) : null}
              {sensitiveMode === 'none' && canLogBehaviour ? (
                <p className="field__hint">
                  Sensitive behaviour entries require Head or Head of Discipline access.
                </p>
              ) : null}
              {sensitiveMode === 'demerit-only' && canLogBehaviour ? (
                <p className="field__hint">
                  Supervisors can mark demerits and General marks as Sensitive.
                </p>
              ) : null}

              {type === 'Merit' ? (
                <Field label="Merit amount">
                  <TextInput
                    aria-label="Merit amount"
                    disabled={!canLogBehaviour}
                    min={1}
                    onChange={(event) => {
                      setAmount(event.target.value);
                    }}
                    required
                    type="number"
                    value={amount}
                  />
                </Field>
              ) : null}
              {type === 'General' ? (
                <p className="field__hint">
                  General marks have no merit value. General visibility notifies linked guardians.
                </p>
              ) : null}

              <Button
                disabled={!canLogBehaviour || selectedStudentCount === 0}
                pending={logBehaviour.isPending}
                type="submit"
              >
                {type === 'Merit'
                  ? `Record +${amount || '0'} Merit`
                  : type === 'Demerit'
                    ? 'Record Demerit'
                    : 'Record General mark'}
              </Button>
              {studentsQuery.error ? (
                <p className="status--error">{friendlyErrorMessage(studentsQuery.error)}</p>
              ) : null}
              {logBehaviour.error ? (
                <p className="status--error">{friendlyErrorMessage(logBehaviour.error)}</p>
              ) : null}
            </form>
          ) : (
            <form
              className="behaviour-log-form"
              onSubmit={(event) => {
                void submitBatch(event);
              }}
            >
              <div aria-label="Batch behaviour type" className="behaviour-toggle" role="group">
                {(['Merit', 'Demerit'] as const).map((item) => (
                  <button
                    className={
                      item === batchType ? `is-selected is-${item.toLowerCase()}` : undefined
                    }
                    disabled={!canLogBehaviour}
                    key={item}
                    onClick={() => {
                      setBatchType(item);
                      setBatchEntries([newBatchEntry(item)]);
                    }}
                    type="button"
                  >
                    {item}
                  </button>
                ))}
              </div>

              <BehaviourStudentSelector
                disabled={!canLogBehaviour}
                hint={`${String(selectedStudentCount)} of ${String(students.length)} selected`}
                label="Students"
                loading={studentsQuery.isLoading}
                onChange={chooseStudents}
                options={studentOptions}
                selectedIds={studentIds}
              />

              {batchEntries.map((entry, index) => (
                <div className="form-grid" key={entry.id}>
                  <Field label={`Entry ${String(index + 1)} category`}>
                    <SelectInput
                      aria-label={`Entry ${String(index + 1)} category`}
                      disabled={!canLogBehaviour}
                      onChange={(event) => {
                        setBatchEntry(entry.id, { category: event.target.value });
                      }}
                      value={entry.category}
                    >
                      {batchCategories.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </SelectInput>
                  </Field>
                  {batchType === 'Merit' ? (
                    <Field label={`Entry ${String(index + 1)} amount`}>
                      <TextInput
                        aria-label={`Entry ${String(index + 1)} merit amount`}
                        disabled={!canLogBehaviour}
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
                      disabled={!canLogBehaviour}
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
                      disabled={!canLogBehaviour}
                      maxLength={2000}
                      onChange={(event) => {
                        setBatchEntry(entry.id, { note: event.target.value });
                      }}
                      required={Boolean(batchDemeritPreview?.noteRequired)}
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
                  setBatchEntries((current) => [...current, newBatchEntry(batchType)]);
                }}
                type="button"
                variant="secondary"
              >
                <Plus aria-hidden="true" size={16} />
                Add entry
              </Button>
              {batchType === 'Demerit' ? (
                <DemeritStagePreviewPanel preview={batchDemeritPreview} />
              ) : null}
              <Button
                disabled={!canLogBehaviour || selectedStudentCount === 0}
                pending={logManyBehaviour.isPending}
                type="submit"
              >
                Record {String(batchEntryCount * Math.max(selectedStudentCount, 1))}{' '}
                {batchType.toLowerCase()}{' '}
                {batchEntryCount * Math.max(selectedStudentCount, 1) === 1 ? 'entry' : 'entries'}
              </Button>
              {studentsQuery.error ? (
                <p className="status--error">{friendlyErrorMessage(studentsQuery.error)}</p>
              ) : null}
              {logManyBehaviour.error ? (
                <p className="status--error">{friendlyErrorMessage(logManyBehaviour.error)}</p>
              ) : null}
            </form>
          )}
        </section>

        <section className="behaviour-recent-panel">
          <div className="section-title">
            <h2>Recent Entries</h2>
            <TextInput
              aria-label="Recent behaviour date"
              onChange={(event) => {
                setDate(event.target.value);
              }}
              type="date"
              value={date}
            />
          </div>
          {recentQuery.isLoading ? (
            <div className="empty-state">Loading recent entries...</div>
          ) : null}
          {recentQuery.error ? (
            <p className="status--error">{friendlyErrorMessage(recentQuery.error)}</p>
          ) : null}
          {!recentQuery.isLoading && entries.length === 0 ? (
            <div className="empty-state">No behaviour entries today.</div>
          ) : null}
          <div className="behaviour-entry-list">
            {entries.map((entry, index) => (
              <article className="panel panel__body behaviour-entry-card" key={entry.id}>
                <span className="behaviour-avatar" style={{ backgroundColor: avatarColour(index) }}>
                  {initials(entry.studentName)}
                </span>
                <div>
                  <div className="behaviour-entry-card__head">
                    <strong>{entry.studentName}</strong>
                    <span
                      className={
                        entry.type === 'General'
                          ? 'head-merit-pill head-merit-pill--sensitive'
                          : entry.meritDelta >= 0
                            ? 'head-merit-pill head-merit-pill--plus'
                            : 'head-merit-pill head-merit-pill--minus'
                      }
                    >
                      {entry.type === 'General'
                        ? 'No merit value'
                        : `${entry.meritDelta >= 0 ? `+${String(entry.meritDelta)}` : String(entry.meritDelta)} merits`}
                    </span>
                    <span className="behaviour-category-pill">{entry.category}</span>
                    {entry.visibility === 'Sensitive' ? (
                      <span className="head-merit-pill head-merit-pill--sensitive">Sensitive</span>
                    ) : null}
                    {canManageEntries ? (
                      <>
                        <Button
                          onClick={() => {
                            startEditingEntry(entry);
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
                            setDeleteEntry(entry);
                          }}
                          size="sm"
                          type="button"
                          variant="danger"
                        >
                          <Trash2 aria-hidden="true" size={14} />
                          Delete
                        </Button>
                      </>
                    ) : null}
                  </div>
                  {entry.note ? <p>{entry.note}</p> : null}
                  <span>
                    by {entry.recordedByName} · {formatTime(entry.createdAt)}
                  </span>
                  {editingEntry?.id === entry.id ? (
                    <form
                      className="form-grid"
                      onSubmit={(event) => {
                        void submitEntryEdit(event);
                      }}
                    >
                      <Field label="Category">
                        <SelectInput
                          onChange={(event) => {
                            setEditingEntry((current) =>
                              current ? { ...current, category: event.target.value } : current,
                            );
                          }}
                          value={editingEntry.category}
                        >
                          {categoriesFor(editingEntry.type).map((item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ))}
                        </SelectInput>
                      </Field>
                      <Field label="Notes">
                        <textarea
                          className="input textarea"
                          maxLength={2000}
                          onChange={(event) => {
                            setEditingEntry((current) =>
                              current ? { ...current, note: event.target.value } : current,
                            );
                          }}
                          required={editingEntry.type === 'General'}
                          rows={3}
                          value={editingEntry.note}
                        />
                      </Field>
                      <Field label="Visibility">
                        <div
                          aria-label="Edit visibility"
                          className="behaviour-visibility-toggle"
                          role="group"
                        >
                          {(['General', 'Sensitive'] as const).map((item) => (
                            <button
                              className={
                                item === editingEntry.visibility ? 'is-selected' : undefined
                              }
                              key={item}
                              onClick={() => {
                                setEditingEntry((current) =>
                                  current ? { ...current, visibility: item } : current,
                                );
                              }}
                              type="button"
                            >
                              {item}
                            </button>
                          ))}
                        </div>
                      </Field>
                      {editingEntry.type === 'Merit' ? (
                        <Field label="Merit amount">
                          <TextInput
                            aria-label="Merit amount"
                            min={1}
                            onChange={(event) => {
                              setEditingEntry((current) =>
                                current ? { ...current, amount: event.target.value } : current,
                              );
                            }}
                            required
                            type="number"
                            value={editingEntry.amount}
                          />
                        </Field>
                      ) : null}
                      {updateEntry.error ? (
                        <p className="status--error" role="alert">
                          {friendlyErrorMessage(updateEntry.error)}
                        </p>
                      ) : null}
                      <div className="lifecycle-actions">
                        <Button pending={updateEntry.isPending} size="sm" type="submit">
                          Save entry
                        </Button>
                        <Button
                          disabled={updateEntry.isPending}
                          onClick={() => {
                            setEditingEntry(null);
                          }}
                          size="sm"
                          type="button"
                          variant="secondary"
                        >
                          Cancel
                        </Button>
                      </div>
                    </form>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      {showTrends ? <BehaviourTrendsPanel /> : null}
      <ConfirmationDialog
        confirmLabel="Delete entry"
        errorMessage={
          deleteEntryMutation.error ? friendlyErrorMessage(deleteEntryMutation.error) : undefined
        }
        onCancel={() => {
          if (!deleteEntryMutation.isPending) setDeleteEntry(null);
        }}
        onConfirm={() => {
          if (deleteEntry) deleteEntryMutation.mutate({ id: deleteEntry.id });
        }}
        open={deleteEntry !== null}
        pending={deleteEntryMutation.isPending}
        title="Delete behaviour entry?"
      >
        <p>
          This removes the entry from operational views and adds correction ledger rows when merit
          balances need adjusting.
        </p>
      </ConfirmationDialog>
    </div>
  );
}

function BehaviourTrendsPanel() {
  const [bucket, setBucket] = useState<TrendBucket>('daily');
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(dateKey(new Date()));

  const trendsQuery = api.behaviour.trends.useQuery(
    {
      bucket,
      from: new Date(`${from}T00:00:00.000Z`),
      to: new Date(`${to}T00:00:00.000Z`),
    },
    { retry: false },
  );

  const maxTotal = useMemo(() => {
    return Math.max(
      1,
      ...(trendsQuery.data?.points ?? []).map((point) => point.meritTotal + point.demeritTotal),
    );
  }, [trendsQuery.data?.points]);

  return (
    <section className="panel panel__body behaviour-trends-panel">
      <div className="section-title">
        <div>
          <h2>Behaviour trends</h2>
          <p className="muted">Toggle daily, weekly, and monthly behaviour totals.</p>
        </div>
        <BarChart3 aria-hidden="true" size={20} />
      </div>
      <div className="form-grid form-grid--two behaviour-report-controls">
        <SelectInput
          aria-label="Trend bucket"
          onChange={(event) => {
            setBucket(event.target.value as TrendBucket);
          }}
          value={bucket}
        >
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </SelectInput>
        <TextInput
          aria-label="Trend from"
          onChange={(event) => {
            setFrom(event.target.value);
          }}
          type="date"
          value={from}
        />
        <TextInput
          aria-label="Trend to"
          onChange={(event) => {
            setTo(event.target.value);
          }}
          type="date"
          value={to}
        />
      </div>
      {trendsQuery.isLoading ? <div className="empty-state">Loading trends...</div> : null}
      {trendsQuery.error ? (
        <p className="status--error">{friendlyErrorMessage(trendsQuery.error)}</p>
      ) : null}
      <div className="behaviour-chart" aria-label="Behaviour trend chart">
        {(trendsQuery.data?.points ?? []).map((point) => {
          const total = point.meritTotal + point.demeritTotal;
          return (
            <div className="behaviour-chart__row" key={point.bucket}>
              <span>{point.bucket}</span>
              <div className="behaviour-chart__track">
                <div
                  className="behaviour-chart__bar"
                  style={{ width: `${String(Math.max(6, Math.round((total / maxTotal) * 100)))}%` }}
                />
              </div>
              <strong>
                +{point.meritTotal} / -{point.demeritTotal} / {point.generalCount} general
              </strong>
            </div>
          );
        })}
      </div>
    </section>
  );
}

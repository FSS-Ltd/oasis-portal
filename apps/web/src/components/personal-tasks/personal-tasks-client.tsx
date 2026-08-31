'use client';

import { type FormEvent, useMemo, useState } from 'react';
import { BellRing, CalendarClock, Check, Circle, Clock3, ListTodo, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Field, TextInput } from '@/components/ui/field';
import { friendlyErrorMessage, showErrorToast, showSuccessToast } from '@/lib/notifications';
import { api, type RouterOutputs } from '@/lib/trpc';

type PersonalTask = RouterOutputs['personalTask']['list'][number];

const dateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  month: 'short',
});

function formatDateTime(value: Date | string): string {
  return dateTimeFormatter.format(new Date(value));
}

function formatRelativeTime(value: Date | string, now: Date): string {
  const elapsedMilliseconds = Math.max(0, now.getTime() - new Date(value).getTime());
  const elapsedMinutes = Math.floor(elapsedMilliseconds / 60_000);

  if (elapsedMinutes < 1) return 'just now';
  if (elapsedMinutes < 60) return `${String(elapsedMinutes)} min ago`;

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${String(elapsedHours)} hr ago`;

  const elapsedDays = Math.floor(elapsedHours / 24);
  return `${String(elapsedDays)} ${elapsedDays === 1 ? 'day' : 'days'} ago`;
}

type TaskTiming = {
  kind: 'deadline' | 'reminder';
  label: string;
  tone: 'default' | 'due' | 'overdue';
};

function taskTimings(task: PersonalTask, now: Date): TaskTiming[] {
  if (task.completedAt) return [];

  const timings: TaskTiming[] = [];

  if (task.dueAt) {
    const deadline = new Date(task.dueAt);
    if (deadline.getTime() < now.getTime()) {
      timings.push({
        kind: 'deadline',
        label: `Deadline passed ${formatRelativeTime(deadline, now)}`,
        tone: 'overdue',
      });
    } else {
      timings.push({ kind: 'deadline', label: `Due ${formatDateTime(deadline)}`, tone: 'default' });
    }
  }

  if (task.reminderAt) {
    const reminderDate = new Date(task.reminderAt);
    if (reminderDate.getTime() <= now.getTime()) {
      timings.push({
        kind: 'reminder',
        label: `Reminder due ${formatRelativeTime(reminderDate, now)}`,
        tone: 'due',
      });
    } else {
      timings.push({
        kind: 'reminder',
        label: `Reminder ${formatDateTime(reminderDate)}`,
        tone: 'default',
      });
    }
  }

  return timings;
}

function TaskRow({
  now,
  onToggleCompleted,
  pending,
  task,
}: {
  now: Date;
  onToggleCompleted: (task: PersonalTask) => void;
  pending: boolean;
  task: PersonalTask;
}) {
  const completed = Boolean(task.completedAt);
  const timings = taskTimings(task, now);

  return (
    <article className={completed ? 'personal-task is-completed' : 'personal-task'}>
      <Button
        aria-label={`Mark ${task.title} as ${completed ? 'incomplete' : 'complete'}`}
        aria-pressed={completed}
        className="personal-task__completion"
        onClick={() => {
          onToggleCompleted(task);
        }}
        pending={pending}
        size="sm"
        type="button"
        variant="ghost"
      >
        {completed ? (
          <Check aria-hidden="true" size={18} strokeWidth={3} />
        ) : (
          <Circle aria-hidden="true" size={18} />
        )}
      </Button>
      <div className="personal-task__content">
        <h3>{task.title}</h3>
        <div className="personal-task__meta">
          <span>
            <Clock3 aria-hidden="true" size={14} />
            Added {formatRelativeTime(task.createdAt, now)}
          </span>
          {timings.map((timing) => (
            <span className={`personal-task__timing is-${timing.tone}`} key={timing.kind}>
              {timing.kind === 'reminder' ? (
                <BellRing aria-hidden="true" size={14} />
              ) : (
                <CalendarClock aria-hidden="true" size={14} />
              )}
              {timing.label}
            </span>
          ))}
          {completed && task.completedAt ? (
            <span>Completed {formatDateTime(task.completedAt)}</span>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function PersonalTasksClient() {
  const utils = api.useUtils();
  const tasksQuery = api.personalTask.list.useQuery(undefined, { retry: false });
  const [title, setTitle] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [reminderAt, setReminderAt] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const now = new Date();

  const refreshTasks = () => utils.personalTask.list.invalidate();
  const createTask = api.personalTask.create.useMutation({
    onError(error) {
      showErrorToast(error, 'Task could not be added.');
    },
    async onSuccess() {
      setDueAt('');
      setFormError(null);
      setReminderAt('');
      setTitle('');
      showSuccessToast('Task added to your list.');
      await refreshTasks();
    },
  });
  const setCompleted = api.personalTask.setCompleted.useMutation({
    onError(error) {
      showErrorToast(error, 'Task status could not be updated.');
    },
    async onSuccess(task) {
      showSuccessToast(task.completedAt ? 'Task completed.' : 'Task reopened.');
      await refreshTasks();
    },
    onSettled() {
      setPendingTaskId(null);
    },
  });

  const tasks = tasksQuery.data ?? [];
  const openTasks = useMemo(() => tasks.filter((task) => !task.completedAt), [tasks]);
  const completedTasks = useMemo(() => tasks.filter((task) => task.completedAt), [tasks]);

  function submitTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setFormError('Enter a task before adding it.');
      return;
    }

    setFormError(null);
    createTask.mutate({
      dueAt: dueAt ? new Date(dueAt) : null,
      reminderAt: reminderAt ? new Date(reminderAt) : null,
      title: trimmedTitle,
    });
  }

  function toggleCompleted(task: PersonalTask) {
    setPendingTaskId(task.id);
    setCompleted.mutate({ completed: !task.completedAt, id: task.id });
  }

  return (
    <div className="personal-tasks">
      <header className="personal-tasks__header">
        <div>
          <p>Daily operations</p>
          <h1>My tasks</h1>
          <p>
            Keep your next actions in one place, with deadlines and reminders that stay private to
            you.
          </p>
        </div>
        <span className="personal-tasks__summary">
          <ListTodo aria-hidden="true" size={16} />
          {String(openTasks.length)} {openTasks.length === 1 ? 'open task' : 'open tasks'}
        </span>
      </header>

      <section aria-labelledby="add-task-title" className="panel personal-tasks__capture">
        <div className="personal-tasks__section-heading">
          <div>
            <p>Add a task</p>
            <h2 id="add-task-title">What needs your attention?</h2>
          </div>
        </div>
        <form className="personal-tasks__form" onSubmit={submitTask}>
          <Field label="Task" required>
            <>
              <TextInput
                aria-describedby={formError ? 'personal-task-title-error' : undefined}
                aria-invalid={formError ? true : undefined}
                aria-required="true"
                autoComplete="off"
                maxLength={180}
                onChange={(event) => {
                  setTitle(event.target.value);
                }}
                placeholder="e.g. Prepare materials for afternoon group"
                required
                value={title}
              />
              {formError ? (
                <span className="field__error" id="personal-task-title-error" role="alert">
                  {formError}
                </span>
              ) : null}
            </>
          </Field>
          <Field hint="Optional" label="Deadline">
            <TextInput
              onChange={(event) => {
                setDueAt(event.target.value);
              }}
              type="datetime-local"
              value={dueAt}
            />
          </Field>
          <Field hint="Optional" label="Reminder">
            <TextInput
              onChange={(event) => {
                setReminderAt(event.target.value);
              }}
              type="datetime-local"
              value={reminderAt}
            />
          </Field>
          <Button className="personal-tasks__add" pending={createTask.isPending} type="submit">
            <Plus aria-hidden="true" size={16} />
            Add task
          </Button>
        </form>
      </section>

      <section aria-labelledby="open-tasks-title" className="panel personal-tasks__list">
        <div className="personal-tasks__section-heading">
          <div>
            <p>Current focus</p>
            <h2 id="open-tasks-title">Open tasks</h2>
          </div>
          {openTasks.length > 0 ? <span>{String(openTasks.length)}</span> : null}
        </div>
        {tasksQuery.isLoading ? <EmptyState title="Loading your tasks…" /> : null}
        {tasksQuery.error ? (
          <EmptyState
            detail={friendlyErrorMessage(tasksQuery.error)}
            title="Tasks are unavailable"
          />
        ) : null}
        {!tasksQuery.isLoading && !tasksQuery.error && openTasks.length === 0 ? (
          <EmptyState
            detail="Add a task above to keep your next action visible."
            title="Nothing open"
          />
        ) : null}
        {openTasks.length > 0 ? (
          <div className="personal-tasks__rows">
            {openTasks.map((task) => (
              <TaskRow
                key={task.id}
                now={now}
                onToggleCompleted={toggleCompleted}
                pending={pendingTaskId === task.id}
                task={task}
              />
            ))}
          </div>
        ) : null}
      </section>

      {completedTasks.length > 0 ? (
        <section aria-labelledby="completed-tasks-title" className="panel personal-tasks__list">
          <div className="personal-tasks__section-heading">
            <div>
              <p>Progress</p>
              <h2 id="completed-tasks-title">Completed</h2>
            </div>
            <span>{String(completedTasks.length)}</span>
          </div>
          <div className="personal-tasks__rows">
            {completedTasks.map((task) => (
              <TaskRow
                key={task.id}
                now={now}
                onToggleCompleted={toggleCompleted}
                pending={pendingTaskId === task.id}
                task={task}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

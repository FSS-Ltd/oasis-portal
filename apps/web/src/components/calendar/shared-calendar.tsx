'use client';

import { type FormEvent, useState } from 'react';
import { Plus, Save, X } from 'lucide-react';
import { api } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Field, SelectInput, TextInput } from '@/components/ui/field';
import { CalendarEventCard } from './calendar-event-card';
import { CalendarMonthView } from './calendar-month-view';
import {
  addMonths,
  currentMonthKey,
  emptyCalendarForm,
  pageCopy,
  type CalendarAudience,
  type CalendarEvent,
  type CalendarFormState,
  type CalendarMode,
} from './calendar-model';

interface SharedCalendarProps {
  canManage: boolean;
  mode: CalendarMode;
}

export function SharedCalendar({ canManage, mode }: SharedCalendarProps) {
  const utils = api.useUtils();
  const [form, setForm] = useState<CalendarFormState>(emptyCalendarForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formStatus, setFormStatus] = useState<string | null>(null);
  const [monthKey, setMonthKey] = useState(currentMonthKey);
  const [pendingArchiveId, setPendingArchiveId] = useState<string | null>(null);

  const copy = pageCopy[mode];
  const adminEventsQuery = api.calendar.listForAdmin.useQuery(undefined, {
    enabled: canManage,
    retry: false,
  });
  const visibleEventsQuery = api.calendar.listVisible.useQuery(undefined, {
    enabled: !canManage,
    retry: false,
  });
  const eventsQuery = canManage ? adminEventsQuery : visibleEventsQuery;

  const invalidateCalendar = async () => {
    await Promise.all([
      utils.calendar.listForAdmin.invalidate(),
      utils.calendar.listForStaff.invalidate(),
      utils.calendar.listForParents.invalidate(),
      utils.calendar.listVisible.invalidate(),
    ]);
  };

  const createEvent = api.calendar.create.useMutation({
    onSuccess: async () => {
      setForm(emptyCalendarForm());
      setEditingId(null);
      setFormStatus('Calendar date published.');
      await invalidateCalendar();
    },
  });
  const updateEvent = api.calendar.update.useMutation({
    onSuccess: async () => {
      setForm(emptyCalendarForm());
      setEditingId(null);
      setFormStatus('Calendar date updated.');
      await invalidateCalendar();
    },
  });
  const archiveEvent = api.calendar.archive.useMutation({
    onSettled: () => {
      setPendingArchiveId(null);
    },
    onSuccess: async () => {
      setFormStatus('Calendar date archived.');
      await invalidateCalendar();
    },
  });

  const events: CalendarEvent[] = eventsQuery.data ?? [];
  const activeCount = events.filter((event) => event.active).length;
  const activeEvents = events.filter((event) => event.active);
  const mutationError = createEvent.error ?? updateEvent.error ?? archiveEvent.error;
  const listDescription = canManage
    ? copy.listDescription
    : 'Published dates visible to your portal.';

  async function submitEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = form.title.trim();
    const description = form.description.trim();
    const endDate = form.endDate || form.startDate;

    setFormStatus(null);
    if (!title || !form.startDate) {
      setFormError('Title and start date are required.');
      return;
    }
    if (endDate < form.startDate) {
      setFormError('End date must be on or after the start date.');
      return;
    }

    setFormError(null);
    const payload = {
      title,
      audience: form.audience,
      startDate: form.startDate,
      endDate,
      ...(description ? { description } : {}),
    };

    try {
      if (editingId) {
        await updateEvent.mutateAsync({ id: editingId, ...payload });
        return;
      }

      await createEvent.mutateAsync(payload);
    } catch {
      // React Query exposes the mutation error below the form.
    }
  }

  function editEvent(event: CalendarEvent): void {
    setForm({
      title: event.title,
      description: event.description ?? '',
      audience: event.audience,
      startDate: event.startDate,
      endDate: event.endDate === event.startDate ? '' : event.endDate,
    });
    setEditingId(event.id);
    setFormError(null);
    setFormStatus(null);
  }

  function cancelEdit(): void {
    setForm(emptyCalendarForm());
    setEditingId(null);
    setFormError(null);
  }

  function archiveCalendarEvent(eventId: string): void {
    setPendingArchiveId(eventId);
    archiveEvent.mutate({ id: eventId });
  }

  return (
    <div className="calendar-page">
      <div className="dashboard-hero">
        <p>{copy.eyebrow}</p>
        <h1>{copy.heading}</h1>
        <span>{activeCount === 1 ? '1 active date' : `${String(activeCount)} active dates`}</span>
      </div>

      <div className={canManage ? 'calendar-layout' : 'calendar-layout calendar-layout--single'}>
        {canManage ? (
          <section
            className="panel panel__body calendar-composer"
            aria-labelledby="calendar-form-title"
          >
            <div className="section-title">
              <div>
                <h2 id="calendar-form-title">{editingId ? 'Edit Date' : 'Add Date'}</h2>
                <p className="muted">
                  Publish one-day dates or ranges for selected portal audiences.
                </p>
              </div>
            </div>
            <form
              className="calendar-form"
              onSubmit={(event) => {
                void submitEvent(event);
              }}
            >
              <Field label="Title" required>
                <TextInput
                  maxLength={160}
                  onChange={(event) => {
                    setForm((current) => ({ ...current, title: event.target.value }));
                  }}
                  placeholder="Half-term"
                  required
                  value={form.title}
                />
              </Field>
              <Field label="Description" hint="Optional">
                <textarea
                  className="input textarea"
                  maxLength={4000}
                  onChange={(event) => {
                    setForm((current) => ({ ...current, description: event.target.value }));
                  }}
                  placeholder="Short note for the selected audience"
                  rows={5}
                  value={form.description}
                />
              </Field>
              <Field label="Audience" required>
                <SelectInput
                  onChange={(event) => {
                    setForm((current) => ({
                      ...current,
                      audience: event.target.value as CalendarAudience,
                    }));
                  }}
                  required
                  value={form.audience}
                >
                  <option value="All">All portals</option>
                  <option value="Parents">Parents</option>
                  <option value="Supervisors">Supervisors</option>
                </SelectInput>
              </Field>
              <div className="form-grid form-grid--two">
                <Field label="Start date" required>
                  <TextInput
                    onChange={(event) => {
                      setForm((current) => ({ ...current, startDate: event.target.value }));
                    }}
                    required
                    type="date"
                    value={form.startDate}
                  />
                </Field>
                <Field label="End date" hint="Optional">
                  <TextInput
                    onChange={(event) => {
                      setForm((current) => ({ ...current, endDate: event.target.value }));
                    }}
                    type="date"
                    value={form.endDate}
                  />
                </Field>
              </div>
              <div className="calendar-form__actions">
                <Button pending={createEvent.isPending || updateEvent.isPending} type="submit">
                  {editingId ? (
                    <Save aria-hidden="true" size={16} />
                  ) : (
                    <Plus aria-hidden="true" size={16} />
                  )}
                  {editingId ? 'Save Date' : 'Add Date'}
                </Button>
                {editingId ? (
                  <Button onClick={cancelEdit} type="button" variant="secondary">
                    <X aria-hidden="true" size={16} />
                    Cancel
                  </Button>
                ) : null}
              </div>
              {formStatus ? <p className="status--success">{formStatus}</p> : null}
              {formError ? <p className="status--error">{formError}</p> : null}
              {mutationError ? <p className="status--error">{mutationError.message}</p> : null}
            </form>
          </section>
        ) : null}

        <div className="calendar-view-stack">
          <CalendarMonthView
            events={activeEvents}
            monthKey={monthKey}
            onNextMonth={() => {
              setMonthKey((current) => addMonths(current, 1));
            }}
            onPreviousMonth={() => {
              setMonthKey((current) => addMonths(current, -1));
            }}
            onToday={() => {
              setMonthKey(currentMonthKey());
            }}
          />

          <section
            className="panel panel__body calendar-list-panel"
            aria-labelledby="calendar-list-title"
          >
            <div className="section-title">
              <div>
                <h2 id="calendar-list-title">{copy.listTitle}</h2>
                <p className="muted">{listDescription}</p>
              </div>
              <span className="badge badge--blue">{String(activeCount)} active</span>
            </div>

            {eventsQuery.isLoading ? <div className="empty-state">{copy.loading}</div> : null}
            {eventsQuery.error ? (
              <p className="status--error">{eventsQuery.error.message}</p>
            ) : null}
            {!eventsQuery.isLoading && events.length === 0 ? (
              <div className="empty-state">{copy.empty}</div>
            ) : null}
            <div className="calendar-list" aria-label={copy.listTitle}>
              {events.map((event) => (
                <CalendarEventCard
                  canManage={canManage}
                  event={event}
                  key={event.id}
                  onArchive={archiveCalendarEvent}
                  onEdit={editEvent}
                  pendingArchive={pendingArchiveId === event.id}
                />
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

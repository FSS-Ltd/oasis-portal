'use client';

import { type FormEvent, useState } from 'react';
import { Plus, Save, X } from 'lucide-react';
import { friendlyErrorMessage, showErrorToast, showSuccessToast } from '@/lib/notifications';
import { roleLabel } from '@/lib/profile-display';
import { api } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Field, SelectInput, TextInput } from '@/components/ui/field';
import { CalendarEventCard } from './calendar-event-card';
import { CalendarEventDetailModal } from './calendar-event-detail-modal';
import { CalendarMonthView } from './calendar-month-view';
import {
  addMonths,
  categoryClassNames,
  categoryLabels,
  currentMonthKey,
  editableCategories,
  emptyCalendarForm,
  eventOverlapsMonth,
  formatMonthLabel,
  legendCategories,
  pageCopy,
  type CalendarAudience,
  type CalendarCategory,
  type CalendarEvent,
  type CalendarFormState,
  type CalendarMode,
  type CalendarSelectionMode,
} from './calendar-model';

interface SharedCalendarProps {
  canAssignRequiredPeople?: boolean;
  canManage: boolean;
  mode: CalendarMode;
}

export function SharedCalendar({
  canAssignRequiredPeople = false,
  canManage,
  mode,
}: SharedCalendarProps) {
  const utils = api.useUtils();
  const [form, setForm] = useState<CalendarFormState>(emptyCalendarForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [monthKey, setMonthKey] = useState(currentMonthKey);
  const [pendingArchiveId, setPendingArchiveId] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  const copy = pageCopy[mode];
  const adminEventsQuery = api.calendar.listForAdmin.useQuery(undefined, {
    enabled: canManage,
    retry: false,
  });
  const visibleEventsQuery = api.calendar.listVisible.useQuery(undefined, {
    enabled: !canManage,
    retry: false,
  });
  const requiredPeopleQuery = api.calendar.listRequiredPersonCandidates.useQuery(undefined, {
    enabled: canAssignRequiredPeople,
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
      showSuccessToast('Calendar date published.');
      await invalidateCalendar();
    },
    onError(error) {
      showErrorToast(error, 'Calendar date could not be published.');
    },
  });
  const updateEvent = api.calendar.update.useMutation({
    onSuccess: async () => {
      setForm(emptyCalendarForm());
      setEditingId(null);
      showSuccessToast('Calendar date updated.');
      await invalidateCalendar();
    },
    onError(error) {
      showErrorToast(error, 'Calendar date could not be updated.');
    },
  });
  const archiveEvent = api.calendar.archive.useMutation({
    onSettled: () => {
      setPendingArchiveId(null);
    },
    onSuccess: async () => {
      showSuccessToast('Calendar date archived.');
      await invalidateCalendar();
    },
    onError(error) {
      showErrorToast(error, 'Calendar date could not be archived.');
    },
  });

  const events: CalendarEvent[] = eventsQuery.data ?? [];
  const activeEvents = events.filter((event) => event.active);
  const monthEvents = events.filter((event) => eventOverlapsMonth(event, monthKey));
  const monthActiveCount = monthEvents.filter((event) => event.active).length;
  const activeCount = activeEvents.length;
  const mutationError = createEvent.error ?? updateEvent.error ?? archiveEvent.error;
  const requiredPeople = requiredPeopleQuery.data ?? [];
  const listDescription = canManage
    ? `${copy.listDescription} Showing ${formatMonthLabel(monthKey)}.`
    : `Published dates visible to your portal in ${formatMonthLabel(monthKey)}.`;
  const isSingleDate = form.selectionMode === 'single';

  async function submitEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = form.title.trim();
    const description = form.description.trim();
    const endDate = form.endDate || form.startDate;

    if (!title || !form.startDate) {
      setFormError('Title and start date are required.');
      return;
    }
    if (endDate < form.startDate) {
      setFormError('End date must be on or after the start date.');
      return;
    }
    if (form.selectionMode === 'range' && !form.endDate) {
      setFormError('Choose an end date for this range.');
      return;
    }
    if ((form.startTime || form.endTime) && !isSingleDate) {
      setFormError('Time range is only available for single-date events.');
      return;
    }
    if ((form.startTime && !form.endTime) || (!form.startTime && form.endTime)) {
      setFormError('Start and end time are both required when adding a time range.');
      return;
    }
    if (form.startTime && form.endTime && form.endTime <= form.startTime) {
      setFormError('End time must be after start time.');
      return;
    }
    if (
      canAssignRequiredPeople &&
      form.audience === 'Custom' &&
      form.requiredPersonIds.length === 0
    ) {
      setFormError('Choose at least one required person for a tagged-only date.');
      return;
    }

    setFormError(null);
    const payload = {
      title,
      audience: form.audience,
      category: form.category,
      startDate: form.startDate,
      endDate,
      ...(form.startTime && form.endTime
        ? { startTime: form.startTime, endTime: form.endTime }
        : {}),
      ...(description ? { description } : {}),
      ...(canAssignRequiredPeople ? { requiredPersonIds: form.requiredPersonIds } : {}),
    };

    try {
      if (editingId) {
        await updateEvent.mutateAsync({ id: editingId, ...payload });
        return;
      }

      await createEvent.mutateAsync(payload);
    } catch {
      // Toast is handled by the mutation onError callback.
    }
  }

  function editEvent(event: CalendarEvent): void {
    setForm({
      title: event.title,
      description: event.description ?? '',
      audience: event.audience,
      category: event.category === 'Birthdays' ? 'OasisDays' : event.category,
      requiredPersonIds: event.requiredPeople.map((person) => person.id),
      selectionMode: event.startDate === event.endDate ? 'single' : 'range',
      startDate: event.startDate,
      endDate: event.endDate === event.startDate ? '' : event.endDate,
      startTime: event.startTime ?? '',
      endTime: event.endTime ?? '',
    });
    setEditingId(event.id);
    setFormError(null);
  }

  function toggleRequiredPerson(userId: string): void {
    setForm((current) => {
      const next = new Set(current.requiredPersonIds);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return { ...current, requiredPersonIds: [...next] };
    });
    setFormError(null);
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

  function selectFormDate(date: string): void {
    if (!canManage) return;
    setForm((current) => ({
      ...current,
      ...selectedDateFormPatch(current, date),
    }));
    setFormError(null);
  }

  function updateEndDate(endDate: string): void {
    setForm((current) => ({
      ...current,
      endDate,
      startTime: endDate && endDate !== current.startDate ? '' : current.startTime,
      endTime: endDate && endDate !== current.startDate ? '' : current.endTime,
    }));
  }

  function updateSelectionMode(selectionMode: CalendarSelectionMode): void {
    setForm((current) => ({
      ...current,
      selectionMode,
      endDate: selectionMode === 'single' ? '' : current.endDate,
      startTime: selectionMode === 'range' ? '' : current.startTime,
      endTime: selectionMode === 'range' ? '' : current.endTime,
    }));
    setFormError(null);
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
                  <option value="Heads">Heads only</option>
                  {canAssignRequiredPeople ? (
                    <option value="Custom">Tagged people only</option>
                  ) : null}
                </SelectInput>
              </Field>
              <Field label="Category" required>
                <SelectInput
                  onChange={(event) => {
                    setForm((current) => ({
                      ...current,
                      category: event.target.value as Exclude<CalendarCategory, 'Birthdays'>,
                    }));
                  }}
                  required
                  value={form.category}
                >
                  {editableCategories.map((category) => (
                    <option key={category} value={category}>
                      {categoryLabels[category]}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="Date selection" required>
                <SelectInput
                  onChange={(event) => {
                    updateSelectionMode(event.target.value as CalendarSelectionMode);
                  }}
                  required
                  value={form.selectionMode}
                >
                  <option value="single">Single date</option>
                  <option value="range">Date range</option>
                </SelectInput>
              </Field>
              <div className="form-grid form-grid--two">
                <Field label={form.selectionMode === 'range' ? 'Start date' : 'Date'} required>
                  <TextInput
                    onChange={(event) => {
                      const startDate = event.target.value;
                      setForm((current) => ({
                        ...current,
                        startDate,
                        endDate:
                          current.selectionMode === 'range' &&
                          current.endDate &&
                          current.endDate >= startDate
                            ? current.endDate
                            : '',
                        startTime: current.selectionMode === 'range' ? '' : current.startTime,
                        endTime: current.selectionMode === 'range' ? '' : current.endTime,
                      }));
                    }}
                    required
                    type="date"
                    value={form.startDate}
                  />
                </Field>
                {form.selectionMode === 'range' ? (
                  <Field label="End date" required>
                    <TextInput
                      min={form.startDate}
                      onChange={(event) => {
                        updateEndDate(event.target.value);
                      }}
                      required
                      type="date"
                      value={form.endDate}
                    />
                  </Field>
                ) : null}
              </div>
              {isSingleDate ? (
                <div className="form-grid form-grid--two">
                  <Field label="Start time" hint="Optional">
                    <TextInput
                      onChange={(event) => {
                        setForm((current) => ({ ...current, startTime: event.target.value }));
                      }}
                      type="time"
                      value={form.startTime}
                    />
                  </Field>
                  <Field label="End time" hint="Optional">
                    <TextInput
                      onChange={(event) => {
                        setForm((current) => ({ ...current, endTime: event.target.value }));
                      }}
                      type="time"
                      value={form.endTime}
                    />
                  </Field>
                </div>
              ) : null}
              {canAssignRequiredPeople ? (
                <div className="field">
                  <span className="field__label">
                    Required people
                    <span className="field__hint">Optional</span>
                  </span>
                  {requiredPeopleQuery.isLoading ? (
                    <div className="empty-state">Loading staff...</div>
                  ) : null}
                  {requiredPeopleQuery.error ? (
                    <p className="status--error">
                      {friendlyErrorMessage(requiredPeopleQuery.error)}
                    </p>
                  ) : null}
                  {!requiredPeopleQuery.isLoading &&
                  !requiredPeopleQuery.error &&
                  requiredPeople.length === 0 ? (
                    <div className="empty-state">No active staff found.</div>
                  ) : null}
                  <div
                    className="calendar-required-picker"
                    role="group"
                    aria-label="Required people"
                  >
                    {requiredPeople.map((person) => {
                      const selected = form.requiredPersonIds.includes(person.id);
                      return (
                        <label
                          className={
                            selected
                              ? 'calendar-required-picker__item is-selected'
                              : 'calendar-required-picker__item'
                          }
                          key={person.id}
                        >
                          <input
                            checked={selected}
                            onChange={() => {
                              toggleRequiredPerson(person.id);
                            }}
                            type="checkbox"
                          />
                          <span>
                            <strong>{person.fullName}</strong>
                            <small>{roleLabel(person.role)}</small>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ) : null}
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
              {formError ? <p className="status--error">{formError}</p> : null}
              {mutationError ? (
                <p className="status--error">{friendlyErrorMessage(mutationError)}</p>
              ) : null}
            </form>
          </section>
        ) : null}

        <div className="calendar-view-stack">
          <CalendarMonthView
            eventOpenMode={canManage ? 'doubleClick' : 'click'}
            events={activeEvents}
            monthKey={monthKey}
            {...(canManage ? { onDateSelect: selectFormDate } : {})}
            {...(canManage
              ? {
                  selection: {
                    mode: form.selectionMode,
                    startDate: form.startDate,
                    endDate: form.selectionMode === 'range' ? form.endDate : '',
                  },
                }
              : {})}
            onEventSelect={(event: CalendarEvent) => {
              setSelectedEvent(event);
            }}
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

          <section className="panel panel__body calendar-legend-panel" aria-label="Calendar legend">
            <div className="calendar-legend">
              {legendCategories.map((category) => (
                <span className="calendar-legend__item" key={category}>
                  <i className={categoryClassNames[category]} aria-hidden="true" />
                  {categoryLabels[category]}
                </span>
              ))}
            </div>
          </section>

          <section
            className="panel panel__body calendar-list-panel"
            aria-labelledby="calendar-list-title"
          >
            <div className="section-title">
              <div>
                <h2 id="calendar-list-title">{copy.listTitle}</h2>
                <p className="muted">{listDescription}</p>
              </div>
              <span className="badge badge--blue">{String(monthActiveCount)} active</span>
            </div>

            {eventsQuery.isLoading ? <div className="empty-state">{copy.loading}</div> : null}
            {eventsQuery.error ? (
              <p className="status--error">{friendlyErrorMessage(eventsQuery.error)}</p>
            ) : null}
            {!eventsQuery.isLoading && monthEvents.length === 0 ? (
              <div className="empty-state">{copy.empty}</div>
            ) : null}
            <div className="calendar-list" aria-label={copy.listTitle}>
              {monthEvents.map((event) => (
                <CalendarEventCard
                  canManage={canManage}
                  event={event}
                  key={event.id}
                  onArchive={archiveCalendarEvent}
                  onEdit={editEvent}
                  onView={(calendarEvent) => {
                    setSelectedEvent(calendarEvent);
                  }}
                  canAssignRequiredPeople={canAssignRequiredPeople}
                  pendingArchive={pendingArchiveId === event.id}
                />
              ))}
            </div>
          </section>
        </div>
      </div>
      {selectedEvent ? (
        <CalendarEventDetailModal
          event={selectedEvent}
          {...(canManage && selectedEvent.source === 'Manual'
            ? {
                onEdit: (event: CalendarEvent) => {
                  editEvent(event);
                  setSelectedEvent(null);
                },
              }
            : {})}
          onClose={() => {
            setSelectedEvent(null);
          }}
        />
      ) : null}
    </div>
  );
}

function selectedDateFormPatch(
  current: CalendarFormState,
  date: string,
): Pick<CalendarFormState, 'endDate' | 'endTime' | 'startDate' | 'startTime'> {
  if (current.selectionMode === 'single') {
    return {
      startDate: date,
      endDate: '',
      startTime: current.startTime,
      endTime: current.endTime,
    };
  }

  if (!current.startDate || current.endDate) {
    return { startDate: date, endDate: '', startTime: '', endTime: '' };
  }

  if (date < current.startDate) {
    return { startDate: date, endDate: current.startDate, startTime: '', endTime: '' };
  }

  return { startDate: current.startDate, endDate: date, startTime: '', endTime: '' };
}

'use client';

import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { displaySchoolYearLabel } from '@oasis/domain';
import {
  Bell,
  ClipboardList,
  Pencil,
  Plus,
  Power,
  PowerOff,
  Save,
  Send,
  UsersRound,
  X,
} from 'lucide-react';
import { api, type RouterOutputs } from '@/lib/trpc';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, TextInput } from '@/components/ui/field';
import { ClubAttendancePanel } from './club-attendance-panel';
import { ClubRotaPanel } from './club-rota-panel';
import { fromTimeValue, todayKey, toTimeValue, type ManagedClub } from './club-schedule-utils';

type Club = ManagedClub;
type ClubNotification = RouterOutputs['club']['notifications'][number];
type RosterSignup = RouterOutputs['club']['roster']['signups'][number];

interface ClubFormState {
  name: string;
  description: string;
  scheduleDate: string;
  scheduleStartTime: string;
  scheduleEndTime: string;
  capacity: string;
}

interface ClubFormPayload {
  name: string;
  description: string | null;
  schedule: {
    startDate: Date;
    startMinute: number;
    endMinute: number;
    frequency: 'Weekly';
  };
  capacity: number | null;
}

interface NotificationFormState {
  title: string;
  body: string;
}

const emptyClubForm = (): ClubFormState => ({
  name: '',
  description: '',
  scheduleDate: todayKey(),
  scheduleStartTime: '15:30',
  scheduleEndTime: '16:30',
  capacity: '',
});

const emptyNotificationForm = (): NotificationFormState => ({
  title: '',
  body: '',
});

function formatDateTime(value: Date | string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function capacityLabel(club: Club): string {
  if (club.capacity === null) return `${String(club.activeSignupCount)} signed up`;
  return `${String(club.activeSignupCount)}/${String(club.capacity)} places`;
}

function normaliseOptionalText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function buildClubPayload(form: ClubFormState): ClubFormPayload | string {
  const name = form.name.trim();
  if (!name) return 'Club name is required.';

  const trimmedCapacity = form.capacity.trim();
  const capacity = trimmedCapacity ? Number(trimmedCapacity) : null;
  if (
    capacity !== null &&
    (!Number.isInteger(capacity) || capacity <= 0 || !Number.isSafeInteger(capacity))
  ) {
    return 'Capacity must be a positive whole number.';
  }
  if (!form.scheduleDate) return 'Schedule date is required.';
  const startMinute = fromTimeValue(form.scheduleStartTime);
  const endMinute = fromTimeValue(form.scheduleEndTime);
  if (startMinute >= endMinute) return 'Schedule start time must be before end time.';

  return {
    name,
    description: normaliseOptionalText(form.description),
    schedule: {
      startDate: new Date(`${form.scheduleDate}T00:00:00.000Z`),
      startMinute,
      endMinute,
      frequency: 'Weekly',
    },
    capacity,
  };
}

function buildNotificationPayload(
  club: Club | null,
  form: NotificationFormState,
): { body: string; clubId: string; title: string } | string {
  if (!club) return 'Select a club before sending a notification.';
  if (!club.active) return 'Reactivate this club before sending notifications.';

  const title = form.title.trim();
  if (!title) return 'Notification title is required.';

  const body = form.body.trim();
  if (!body) return 'Notification message is required.';

  return { clubId: club.id, title, body };
}

function notificationStatusText({
  failedCount,
  recipientCount,
  sentCount,
}: {
  failedCount: number;
  recipientCount: number;
  sentCount: number;
}): string {
  if (recipientCount === 0) return 'Notification saved. No active signup guardians were found.';
  if (failedCount > 0) {
    return `Notification saved. ${String(sentCount)} sent, ${String(failedCount)} failed.`;
  }
  return `Notification sent to ${String(sentCount)} guardian${sentCount === 1 ? '' : 's'}.`;
}

function ClubCard({
  club,
  onEdit,
  onSelect,
  onToggleActive,
  pendingToggle,
  selected,
}: {
  club: Club;
  onEdit: (club: Club) => void;
  onSelect: (club: Club) => void;
  onToggleActive: (club: Club) => void;
  pendingToggle: boolean;
  selected: boolean;
}) {
  return (
    <article className={selected ? 'club-card is-selected' : 'club-card'}>
      <button
        aria-pressed={selected}
        className="club-card__main"
        onClick={() => {
          onSelect(club);
        }}
        type="button"
      >
        <span className="badge-list">
          <Badge tone={club.active ? 'green' : 'grey'}>{club.active ? 'Active' : 'Inactive'}</Badge>
          <Badge tone="blue">{capacityLabel(club)}</Badge>
        </span>
        <strong>{club.name}</strong>
        <span>{club.scheduleLabel ?? 'No schedule set'}</span>
        {club.description ? <p>{club.description}</p> : null}
      </button>
      <div className="club-card__actions">
        <Button
          aria-label={`Edit ${club.name}`}
          onClick={() => {
            onEdit(club);
          }}
          size="sm"
          type="button"
          variant="secondary"
        >
          <Pencil aria-hidden="true" size={15} />
          Edit
        </Button>
        <Button
          aria-label={`${club.active ? 'Deactivate' : 'Activate'} ${club.name}`}
          onClick={() => {
            onToggleActive(club);
          }}
          pending={pendingToggle}
          size="sm"
          type="button"
          variant={club.active ? 'danger' : 'secondary'}
        >
          {club.active ? (
            <PowerOff aria-hidden="true" size={15} />
          ) : (
            <Power aria-hidden="true" size={15} />
          )}
          {club.active ? 'Deactivate' : 'Activate'}
        </Button>
      </div>
    </article>
  );
}

function RosterTable({ signups }: { signups: readonly RosterSignup[] }) {
  if (signups.length === 0) {
    return <div className="empty-state">No active signups for this club.</div>;
  }

  return (
    <div className="panel--scroll">
      <table className="table club-roster-table">
        <thead>
          <tr>
            <th>Student</th>
            <th>Year group</th>
            <th>Signed up</th>
          </tr>
        </thead>
        <tbody>
          {signups.map((signup) => (
            <tr key={signup.id}>
              <td>{signup.studentName}</td>
              <td>{displaySchoolYearLabel(signup.yearGroup)}</td>
              <td>{formatDateTime(signup.signedUpAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NotificationHistory({
  error,
  loading,
  notifications,
}: {
  error: string | null;
  loading: boolean;
  notifications: readonly ClubNotification[];
}) {
  if (loading) return <div className="empty-state">Loading notification history...</div>;
  if (error) return <p className="status--error">{error}</p>;
  if (notifications.length === 0) {
    return <div className="empty-state">No notifications have been sent for this club.</div>;
  }

  return (
    <div className="club-notification-history" aria-label="Club notification history">
      {notifications.map((notification) => (
        <article className="club-notification-history__item" key={notification.id}>
          <span>
            <strong>{notification.title}</strong>
            <small>
              {formatDateTime(notification.sentAt)} by {notification.sentByName}
            </small>
          </span>
        </article>
      ))}
    </div>
  );
}

type ClubModalTab = 'roster' | 'attendance' | 'rota' | 'notifications';

function ClubDetailsModal({
  activeTab,
  canSubmitNotification,
  club,
  notificationError,
  notificationForm,
  notificationHistoryError,
  notificationHistoryLoading,
  notificationStatus,
  notifications,
  onClose,
  onNotificationFormChange,
  onSubmitNotification,
  onTabChange,
  rosterError,
  rosterLoading,
  rosterSignups,
  sendNotificationPending,
  sendNotificationError,
}: {
  activeTab: ClubModalTab;
  canSubmitNotification: boolean;
  club: Club;
  notificationError: string | null;
  notificationForm: NotificationFormState;
  notificationHistoryError: string | null;
  notificationHistoryLoading: boolean;
  notificationStatus: string | null;
  notifications: readonly ClubNotification[];
  onClose: () => void;
  onNotificationFormChange: (form: NotificationFormState) => void;
  onSubmitNotification: (event: FormEvent<HTMLFormElement>) => void;
  onTabChange: (tab: ClubModalTab) => void;
  rosterError: string | null;
  rosterLoading: boolean;
  rosterSignups: readonly RosterSignup[];
  sendNotificationPending: boolean;
  sendNotificationError: string | null;
}) {
  return (
    <div className="pace-modal-backdrop club-modal-backdrop">
      <section
        aria-labelledby="club-modal-title"
        aria-modal="true"
        className="pace-modal club-modal"
        role="dialog"
      >
        <header className="pace-modal__header">
          <div>
            <p>{club.scheduleLabel ?? 'No schedule set'}</p>
            <h2 id="club-modal-title">{club.name}</h2>
          </div>
          <Button
            aria-label="Close club details"
            onClick={onClose}
            size="sm"
            type="button"
            variant="ghost"
          >
            <X aria-hidden="true" size={16} />
          </Button>
        </header>
        <div className="pace-modal__body club-modal__body">
          <div className="club-modal-tabs" role="tablist" aria-label="Club details">
            {(
              [
                ['roster', 'Roster'],
                ['attendance', 'Attendance'],
                ['rota', 'Rota'],
                ['notifications', 'Notifications'],
              ] as const
            ).map(([tab, label]) => (
              <button
                aria-selected={activeTab === tab}
                className={activeTab === tab ? 'is-selected' : ''}
                key={tab}
                onClick={() => {
                  onTabChange(tab);
                }}
                role="tab"
                type="button"
              >
                {label}
              </button>
            ))}
          </div>

          {activeTab === 'roster' ? (
            <section className="club-modal-section" aria-labelledby="club-modal-roster-title">
              <div className="section-title">
                <div>
                  <p className="muted">Signed-up students</p>
                  <h3 id="club-modal-roster-title">Roster</h3>
                </div>
                <Badge tone="blue">{capacityLabel(club)}</Badge>
              </div>
              {rosterLoading ? <div className="empty-state">Loading roster...</div> : null}
              {rosterError ? <p className="status--error">{rosterError}</p> : null}
              {!rosterLoading && !rosterError ? <RosterTable signups={rosterSignups} /> : null}
            </section>
          ) : null}

          {activeTab === 'attendance' ? <ClubAttendancePanel club={club} /> : null}
          {activeTab === 'rota' ? <ClubRotaPanel club={club} /> : null}

          {activeTab === 'notifications' ? (
            <section className="club-modal-section" aria-labelledby="club-modal-notification-title">
              <div className="section-title">
                <div>
                  <p className="muted">Notifications</p>
                  <h3 id="club-modal-notification-title">Send Club Notification</h3>
                </div>
                <span className="badge badge--blue">
                  <Bell aria-hidden="true" size={14} />
                  {String(club.activeSignupCount)} estimated recipients
                </span>
              </div>
              {club.activeSignupCount === 0 ? (
                <div className="empty-state">
                  No active signups yet. The notification will be saved without email recipients.
                </div>
              ) : null}
              <form
                className="clubs-form"
                onSubmit={(event) => {
                  onSubmitNotification(event);
                }}
              >
                <Field label="Notification title" required>
                  <TextInput
                    disabled={sendNotificationPending}
                    maxLength={160}
                    onChange={(event) => {
                      onNotificationFormChange({ ...notificationForm, title: event.target.value });
                    }}
                    placeholder="Practice update"
                    required
                    value={notificationForm.title}
                  />
                </Field>
                <Field label="Message" required>
                  <textarea
                    className="input textarea"
                    disabled={sendNotificationPending}
                    maxLength={2000}
                    onChange={(event) => {
                      onNotificationFormChange({ ...notificationForm, body: event.target.value });
                    }}
                    placeholder="Write the club update for guardians."
                    required
                    rows={4}
                    value={notificationForm.body}
                  />
                </Field>
                <div className="clubs-form__actions">
                  <Button
                    disabled={!canSubmitNotification}
                    pending={sendNotificationPending}
                    type="submit"
                  >
                    <Send aria-hidden="true" size={16} />
                    Send Notification
                  </Button>
                </div>
                {notificationStatus ? (
                  <p className="status--success">{notificationStatus}</p>
                ) : null}
                {notificationError ? <p className="status--error">{notificationError}</p> : null}
                {sendNotificationError ? (
                  <p className="status--error">{sendNotificationError}</p>
                ) : null}
              </form>
              <div className="club-notification-history-panel">
                <div className="section-title">
                  <h3>Notification History</h3>
                </div>
                <NotificationHistory
                  error={notificationHistoryError}
                  loading={notificationHistoryLoading}
                  notifications={notifications}
                />
              </div>
            </section>
          ) : null}
        </div>
      </section>
    </div>
  );
}

export function ClubsManagementClient() {
  const utils = api.useUtils();
  const [form, setForm] = useState<ClubFormState>(emptyClubForm);
  const [notificationForm, setNotificationForm] =
    useState<NotificationFormState>(emptyNotificationForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);
  const [modalClubId, setModalClubId] = useState<string | null>(null);
  const [modalTab, setModalTab] = useState<ClubModalTab>('roster');
  const [pendingActiveId, setPendingActiveId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formStatus, setFormStatus] = useState<string | null>(null);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const [notificationStatus, setNotificationStatus] = useState<string | null>(null);

  const clubsQuery = api.club.list.useQuery(undefined, { retry: false });
  const clubs = useMemo(() => clubsQuery.data ?? [], [clubsQuery.data]);
  const selectedClub = clubs.find((club) => club.id === selectedClubId) ?? null;
  const modalClub = clubs.find((club) => club.id === modalClubId) ?? null;
  const rosterQuery = api.club.roster.useQuery(
    { clubId: selectedClubId ?? '' },
    { enabled: selectedClubId !== null, retry: false },
  );
  const modalRosterQuery = api.club.roster.useQuery(
    { clubId: modalClubId ?? '' },
    { enabled: modalClubId !== null, retry: false },
  );
  const notificationHistoryQuery = api.club.notifications.useQuery(
    { clubId: selectedClubId ?? '' },
    { enabled: selectedClubId !== null, retry: false },
  );
  const modalNotificationHistoryQuery = api.club.notifications.useQuery(
    { clubId: modalClubId ?? '' },
    { enabled: modalClubId !== null, retry: false },
  );

  const createClub = api.club.create.useMutation({
    onSuccess: async (club) => {
      setForm(emptyClubForm());
      setEditingId(null);
      setSelectedClubId(club.id);
      setFormStatus('Club created.');
      await utils.club.list.invalidate();
    },
  });
  const updateClub = api.club.update.useMutation({
    onSettled: () => {
      setPendingActiveId(null);
    },
    onSuccess: async (club) => {
      setForm(emptyClubForm());
      setEditingId(null);
      setSelectedClubId(club.id);
      setFormStatus(club.active ? 'Club updated.' : 'Club deactivated.');
      await Promise.all([utils.club.list.invalidate(), utils.club.roster.invalidate()]);
    },
  });
  const sendNotification = api.club.notify.useMutation({
    onSuccess: async (result) => {
      setNotificationForm(emptyNotificationForm());
      setNotificationStatus(notificationStatusText(result));
      await utils.club.notifications.invalidate();
    },
  });

  useEffect(() => {
    if (clubs.length === 0) {
      setSelectedClubId(null);
      setModalClubId(null);
      return;
    }
    if (!selectedClubId || !clubs.some((club) => club.id === selectedClubId)) {
      setSelectedClubId(clubs[0]?.id ?? null);
    }
    if (modalClubId && !clubs.some((club) => club.id === modalClubId && club.active)) {
      setModalClubId(null);
    }
  }, [clubs, modalClubId, selectedClubId]);

  const activeClubCount = clubs.filter((club) => club.active).length;
  const formMutationPending =
    createClub.isPending || (updateClub.isPending && pendingActiveId === null);
  const mutationError = createClub.error ?? updateClub.error;
  const notificationClub = modalClub ?? selectedClub;
  const notificationFieldsFilled =
    notificationForm.title.trim().length > 0 && notificationForm.body.trim().length > 0;
  const canSubmitNotification =
    notificationClub !== null &&
    notificationClub.active &&
    notificationFieldsFilled &&
    !sendNotification.isPending;

  function editClub(club: Club): void {
    const schedule = club.schedule;
    setForm({
      name: club.name,
      description: club.description ?? '',
      scheduleDate: schedule?.startDate ?? todayKey(),
      scheduleStartTime: schedule ? toTimeValue(schedule.startMinute) : '15:30',
      scheduleEndTime: schedule ? toTimeValue(schedule.endMinute) : '16:30',
      capacity: club.capacity === null ? '' : String(club.capacity),
    });
    setEditingId(club.id);
    setSelectedClubId(club.id);
    setFormError(null);
    setFormStatus(null);
  }

  function cancelEdit(): void {
    setForm(emptyClubForm());
    setEditingId(null);
    setFormError(null);
  }

  async function submitClub(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormStatus(null);
    setPendingActiveId(null);

    const payload = buildClubPayload(form);
    if (typeof payload === 'string') {
      setFormError(payload);
      return;
    }

    setFormError(null);
    try {
      if (editingId) {
        await updateClub.mutateAsync({ id: editingId, ...payload });
        return;
      }

      await createClub.mutateAsync(payload);
    } catch {
      // React Query exposes the mutation error below the form.
    }
  }

  function toggleClubActive(club: Club): void {
    setFormStatus(null);
    setFormError(null);
    setPendingActiveId(club.id);
    updateClub.mutate({ id: club.id, active: !club.active });
  }

  function selectClub(club: Club): void {
    setSelectedClubId(club.id);
    if (!club.active) return;
    setModalClubId(club.id);
    setModalTab('roster');
  }

  async function submitNotification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotificationStatus(null);

    const payload = buildNotificationPayload(notificationClub, notificationForm);
    if (typeof payload === 'string') {
      setNotificationError(payload);
      return;
    }

    setNotificationError(null);
    try {
      await sendNotification.mutateAsync(payload);
    } catch {
      // React Query exposes the mutation error below the notification form.
    }
  }

  return (
    <div className="clubs-page">
      <div className="dashboard-hero">
        <p>Clubs module</p>
        <h1>Clubs</h1>
        <span>
          {activeClubCount === 1 ? '1 active club' : `${String(activeClubCount)} active clubs`}
        </span>
      </div>

      <div className="clubs-layout">
        <section className="panel panel__body clubs-composer" aria-labelledby="club-form-title">
          <div className="section-title">
            <div>
              <h2 id="club-form-title">{editingId ? 'Edit Club' : 'Add Club'}</h2>
              <p className="muted">Track club details and available places.</p>
            </div>
          </div>
          <form
            className="clubs-form"
            onSubmit={(event) => {
              void submitClub(event);
            }}
          >
            <Field label="Club name" required>
              <TextInput
                maxLength={160}
                onChange={(event) => {
                  setForm((current) => ({ ...current, name: event.target.value }));
                }}
                placeholder="Choir"
                required
                value={form.name}
              />
            </Field>
            <Field label="Description" hint="Optional">
              <textarea
                className="input textarea"
                maxLength={1000}
                onChange={(event) => {
                  setForm((current) => ({ ...current, description: event.target.value }));
                }}
                placeholder="Short club description"
                rows={4}
                value={form.description}
              />
            </Field>
            <div className="form-grid form-grid--two">
              <Field label="First club date" required>
                <TextInput
                  onChange={(event) => {
                    setForm((current) => ({ ...current, scheduleDate: event.target.value }));
                  }}
                  required
                  type="date"
                  value={form.scheduleDate}
                />
              </Field>
              <Field label="Recurrence">
                <TextInput readOnly value="Weekly" />
              </Field>
            </div>
            <div className="form-grid form-grid--two">
              <Field label="Start time" required>
                <TextInput
                  onChange={(event) => {
                    setForm((current) => ({ ...current, scheduleStartTime: event.target.value }));
                  }}
                  required
                  type="time"
                  value={form.scheduleStartTime}
                />
              </Field>
              <Field label="End time" required>
                <TextInput
                  onChange={(event) => {
                    setForm((current) => ({ ...current, scheduleEndTime: event.target.value }));
                  }}
                  required
                  type="time"
                  value={form.scheduleEndTime}
                />
              </Field>
            </div>
            <Field label="Capacity" hint="Leave blank for no cap">
              <TextInput
                inputMode="numeric"
                min={1}
                onChange={(event) => {
                  setForm((current) => ({ ...current, capacity: event.target.value }));
                }}
                placeholder="20"
                type="number"
                value={form.capacity}
              />
            </Field>
            <div className="clubs-form__actions">
              <Button pending={formMutationPending} type="submit">
                {editingId ? (
                  <Save aria-hidden="true" size={16} />
                ) : (
                  <Plus aria-hidden="true" size={16} />
                )}
                {editingId ? 'Save Club' : 'Add Club'}
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

        <div className="clubs-view-stack">
          <section className="panel panel__body clubs-list-panel" aria-labelledby="club-list-title">
            <div className="section-title">
              <div>
                <h2 id="club-list-title">Club List</h2>
                <p className="muted">Active and inactive clubs, newest changes first.</p>
              </div>
              <span className="badge badge--blue">{String(clubs.length)} total</span>
            </div>

            {clubsQuery.isLoading ? <div className="empty-state">Loading clubs...</div> : null}
            {clubsQuery.error ? <p className="status--error">{clubsQuery.error.message}</p> : null}
            {!clubsQuery.isLoading && clubs.length === 0 ? (
              <div className="empty-state">No clubs have been created yet.</div>
            ) : null}
            <div className="clubs-list" aria-label="Club list">
              {clubs.map((club) => (
                <ClubCard
                  club={club}
                  key={club.id}
                  onEdit={editClub}
                  onSelect={selectClub}
                  onToggleActive={toggleClubActive}
                  pendingToggle={pendingActiveId === club.id && updateClub.isPending}
                  selected={club.id === selectedClubId}
                />
              ))}
            </div>
          </section>

          <section
            className="panel panel__body club-roster-panel"
            aria-labelledby="club-roster-title"
          >
            <div className="section-title">
              <div>
                <p className="muted">Roster</p>
                <h2 id="club-roster-title">{selectedClub?.name ?? 'Select a club'}</h2>
              </div>
              <span className="badge badge--blue">
                <UsersRound aria-hidden="true" size={14} />
                {String(selectedClub?.activeSignupCount ?? 0)} signed up
              </span>
            </div>

            {!selectedClub ? (
              <div className="empty-state">Select a club to view its roster.</div>
            ) : null}
            {selectedClub && rosterQuery.isLoading ? (
              <div className="empty-state">Loading roster...</div>
            ) : null}
            {selectedClub && rosterQuery.error ? (
              <p className="status--error">{rosterQuery.error.message}</p>
            ) : null}
            {selectedClub && rosterQuery.data ? (
              <>
                <div className="club-roster-summary">
                  <ClipboardList aria-hidden="true" size={18} />
                  <span>
                    <strong>{capacityLabel(selectedClub)}</strong>
                    <small>{selectedClub.scheduleLabel ?? 'No schedule set'}</small>
                  </span>
                </div>
                <RosterTable signups={rosterQuery.data.signups} />
                <div className="club-notification-panel" aria-labelledby="club-notification-title">
                  <div className="section-title">
                    <div>
                      <p className="muted">Notifications</p>
                      <h3 id="club-notification-title">Send Club Notification</h3>
                    </div>
                    <span className="badge badge--blue">
                      <Bell aria-hidden="true" size={14} />
                      {String(selectedClub.activeSignupCount)} estimated recipients
                    </span>
                  </div>
                  {selectedClub.activeSignupCount === 0 ? (
                    <div className="empty-state">
                      No active signups yet. The notification will be saved without email
                      recipients.
                    </div>
                  ) : null}
                  {!selectedClub.active ? (
                    <p className="status--error">
                      Reactivate this club before sending notifications.
                    </p>
                  ) : null}
                  <form
                    className="clubs-form"
                    onSubmit={(event) => {
                      void submitNotification(event);
                    }}
                  >
                    <Field label="Notification title" required>
                      <TextInput
                        disabled={!selectedClub.active || sendNotification.isPending}
                        maxLength={160}
                        onChange={(event) => {
                          setNotificationForm((current) => ({
                            ...current,
                            title: event.target.value,
                          }));
                        }}
                        placeholder="Practice update"
                        required
                        value={notificationForm.title}
                      />
                    </Field>
                    <Field label="Message" required>
                      <textarea
                        className="input textarea"
                        disabled={!selectedClub.active || sendNotification.isPending}
                        maxLength={2000}
                        onChange={(event) => {
                          setNotificationForm((current) => ({
                            ...current,
                            body: event.target.value,
                          }));
                        }}
                        placeholder="Write the club update for guardians."
                        required
                        rows={4}
                        value={notificationForm.body}
                      />
                    </Field>
                    <div className="clubs-form__actions">
                      <Button
                        disabled={!canSubmitNotification}
                        pending={sendNotification.isPending}
                        type="submit"
                      >
                        <Send aria-hidden="true" size={16} />
                        Send Notification
                      </Button>
                    </div>
                    {notificationStatus ? (
                      <p className="status--success">{notificationStatus}</p>
                    ) : null}
                    {notificationError ? (
                      <p className="status--error">{notificationError}</p>
                    ) : null}
                    {sendNotification.error ? (
                      <p className="status--error">{sendNotification.error.message}</p>
                    ) : null}
                  </form>

                  <div className="club-notification-history-panel">
                    <div className="section-title">
                      <div>
                        <h3>Notification History</h3>
                      </div>
                    </div>
                    <NotificationHistory
                      error={notificationHistoryQuery.error?.message ?? null}
                      loading={notificationHistoryQuery.isLoading}
                      notifications={notificationHistoryQuery.data ?? []}
                    />
                  </div>
                </div>
              </>
            ) : null}
          </section>
        </div>
      </div>
      {modalClub ? (
        <ClubDetailsModal
          activeTab={modalTab}
          canSubmitNotification={canSubmitNotification}
          club={modalClub}
          notificationError={notificationError}
          notificationForm={notificationForm}
          notificationHistoryError={modalNotificationHistoryQuery.error?.message ?? null}
          notificationHistoryLoading={modalNotificationHistoryQuery.isLoading}
          notificationStatus={notificationStatus}
          notifications={modalNotificationHistoryQuery.data ?? []}
          onClose={() => {
            setModalClubId(null);
          }}
          onNotificationFormChange={setNotificationForm}
          onSubmitNotification={(event) => {
            void submitNotification(event);
          }}
          onTabChange={setModalTab}
          rosterError={modalRosterQuery.error?.message ?? null}
          rosterLoading={modalRosterQuery.isLoading}
          rosterSignups={modalRosterQuery.data?.signups ?? []}
          sendNotificationError={sendNotification.error?.message ?? null}
          sendNotificationPending={sendNotification.isPending}
        />
      ) : null}
    </div>
  );
}

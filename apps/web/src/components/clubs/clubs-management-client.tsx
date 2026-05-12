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

type Club = RouterOutputs['club']['list'][number];
type ClubNotification = RouterOutputs['club']['notifications'][number];
type RosterSignup = RouterOutputs['club']['roster']['signups'][number];

interface ClubFormState {
  name: string;
  description: string;
  schedule: string;
  capacity: string;
}

interface ClubFormPayload {
  name: string;
  description: string | null;
  schedule: string | null;
  capacity: number | null;
}

interface NotificationFormState {
  title: string;
  body: string;
}

const emptyClubForm = (): ClubFormState => ({
  name: '',
  description: '',
  schedule: '',
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

  return {
    name,
    description: normaliseOptionalText(form.description),
    schedule: normaliseOptionalText(form.schedule),
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
  onSelect: (clubId: string) => void;
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
          onSelect(club.id);
        }}
        type="button"
      >
        <span className="badge-list">
          <Badge tone={club.active ? 'green' : 'grey'}>{club.active ? 'Active' : 'Inactive'}</Badge>
          <Badge tone="blue">{capacityLabel(club)}</Badge>
        </span>
        <strong>{club.name}</strong>
        <span>{club.schedule ?? 'No schedule set'}</span>
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

export function ClubsManagementClient() {
  const utils = api.useUtils();
  const [form, setForm] = useState<ClubFormState>(emptyClubForm);
  const [notificationForm, setNotificationForm] =
    useState<NotificationFormState>(emptyNotificationForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);
  const [pendingActiveId, setPendingActiveId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formStatus, setFormStatus] = useState<string | null>(null);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const [notificationStatus, setNotificationStatus] = useState<string | null>(null);

  const clubsQuery = api.club.list.useQuery(undefined, { retry: false });
  const clubs = useMemo(() => clubsQuery.data ?? [], [clubsQuery.data]);
  const selectedClub = clubs.find((club) => club.id === selectedClubId) ?? null;
  const rosterQuery = api.club.roster.useQuery(
    { clubId: selectedClubId ?? '' },
    { enabled: selectedClubId !== null, retry: false },
  );
  const notificationHistoryQuery = api.club.notifications.useQuery(
    { clubId: selectedClubId ?? '' },
    { enabled: selectedClubId !== null, retry: false },
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
      return;
    }
    if (!selectedClubId || !clubs.some((club) => club.id === selectedClubId)) {
      setSelectedClubId(clubs[0]?.id ?? null);
    }
  }, [clubs, selectedClubId]);

  const activeClubCount = clubs.filter((club) => club.active).length;
  const formMutationPending =
    createClub.isPending || (updateClub.isPending && pendingActiveId === null);
  const mutationError = createClub.error ?? updateClub.error;
  const notificationFieldsFilled =
    notificationForm.title.trim().length > 0 && notificationForm.body.trim().length > 0;
  const canSubmitNotification =
    selectedClub !== null &&
    selectedClub.active &&
    notificationFieldsFilled &&
    !sendNotification.isPending;

  function editClub(club: Club): void {
    setForm({
      name: club.name,
      description: club.description ?? '',
      schedule: club.schedule ?? '',
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

  async function submitNotification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotificationStatus(null);

    const payload = buildNotificationPayload(selectedClub, notificationForm);
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
            <Field label="Schedule" hint="Optional">
              <TextInput
                maxLength={180}
                onChange={(event) => {
                  setForm((current) => ({ ...current, schedule: event.target.value }));
                }}
                placeholder="Fridays, 15:30"
                value={form.schedule}
              />
            </Field>
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
                  onSelect={setSelectedClubId}
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
                    <small>{selectedClub.schedule ?? 'No schedule set'}</small>
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
    </div>
  );
}

'use client';

import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { friendlyErrorMessage, showErrorToast, showSuccessToast } from '@/lib/notifications';
import { api } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ClubCard, ClubStats, CreateClubTile } from './club-management-cards';
import { ClubDetail } from './club-management-detail';
import { ClubFormModal } from './club-management-form-modal';
import {
  buildClubPayload,
  buildNotificationPayload,
  emptyClubForm,
  emptyNotificationForm,
  formFromClub,
  notificationStatusText,
  type Club,
  type ClubFormState,
  type ClubTab,
  type NotificationFormState,
} from './club-management-model';

export function ClubsManagementClient() {
  const utils = api.useUtils();
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ClubTab>('attendance');
  const [formOpen, setFormOpen] = useState(false);
  const [formClub, setFormClub] = useState<Club | null>(null);
  const [form, setForm] = useState<ClubFormState>(emptyClubForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingActiveId, setPendingActiveId] = useState<string | null>(null);
  const [notificationForm, setNotificationForm] =
    useState<NotificationFormState>(emptyNotificationForm);
  const [notificationError, setNotificationError] = useState<string | null>(null);

  const clubsQuery = api.club.managementList.useQuery(undefined, { retry: false });
  const clubs = useMemo(() => clubsQuery.data ?? [], [clubsQuery.data]);
  const selectedClub = clubs.find((club) => club.id === selectedClubId) ?? null;
  const rosterQuery = api.club.roster.useQuery(
    { clubId: selectedClub?.id ?? '' },
    { enabled: selectedClub !== null, retry: false },
  );
  const notificationsQuery = api.club.notifications.useQuery(
    { clubId: selectedClub?.id ?? '' },
    { enabled: selectedClub !== null, retry: false },
  );
  const createClub = api.club.create.useMutation();
  const updateClub = api.club.update.useMutation({
    onSettled: () => {
      setPendingActiveId(null);
    },
  });
  const sendNotification = api.club.notify.useMutation();
  const formPending = createClub.isPending || updateClub.isPending;

  useEffect(() => {
    if (selectedClubId && clubs.some((club) => club.id === selectedClubId)) return;
    setSelectedClubId(null);
  }, [clubs, selectedClubId]);

  async function refreshClubs() {
    await Promise.all([
      utils.club.managementList.invalidate(),
      utils.club.list.invalidate(),
      utils.club.roster.invalidate(),
      utils.club.notifications.invalidate(),
    ]);
  }

  function beginCreate(): void {
    setFormOpen(true);
    setFormClub(null);
    setForm(emptyClubForm());
    setFormError(null);
  }

  function beginEdit(club: Club): void {
    setFormOpen(true);
    setFormClub(club);
    setForm(formFromClub(club));
    setFormError(null);
  }

  function closeForm(): void {
    setFormOpen(false);
    setFormClub(null);
    setForm(emptyClubForm());
    setFormError(null);
  }

  async function submitClub(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload = buildClubPayload(form);
    if (typeof payload === 'string') {
      setFormError(payload);
      return;
    }

    setFormError(null);
    try {
      const club = formClub
        ? await updateClub.mutateAsync({ id: formClub.id, ...payload })
        : await createClub.mutateAsync(payload);
      setSelectedClubId(club.id);
      showSuccessToast(formClub ? 'Club updated.' : 'Club created.');
      await refreshClubs();
      closeForm();
    } catch (error) {
      setFormError(friendlyErrorMessage(error, 'Club could not be saved.'));
      showErrorToast(error, 'Club could not be saved.');
    }
  }

  async function toggleClubActive(club: Club) {
    setPendingActiveId(club.id);
    try {
      await updateClub.mutateAsync({ id: club.id, active: !club.active });
      showSuccessToast(club.active ? 'Club deactivated.' : 'Club reactivated.');
      await refreshClubs();
    } catch (error) {
      showErrorToast(error, 'Club status could not be changed.');
    }
  }

  function openClub(club: Club): void {
    setSelectedClubId(club.id);
    setActiveTab('attendance');
    setNotificationForm(emptyNotificationForm());
    setNotificationError(null);
  }

  async function submitNotification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedClub) return;

    const payload = buildNotificationPayload(selectedClub, notificationForm);
    if (typeof payload === 'string') {
      setNotificationError(payload);
      return;
    }

    setNotificationError(null);
    try {
      const result = await sendNotification.mutateAsync(payload);
      setNotificationForm(emptyNotificationForm());
      showSuccessToast(notificationStatusText(result));
      await utils.club.notifications.invalidate({ clubId: selectedClub.id });
    } catch (error) {
      showErrorToast(error, 'Club notice could not be posted.');
    }
  }

  const formModal = formOpen ? (
    <ClubFormModal
      club={formClub}
      error={
        formError ??
        (createClub.error
          ? friendlyErrorMessage(createClub.error)
          : updateClub.error
            ? friendlyErrorMessage(updateClub.error)
            : null)
      }
      form={form}
      onClose={closeForm}
      onFormChange={setForm}
      onSubmit={(event) => {
        void submitClub(event);
      }}
      pending={formPending}
    />
  ) : null;

  if (selectedClub) {
    return (
      <>
        <ClubDetail
          activeTab={activeTab}
          club={selectedClub}
          notificationError={notificationError}
          notificationForm={notificationForm}
          notificationHistoryError={
            notificationsQuery.error ? friendlyErrorMessage(notificationsQuery.error) : null
          }
          notificationHistoryLoading={notificationsQuery.isLoading}
          notifications={notificationsQuery.data ?? []}
          onBack={() => {
            setSelectedClubId(null);
          }}
          onEdit={beginEdit}
          onNotificationFormChange={setNotificationForm}
          onSubmitNotification={(event) => {
            void submitNotification(event);
          }}
          onTabChange={setActiveTab}
          onToggleActive={(club) => {
            void toggleClubActive(club);
          }}
          pendingToggle={pendingActiveId === selectedClub.id && updateClub.isPending}
          rosterError={rosterQuery.error ? friendlyErrorMessage(rosterQuery.error) : null}
          rosterLoading={rosterQuery.isLoading}
          rosterSignups={rosterQuery.data?.signups ?? []}
          sendNotificationError={
            sendNotification.error ? friendlyErrorMessage(sendNotification.error) : null
          }
          sendNotificationPending={sendNotification.isPending}
        />
        {formModal}
      </>
    );
  }

  return (
    <div className="admin-clubs-page">
      <div className="page-header">
        <div>
          <p>Clubs module</p>
          <h1>Clubs</h1>
          <p>Create clubs, assign leads, manage students, mark attendance, and post notices.</p>
        </div>
        <div className="page-header__actions">
          <Button onClick={beginCreate} type="button">
            <Plus aria-hidden="true" size={16} />
            Create club
          </Button>
        </div>
      </div>

      <ClubStats clubs={clubs} />

      {clubsQuery.isLoading ? <div className="empty-state">Loading clubs...</div> : null}
      {clubsQuery.error ? (
        <p className="status--error">{friendlyErrorMessage(clubsQuery.error)}</p>
      ) : null}
      {!clubsQuery.isLoading && clubs.length === 0 ? (
        <EmptyState
          detail="Create the first club to start assigning students and leads."
          title="No clubs yet"
        />
      ) : null}

      <section className="admin-clubs-grid" aria-label="Club list">
        {clubs.map((club) => (
          <ClubCard club={club} key={club.id} onOpen={openClub} />
        ))}
        <CreateClubTile onCreate={beginCreate} />
      </section>

      {formModal}
      {updateClub.error ? (
        <p className="status--error">{friendlyErrorMessage(updateClub.error)}</p>
      ) : null}
    </div>
  );
}

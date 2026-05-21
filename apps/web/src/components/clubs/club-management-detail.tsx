'use client';

import { type FormEvent } from 'react';
import { displaySchoolYearLabel } from '@oasis/domain';
import { Bell, Pencil, Power, PowerOff, Send, UsersRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Field, TextInput } from '@/components/ui/field';
import { LeadAssignmentPanel, StudentAssignmentPanel } from './club-assignment-panels';
import { ClubAttendancePanel } from './club-attendance-panel';
import {
  capacityText,
  clubTabs,
  formatDateTime,
  type Club,
  type ClubNotification,
  type ClubTab,
  type NotificationFormState,
  type RosterSignup,
} from './club-management-model';
import { ClubRotaPanel } from './club-rota-panel';
import { clubAccentStyle, clubVisual } from './club-visuals';

function RosterTable({ signups }: { signups: readonly RosterSignup[] }) {
  if (signups.length === 0) {
    return (
      <EmptyState
        detail="Students assigned to this club will appear here."
        title="No students assigned"
      />
    );
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
  if (loading) return <div className="empty-state">Loading notices...</div>;
  if (error) return <p className="status--error">{error}</p>;
  if (notifications.length === 0) {
    return (
      <EmptyState detail="Notices posted for this club will appear here." title="No notices" />
    );
  }

  return (
    <div className="club-notification-history" aria-label="Club notice history">
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

function NoticesTab({
  club,
  error,
  form,
  historyError,
  historyLoading,
  notifications,
  onFormChange,
  onSubmit,
  pending,
  sendError,
}: {
  club: Club;
  error: string | null;
  form: NotificationFormState;
  historyError: string | null;
  historyLoading: boolean;
  notifications: readonly ClubNotification[];
  onFormChange: (form: NotificationFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  pending: boolean;
  sendError: string | null;
}) {
  return (
    <div className="clubs-lead-work-grid">
      <section className="panel panel__body">
        <div className="section-title">
          <div>
            <p className="muted">{club.name}</p>
            <h2>Post a Notice</h2>
          </div>
          <Badge tone="blue">
            <Bell aria-hidden="true" size={14} />
            {String(club.activeSignupCount)} recipients
          </Badge>
        </div>
        {club.activeSignupCount === 0 ? (
          <div className="empty-state">
            No active signups yet. The notice will be saved without email recipients.
          </div>
        ) : null}
        {!club.active ? (
          <p className="status--error">Reactivate this club before posting notices.</p>
        ) : null}
        <form
          className="clubs-form"
          onSubmit={(event) => {
            onSubmit(event);
          }}
        >
          <Field label="Notice title" required>
            <TextInput
              disabled={!club.active || pending}
              maxLength={160}
              onChange={(event) => {
                onFormChange({ ...form, title: event.target.value });
              }}
              placeholder="Practice update"
              required
              value={form.title}
            />
          </Field>
          <Field label="Message" required>
            <textarea
              className="input textarea"
              disabled={!club.active || pending}
              maxLength={2000}
              onChange={(event) => {
                onFormChange({ ...form, body: event.target.value });
              }}
              placeholder="What do parents need to know?"
              required
              rows={5}
              value={form.body}
            />
          </Field>
          <Button
            disabled={!club.active || !form.title.trim() || !form.body.trim()}
            pending={pending}
            type="submit"
          >
            <Send aria-hidden="true" size={16} />
            Post notice
          </Button>
          {error ? <p className="status--error">{error}</p> : null}
          {sendError ? <p className="status--error">{sendError}</p> : null}
        </form>
      </section>

      <section className="panel panel__body">
        <div className="section-title">
          <div>
            <p className="muted">Posted notices</p>
            <h2>{club.name}</h2>
          </div>
          <Badge tone="blue">{String(notifications.length)}</Badge>
        </div>
        <NotificationHistory
          error={historyError}
          loading={historyLoading}
          notifications={notifications}
        />
      </section>
    </div>
  );
}

export function ClubDetail({
  activeTab,
  club,
  notificationError,
  notificationForm,
  notificationHistoryError,
  notificationHistoryLoading,
  notifications,
  onBack,
  onEdit,
  onNotificationFormChange,
  onSubmitNotification,
  onTabChange,
  onToggleActive,
  pendingToggle,
  rosterError,
  rosterLoading,
  rosterSignups,
  sendNotificationError,
  sendNotificationPending,
}: {
  activeTab: ClubTab;
  club: Club;
  notificationError: string | null;
  notificationForm: NotificationFormState;
  notificationHistoryError: string | null;
  notificationHistoryLoading: boolean;
  notifications: readonly ClubNotification[];
  onBack: () => void;
  onEdit: (club: Club) => void;
  onNotificationFormChange: (form: NotificationFormState) => void;
  onSubmitNotification: (event: FormEvent<HTMLFormElement>) => void;
  onTabChange: (tab: ClubTab) => void;
  onToggleActive: (club: Club) => void;
  pendingToggle: boolean;
  rosterError: string | null;
  rosterLoading: boolean;
  rosterSignups: readonly RosterSignup[];
  sendNotificationError: string | null;
  sendNotificationPending: boolean;
}) {
  const visual = clubVisual(club);
  const ClubIcon = visual.Icon;

  return (
    <div className="admin-club-detail">
      <Button onClick={onBack} type="button" variant="ghost">
        Back to clubs
      </Button>

      <section className="admin-club-detail-hero" style={clubAccentStyle(club)}>
        <span className="admin-club-detail-hero__icon">
          <ClubIcon aria-hidden="true" size={34} />
        </span>
        <div>
          <Badge tone={club.active ? 'green' : 'grey'}>{club.active ? 'Active' : 'Inactive'}</Badge>
          <h1>{club.name}</h1>
          <p>
            {club.scheduleLabel ?? 'No schedule set'} · {capacityText(club)}
          </p>
        </div>
        <div className="admin-club-detail-hero__actions">
          <Button
            onClick={() => {
              onEdit(club);
            }}
            type="button"
            variant="secondary"
          >
            <Pencil aria-hidden="true" size={16} />
            Edit club
          </Button>
          <Button
            onClick={() => {
              onToggleActive(club);
            }}
            pending={pendingToggle}
            type="button"
            variant={club.active ? 'danger' : 'secondary'}
          >
            {club.active ? (
              <PowerOff aria-hidden="true" size={16} />
            ) : (
              <Power aria-hidden="true" size={16} />
            )}
            {club.active ? 'Deactivate' : 'Reactivate'}
          </Button>
        </div>
      </section>

      <div className="admin-club-detail-tabs" role="tablist" aria-label="Club management sections">
        {clubTabs.map(([tab, label]) => (
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
            {tab === 'leads' && club.assignedLeads.length === 0 ? (
              <span aria-hidden="true" />
            ) : null}
          </button>
        ))}
      </div>

      {activeTab === 'attendance' ? <ClubAttendancePanel club={club} /> : null}
      {activeTab === 'students' ? (
        <div className="admin-club-detail-grid">
          <section className="panel panel__body">
            <div className="section-title">
              <div>
                <p className="muted">Roster</p>
                <h2>{club.name}</h2>
              </div>
              <Badge tone="blue">
                <UsersRound aria-hidden="true" size={14} />
                {String(club.activeSignupCount)}
              </Badge>
            </div>
            {rosterLoading ? <div className="empty-state">Loading roster...</div> : null}
            {rosterError ? <p className="status--error">{rosterError}</p> : null}
            {!rosterLoading && !rosterError ? <RosterTable signups={rosterSignups} /> : null}
          </section>
          <StudentAssignmentPanel club={club} />
        </div>
      ) : null}
      {activeTab === 'leads' ? <LeadAssignmentPanel club={club} /> : null}
      {activeTab === 'rota' ? <ClubRotaPanel club={club} /> : null}
      {activeTab === 'notices' ? (
        <NoticesTab
          club={club}
          error={notificationError}
          form={notificationForm}
          historyError={notificationHistoryError}
          historyLoading={notificationHistoryLoading}
          notifications={notifications}
          onFormChange={onNotificationFormChange}
          onSubmit={onSubmitNotification}
          pending={sendNotificationPending}
          sendError={sendNotificationError}
        />
      ) : null}
    </div>
  );
}

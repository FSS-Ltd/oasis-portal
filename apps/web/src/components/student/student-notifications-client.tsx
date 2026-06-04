'use client';

import { Bell, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import {
  friendlyErrorMessage,
  showErrorToast,
  showSuccessToast,
} from '@/lib/notifications';
import { api, type RouterOutputs } from '@/lib/trpc';

type StudentNotification = RouterOutputs['studentNotification']['list'][number];

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(value);
}

function kindLabel(kind: StudentNotification['kind']): string {
  if (kind === 'MeritAward') return 'Merits';
  if (kind === 'ShopPurchase') return 'Shop';
  if (kind === 'ClubNotice') return 'Club';
  return 'Announcement';
}

export function StudentNotificationsClient() {
  const utils = api.useUtils();
  const notifications = api.studentNotification.list.useQuery(undefined, { retry: false });
  const markRead = api.studentNotification.markRead.useMutation({
    async onSuccess() {
      showSuccessToast('Notification marked read.');
      await Promise.all([
        utils.studentNotification.list.invalidate(),
        utils.studentNotification.unreadCount.invalidate(),
        utils.student.dashboard.invalidate(),
      ]);
    },
    onError(error) {
      showErrorToast(error, 'Notification could not be marked read.');
    },
  });

  if (notifications.isLoading) {
    return <div className="student-inline-state">Loading notifications...</div>;
  }

  if (notifications.error) {
    return (
      <EmptyState
        detail={friendlyErrorMessage(notifications.error)}
        title="Notifications unavailable"
      />
    );
  }

  if (!notifications.data) {
    return <EmptyState detail="No notification data was returned." title="No notifications" />;
  }

  const unreadCount = notifications.data.filter((notification) => !notification.read).length;

  return (
    <div className="student-page student-notifications-page">
      <section className="student-wallet-hero student-notifications-hero">
        <div>
          <p>Notifications</p>
          <h1>Latest updates</h1>
          <span>Merits, shop confirmations, club notices, and Learning Centre announcements.</span>
        </div>
        <div className="student-notifications-hero__meta">
          <Bell aria-hidden="true" size={18} />
          <small>Unread</small>
          <strong>{String(unreadCount)}</strong>
        </div>
      </section>

      {notifications.data.length === 0 ? (
        <EmptyState detail="Updates will appear here when they are sent." title="No notifications yet" />
      ) : (
        <section className="student-dashboard-panel" aria-labelledby="student-notification-list-title">
          <div className="student-dashboard-panel__head">
            <div>
              <p>Inbox</p>
              <h2 id="student-notification-list-title">Notification centre</h2>
            </div>
            <CheckCheck aria-hidden="true" size={20} />
          </div>
          <div className="student-notifications-list">
            {notifications.data.map((notification) => (
              <article
                className={
                  notification.read
                    ? 'student-notifications-row'
                    : 'student-notifications-row is-unread'
                }
                key={notification.id}
              >
                <div>
                  <span>{kindLabel(notification.kind)}</span>
                  <h3>{notification.title}</h3>
                  <p>{notification.body}</p>
                  <time dateTime={notification.createdAt.toISOString()}>
                    {formatDate(notification.createdAt)}
                  </time>
                </div>
                {notification.read ? (
                  <small>Read</small>
                ) : (
                  <Button
                    onClick={() => {
                      markRead.mutate({ notificationId: notification.id });
                    }}
                    pending={markRead.isPending}
                    size="sm"
                    type="button"
                    variant="secondary"
                  >
                    Mark read
                  </Button>
                )}
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

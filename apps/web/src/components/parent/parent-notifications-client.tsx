'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BellRing, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { friendlyErrorMessage, showErrorToast, showSuccessToast } from '@/lib/notifications';
import { api, type RouterOutputs } from '@/lib/trpc';

type ParentNotification = RouterOutputs['parentNotification']['list'][number];

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(value);
}

function kindLabel(kind: ParentNotification['kind']): string {
  if (kind === 'InvoiceIssued') return 'Invoice';
  return 'Update';
}

export function ParentNotificationsClient() {
  const utils = api.useUtils();
  const [pendingNotificationId, setPendingNotificationId] = useState<string | null>(null);
  const notifications = api.parentNotification.list.useQuery(undefined, { retry: false });
  const markRead = api.parentNotification.markRead.useMutation({
    async onSuccess() {
      showSuccessToast('Notification marked read.');
      await Promise.all([
        utils.parentNotification.list.invalidate(),
        utils.parentNotification.unreadCount.invalidate(),
      ]);
    },
    onError(error) {
      showErrorToast(error, 'Notification could not be marked read.');
    },
    onSettled() {
      setPendingNotificationId(null);
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

  const rows = notifications.data ?? [];
  const unreadCount = rows.filter((notification) => !notification.read).length;

  return (
    <div className="student-page student-notifications-page">
      <section className="student-wallet-hero student-notifications-hero">
        <div>
          <p>Notifications</p>
          <h1>Latest updates</h1>
          <span>Invoices and parent portal updates.</span>
        </div>
        <div className="student-notifications-hero__meta">
          <BellRing aria-hidden="true" size={18} />
          <small>Unread</small>
          <strong>{String(unreadCount)}</strong>
        </div>
      </section>

      {rows.length === 0 ? (
        <EmptyState
          detail="Invoice updates will appear here when they are issued."
          title="No notifications yet"
        />
      ) : (
        <section
          className="student-dashboard-panel"
          aria-labelledby="parent-notification-list-title"
        >
          <div className="student-dashboard-panel__head">
            <div>
              <p>Inbox</p>
              <h2 id="parent-notification-list-title">Notification centre</h2>
            </div>
            <CheckCheck aria-hidden="true" size={20} />
          </div>
          <div className="student-notifications-list">
            {rows.map((notification) => (
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
                <div className="invoice-card__actions">
                  {notification.href ? (
                    <Link
                      className="button button--secondary button--sm"
                      href={notification.href}
                      onClick={() => {
                        if (!notification.read) {
                          setPendingNotificationId(notification.id);
                          markRead.mutate({ notificationId: notification.id });
                        }
                      }}
                    >
                      Open invoice
                    </Link>
                  ) : null}
                  {notification.read ? (
                    <small>Read</small>
                  ) : (
                    <Button
                      onClick={() => {
                        setPendingNotificationId(notification.id);
                        markRead.mutate({ notificationId: notification.id });
                      }}
                      pending={pendingNotificationId === notification.id}
                      size="sm"
                      type="button"
                      variant="secondary"
                    >
                      Mark read
                    </Button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

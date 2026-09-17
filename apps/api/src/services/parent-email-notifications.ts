import type { ParentEmailNotificationCategory } from '@oasis/domain';

export interface ParentEmailNotificationRecipient {
  parentEmailNotificationOptOuts?: readonly ParentEmailNotificationCategory[];
  parentEmailNotificationsEnabled?: boolean;
}

export function shouldSendParentEmailNotification(
  recipient: ParentEmailNotificationRecipient,
  category: ParentEmailNotificationCategory,
): boolean {
  return (
    recipient.parentEmailNotificationsEnabled !== false &&
    !recipient.parentEmailNotificationOptOuts?.includes(category)
  );
}

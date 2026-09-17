export const PARENT_EMAIL_NOTIFICATION_CATEGORIES = [
  'Message',
  'Behaviour',
  'Notice',
  'Club',
  'Report',
] as const;

export type ParentEmailNotificationCategory = (typeof PARENT_EMAIL_NOTIFICATION_CATEGORIES)[number];

export interface ParentEmailNotificationPreferences {
  enabled: boolean;
  optedOutCategories: ParentEmailNotificationCategory[];
}

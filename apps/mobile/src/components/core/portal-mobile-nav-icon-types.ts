export type PortalMobileNavIconName =
  | 'activity'
  | 'attendance'
  | 'behaviour'
  | 'calendar'
  | 'clubs'
  | 'community'
  | 'dashboard'
  | 'faith'
  | 'fees'
  | 'incidents'
  | 'leaderboard'
  | 'markets'
  | 'messages'
  | 'mobile'
  | 'more'
  | 'notices'
  | 'pace'
  | 'profile'
  | 'reports'
  | 'settings'
  | 'shop'
  | 'slips'
  | 'students'
  | 'wallet';

export interface PortalMobileNavIconProps {
  color: string;
  name: PortalMobileNavIconName;
}

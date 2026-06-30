/// <reference lib="dom" />

import { StyleSheet, View } from 'react-native';
import type { LucideIcon } from 'lucide-react';
import Award from 'lucide-react/dist/esm/icons/award.mjs';
import Bell from 'lucide-react/dist/esm/icons/bell.mjs';
import BookOpen from 'lucide-react/dist/esm/icons/book-open.mjs';
import Calendar from 'lucide-react/dist/esm/icons/calendar.mjs';
import CheckSquare from 'lucide-react/dist/esm/icons/check-square.mjs';
import ClipboardList from 'lucide-react/dist/esm/icons/clipboard-list.mjs';
import CreditCard from 'lucide-react/dist/esm/icons/credit-card.mjs';
import FileText from 'lucide-react/dist/esm/icons/file-text.mjs';
import Home from 'lucide-react/dist/esm/icons/home.mjs';
import MessageCircle from 'lucide-react/dist/esm/icons/message-circle.mjs';
import MessageSquare from 'lucide-react/dist/esm/icons/message-square.mjs';
import MoreHorizontal from 'lucide-react/dist/esm/icons/more-horizontal.mjs';
import Settings from 'lucide-react/dist/esm/icons/settings.mjs';
import Shield from 'lucide-react/dist/esm/icons/shield.mjs';
import ShoppingBag from 'lucide-react/dist/esm/icons/shopping-bag.mjs';
import Smartphone from 'lucide-react/dist/esm/icons/smartphone.mjs';
import Star from 'lucide-react/dist/esm/icons/star.mjs';
import TrendingUp from 'lucide-react/dist/esm/icons/trending-up.mjs';
import User from 'lucide-react/dist/esm/icons/user.mjs';
import UsersRound from 'lucide-react/dist/esm/icons/users-round.mjs';
import WalletCards from 'lucide-react/dist/esm/icons/wallet-cards.mjs';
import type {
  PortalMobileNavIconName,
  PortalMobileNavIconProps,
} from './portal-mobile-nav-icon-types';

const lucideIcons: Record<PortalMobileNavIconName, LucideIcon> = {
  activity: ClipboardList,
  attendance: CheckSquare,
  behaviour: Star,
  calendar: Calendar,
  clubs: UsersRound,
  community: MessageCircle,
  dashboard: Home,
  faith: BookOpen,
  fees: CreditCard,
  incidents: Shield,
  leaderboard: Award,
  markets: TrendingUp,
  messages: MessageSquare,
  mobile: Smartphone,
  more: MoreHorizontal,
  notices: Bell,
  pace: BookOpen,
  profile: User,
  reports: FileText,
  settings: Settings,
  shop: ShoppingBag,
  slips: FileText,
  students: UsersRound,
  wallet: WalletCards,
};

export function PortalMobileNavIcon({ color, name }: PortalMobileNavIconProps) {
  const Icon = lucideIcons[name];

  return (
    <View accessibilityElementsHidden importantForAccessibility="no" style={styles.webIconFrame}>
      <Icon aria-hidden color={color} focusable="false" size={24} strokeWidth={2.25} />
    </View>
  );
}

const styles = StyleSheet.create({
  webIconFrame: {
    alignItems: 'center',
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
});

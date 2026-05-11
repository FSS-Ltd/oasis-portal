import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import oasisLogo from '../../../assets/oasis-logo.png';
import { C } from './mobile-theme';

type NavVariant = 'light' | 'dark';
export type PortalMobileNavIconName =
  | 'attendance'
  | 'behaviour'
  | 'dashboard'
  | 'messages'
  | 'notices'
  | 'pace'
  | 'students';

export interface PortalMobileNavItem<T extends string> {
  id: T;
  label: string;
  badge?: number | undefined;
  icon?: PortalMobileNavIconName | undefined;
}

interface PortalMobileHeaderProps {
  eyebrow: string;
  title: string;
  subtitle?: string | undefined;
  avatarLabel: string;
  actionLabel: string;
  actionAccessibilityLabel: string;
  onActionPress: () => void;
  variant?: NavVariant;
}

interface PortalMobileBottomNavProps<T extends string> {
  items: Array<PortalMobileNavItem<T>>;
  activeId: T;
  onSelect: (id: T) => void;
  variant?: NavVariant;
}

export function PortalMobileHeader({
  actionAccessibilityLabel,
  actionLabel,
  avatarLabel,
  eyebrow,
  onActionPress,
  subtitle,
  title,
  variant = 'light',
}: PortalMobileHeaderProps) {
  const dark = variant === 'dark';

  return (
    <View style={[styles.header, dark ? styles.headerDark : styles.headerLight]}>
      <View style={styles.brandGroup}>
        <View style={styles.logoFrame}>
          <Image
            accessibilityIgnoresInvertColors
            accessibilityLabel="Oasis Learning Centre"
            source={oasisLogo}
            style={styles.logo}
          />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.headerEyebrow}>{eyebrow}</Text>
          <Text numberOfLines={1} style={styles.headerTitle}>
            {title}
          </Text>
          {subtitle ? (
            <Text numberOfLines={1} style={styles.headerSubtitle}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      <Pressable
        accessibilityLabel={actionAccessibilityLabel}
        accessibilityRole="button"
        onPress={onActionPress}
        style={styles.accountButton}
      >
        <View style={styles.accountAvatar}>
          <Text style={styles.accountAvatarText}>{avatarLabel}</Text>
        </View>
        <Text style={styles.accountButtonText}>{actionLabel}</Text>
      </Pressable>
    </View>
  );
}

export function PortalMobileBottomNav<T extends string>({
  activeId,
  items,
  onSelect,
  variant = 'light',
}: PortalMobileBottomNavProps<T>) {
  const dark = variant === 'dark';

  return (
    <View style={[styles.bottomNav, dark ? styles.bottomNavDark : styles.bottomNavLight]}>
      {items.map((item) => {
        const active = activeId === item.id;
        const badge = item.badge ?? 0;
        const itemColor = active
          ? dark
            ? C.surface
            : C.crimson
          : dark
            ? 'rgba(255,255,255,0.54)'
            : C.textMuted;

        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            key={item.id}
            onPress={() => {
              onSelect(item.id);
            }}
            style={styles.bottomNavItem}
          >
            <PortalMobileNavIcon color={itemColor} name={item.icon ?? navIconFromId(item.id)} />
            <Text numberOfLines={1} style={[styles.bottomNavLabel, { color: itemColor }]}>
              {item.label}
            </Text>
            {badge > 0 ? (
              <View style={styles.bottomNavBadge}>
                <Text style={styles.bottomNavBadgeText}>{String(badge)}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

function navIconFromId(id: string): PortalMobileNavIconName {
  switch (id) {
    case 'attendance':
    case 'behaviour':
    case 'dashboard':
    case 'messages':
    case 'notices':
    case 'pace':
    case 'students':
      return id;
    case 'home':
      return 'dashboard';
    default:
      return 'dashboard';
  }
}

function PortalMobileNavIcon({
  color,
  name,
}: {
  color: string;
  name: PortalMobileNavIconName;
}) {
  switch (name) {
    case 'students':
      return <StudentsNavIcon color={color} />;
    case 'attendance':
      return <AttendanceNavIcon color={color} />;
    case 'behaviour':
      return <BehaviourNavIcon color={color} />;
    case 'messages':
      return <MessagesNavIcon color={color} />;
    case 'notices':
      return <NoticesNavIcon color={color} />;
    case 'pace':
      return <PaceNavIcon color={color} />;
    case 'dashboard':
      return <DashboardNavIcon color={color} />;
  }
}

function DashboardNavIcon({ color }: { color: string }) {
  return (
    <View style={styles.navIconBox}>
      <View style={[styles.dashboardRoof, { borderColor: color }]} />
      <View style={[styles.dashboardBody, { borderColor: color }]}>
        <View style={[styles.dashboardDoor, { borderColor: color }]} />
      </View>
    </View>
  );
}

function StudentsNavIcon({ color }: { color: string }) {
  return (
    <View style={styles.navIconBox}>
      <View style={[styles.studentHead, styles.studentHeadLeft, { borderColor: color }]} />
      <View style={[styles.studentHead, styles.studentHeadRight, { borderColor: color }]} />
      <View style={[styles.studentHeadPrimary, { borderColor: color }]} />
      <View style={[styles.studentShoulder, styles.studentShoulderLeft, { borderColor: color }]} />
      <View style={[styles.studentShoulder, styles.studentShoulderRight, { borderColor: color }]} />
      <View style={[styles.studentShoulderPrimary, { borderColor: color }]} />
    </View>
  );
}

function AttendanceNavIcon({ color }: { color: string }) {
  return (
    <View style={styles.navIconBox}>
      <View style={[styles.clipboard, { borderColor: color }]}>
        <View style={[styles.clipboardClip, { borderColor: color }]} />
        <View style={[styles.clipboardCheck, { borderColor: color }]} />
      </View>
    </View>
  );
}

function BehaviourNavIcon({ color }: { color: string }) {
  return (
    <Text allowFontScaling={false} style={[styles.starIcon, { color }]}>
      ☆
    </Text>
  );
}

function MessagesNavIcon({ color }: { color: string }) {
  return (
    <View style={styles.navIconBox}>
      <View style={[styles.messageBubble, { borderColor: color }]}>
        <View style={styles.messageDotRow}>
          <View style={[styles.messageDot, { backgroundColor: color }]} />
          <View style={[styles.messageDot, { backgroundColor: color }]} />
          <View style={[styles.messageDot, { backgroundColor: color }]} />
        </View>
        <View style={[styles.messageTail, { borderColor: color }]} />
      </View>
    </View>
  );
}

function NoticesNavIcon({ color }: { color: string }) {
  return (
    <View style={styles.navIconBox}>
      <View style={[styles.noticeDocument, { borderColor: color }]}>
        <View style={[styles.noticeLine, { backgroundColor: color, width: 11 }]} />
        <View style={[styles.noticeLine, { backgroundColor: color, width: 15 }]} />
        <View style={[styles.noticeLine, { backgroundColor: color, width: 9 }]} />
      </View>
    </View>
  );
}

function PaceNavIcon({ color }: { color: string }) {
  return (
    <View style={styles.navIconBox}>
      <View style={styles.paceBook}>
        <View style={[styles.pacePage, styles.pacePageLeft, { borderColor: color }]} />
        <View style={[styles.paceSpine, { backgroundColor: color }]} />
        <View style={[styles.pacePage, styles.pacePageRight, { borderColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  accountAvatar: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 11,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  accountAvatarText: {
    color: C.surface,
    fontSize: 11,
    fontWeight: '800',
  },
  accountButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderColor: 'rgba(255,255,255,0.26)',
    borderRadius: 8,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: 7,
    minHeight: 36,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  accountButtonText: {
    color: C.surface,
    fontSize: 11,
    fontWeight: '800',
  },
  bottomNav: {
    borderTopWidth: 1,
    flexDirection: 'row',
    minHeight: 86,
    paddingBottom: 9,
    paddingHorizontal: 4,
    paddingTop: 10,
  },
  bottomNavBadge: {
    alignItems: 'center',
    backgroundColor: C.crimson,
    borderRadius: 9,
    justifyContent: 'center',
    minHeight: 18,
    minWidth: 18,
    paddingHorizontal: 5,
    position: 'absolute',
    right: 18,
    top: 7,
  },
  bottomNavBadgeText: {
    color: C.surface,
    fontSize: 10,
    fontWeight: '900',
  },
  bottomNavDark: {
    backgroundColor: C.navy,
    borderTopColor: 'rgba(255,255,255,0.22)',
  },
  bottomNavItem: {
    alignItems: 'center',
    flex: 1,
    gap: 7,
    justifyContent: 'center',
    minHeight: 66,
    position: 'relative',
  },
  bottomNavLabel: {
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 15,
  },
  bottomNavLight: {
    backgroundColor: C.surface,
    borderTopColor: C.border,
  },
  brandGroup: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    minWidth: 0,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerDark: {
    backgroundColor: C.navy,
  },
  headerEyebrow: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 11,
    fontWeight: '700',
  },
  headerLight: {
    backgroundColor: C.crimson,
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.74)',
    fontSize: 11,
    fontWeight: '600',
  },
  headerText: {
    flex: 1,
    gap: 1,
    minWidth: 0,
  },
  headerTitle: {
    color: C.surface,
    fontSize: 14,
    fontWeight: '800',
  },
  logo: {
    height: 28,
    resizeMode: 'contain',
    width: 28,
  },
  logoFrame: {
    alignItems: 'center',
    backgroundColor: C.surface,
    borderRadius: 8,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  clipboard: {
    alignItems: 'center',
    borderRadius: 5,
    borderWidth: 2.2,
    height: 26,
    justifyContent: 'center',
    width: 20,
  },
  clipboardCheck: {
    borderBottomWidth: 2.2,
    borderLeftWidth: 2.2,
    height: 6,
    marginTop: 2,
    transform: [{ rotate: '-45deg' }],
    width: 11,
  },
  clipboardClip: {
    borderRadius: 4,
    borderWidth: 2.2,
    height: 7,
    position: 'absolute',
    top: -5,
    width: 9,
  },
  dashboardBody: {
    alignItems: 'center',
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
    borderBottomWidth: 2.3,
    borderLeftWidth: 2.3,
    borderRightWidth: 2.3,
    height: 16,
    justifyContent: 'flex-end',
    marginTop: 10,
    width: 21,
  },
  dashboardDoor: {
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderTopWidth: 2,
    height: 9,
    width: 7,
  },
  dashboardRoof: {
    borderLeftWidth: 2.3,
    borderTopLeftRadius: 2,
    borderTopWidth: 2.3,
    height: 17,
    position: 'absolute',
    top: 3,
    transform: [{ rotate: '45deg' }],
    width: 17,
  },
  messageBubble: {
    alignItems: 'center',
    borderRadius: 5,
    borderWidth: 2.2,
    height: 21,
    justifyContent: 'center',
    width: 29,
  },
  messageDot: {
    borderRadius: 2,
    height: 4,
    width: 4,
  },
  messageDotRow: {
    flexDirection: 'row',
    gap: 4,
  },
  messageTail: {
    borderBottomWidth: 2.2,
    borderRightWidth: 2.2,
    bottom: -5,
    height: 8,
    position: 'absolute',
    right: 6,
    transform: [{ rotate: '45deg' }],
    width: 8,
  },
  navIconBox: {
    alignItems: 'center',
    height: 30,
    justifyContent: 'center',
    width: 34,
  },
  noticeDocument: {
    borderRadius: 5,
    borderWidth: 2.2,
    gap: 4,
    height: 26,
    justifyContent: 'center',
    paddingHorizontal: 4,
    width: 22,
  },
  noticeLine: {
    borderRadius: 1,
    height: 2,
  },
  paceBook: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 25,
    justifyContent: 'center',
    width: 30,
  },
  pacePage: {
    borderWidth: 2.2,
    height: 23,
    width: 13,
  },
  pacePageLeft: {
    borderBottomLeftRadius: 5,
    borderRightWidth: 0,
    borderTopLeftRadius: 5,
  },
  pacePageRight: {
    borderBottomRightRadius: 5,
    borderLeftWidth: 0,
    borderTopRightRadius: 5,
  },
  paceSpine: {
    borderRadius: 1,
    height: 23,
    width: 2,
  },
  starIcon: {
    fontSize: 33,
    fontWeight: '500',
    height: 30,
    lineHeight: 31,
    textAlign: 'center',
    width: 34,
  },
  studentHead: {
    borderRadius: 5,
    borderWidth: 2.1,
    height: 10,
    position: 'absolute',
    top: 5,
    width: 10,
  },
  studentHeadLeft: {
    left: 4,
  },
  studentHeadPrimary: {
    borderRadius: 6,
    borderWidth: 2.1,
    height: 12,
    position: 'absolute',
    top: 3,
    width: 12,
    zIndex: 1,
  },
  studentHeadRight: {
    right: 4,
  },
  studentShoulder: {
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
    borderTopWidth: 2.1,
    height: 9,
    position: 'absolute',
    top: 17,
    width: 13,
  },
  studentShoulderLeft: {
    left: 3,
  },
  studentShoulderPrimary: {
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderTopWidth: 2.1,
    height: 10,
    position: 'absolute',
    top: 17,
    width: 18,
    zIndex: 1,
  },
  studentShoulderRight: {
    right: 3,
  },
});

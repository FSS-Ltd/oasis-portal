import { useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import oasisLogo from '../../../assets/oasis-logo.png';
import { C } from './mobile-theme';

type NavVariant = 'light' | 'dark';
export type PortalMobileNavIconName =
  | 'attendance'
  | 'behaviour'
  | 'calendar'
  | 'clubs'
  | 'dashboard'
  | 'leaderboard'
  | 'messages'
  | 'more'
  | 'notices'
  | 'pace'
  | 'shop'
  | 'students'
  | 'wallet';

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
  primaryItemLimit?: number | undefined;
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
  primaryItemLimit = 4,
  variant = 'light',
}: PortalMobileBottomNavProps<T>) {
  const dark = variant === 'dark';
  const [drawerVisible, setDrawerVisible] = useState(false);
  const drawerOffset = useRef(new Animated.Value(360)).current;
  const visiblePrimaryCount =
    items.length > primaryItemLimit ? Math.max(primaryItemLimit - 1, 1) : items.length;
  const primaryItems = useMemo(
    () => items.slice(0, visiblePrimaryCount),
    [items, visiblePrimaryCount],
  );
  const overflowItems = useMemo(
    () => items.slice(visiblePrimaryCount),
    [items, visiblePrimaryCount],
  );
  const hasOverflow = overflowItems.length > 0;
  const overflowActive = overflowItems.some((item) => item.id === activeId);
  const overflowBadgeCount = overflowItems.reduce((count, item) => count + (item.badge ?? 0), 0);

  function settleDrawer() {
    Animated.sequence([
      Animated.timing(drawerOffset, {
        duration: 210,
        easing: Easing.out(Easing.quad),
        toValue: -12,
        useNativeDriver: true,
      }),
      Animated.timing(drawerOffset, {
        duration: 260,
        easing: Easing.in(Easing.quad),
        toValue: 7,
        useNativeDriver: true,
      }),
      Animated.timing(drawerOffset, {
        duration: 180,
        easing: Easing.out(Easing.quad),
        toValue: -4,
        useNativeDriver: true,
      }),
      Animated.timing(drawerOffset, {
        duration: 210,
        easing: Easing.in(Easing.quad),
        toValue: 2,
        useNativeDriver: true,
      }),
      Animated.spring(drawerOffset, {
        bounciness: 2,
        speed: 5,
        toValue: 0,
        useNativeDriver: true,
      }),
    ]).start();
  }

  function openDrawer() {
    setDrawerVisible(true);
    drawerOffset.setValue(360);
    Animated.sequence([
      Animated.timing(drawerOffset, {
        duration: 620,
        easing: Easing.out(Easing.cubic),
        toValue: -30,
        useNativeDriver: true,
      }),
      Animated.timing(drawerOffset, {
        duration: 330,
        easing: Easing.in(Easing.quad),
        toValue: 17,
        useNativeDriver: true,
      }),
      Animated.timing(drawerOffset, {
        duration: 250,
        easing: Easing.out(Easing.quad),
        toValue: -11,
        useNativeDriver: true,
      }),
      Animated.timing(drawerOffset, {
        duration: 270,
        easing: Easing.in(Easing.quad),
        toValue: 6,
        useNativeDriver: true,
      }),
      Animated.timing(drawerOffset, {
        duration: 190,
        easing: Easing.out(Easing.quad),
        toValue: -3,
        useNativeDriver: true,
      }),
      Animated.timing(drawerOffset, {
        duration: 210,
        easing: Easing.in(Easing.quad),
        toValue: 2,
        useNativeDriver: true,
      }),
      Animated.spring(drawerOffset, {
        bounciness: 2,
        speed: 5,
        toValue: 0,
        useNativeDriver: true,
      }),
    ]).start();
  }

  function closeDrawer() {
    Animated.timing(drawerOffset, {
      duration: 320,
      easing: Easing.inOut(Easing.cubic),
      toValue: 360,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setDrawerVisible(false);
    });
  }

  const drawerPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, gestureState) =>
          gestureState.dy > 8 && gestureState.dy > Math.abs(gestureState.dx),
        onMoveShouldSetPanResponder: (_, gestureState) =>
          gestureState.dy > 8 && gestureState.dy > Math.abs(gestureState.dx),
        onPanResponderMove: (_, gestureState) => {
          drawerOffset.setValue(Math.max(gestureState.dy, 0));
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dy > 86 || gestureState.vy > 0.75) {
            closeDrawer();
            return;
          }

          settleDrawer();
        },
        onPanResponderTerminate: settleDrawer,
      }),
    [drawerOffset],
  );

  function itemColor(active: boolean) {
    if (active) return dark ? C.surface : C.crimson;
    return dark ? 'rgba(255,255,255,0.54)' : C.textMuted;
  }

  function renderBottomNavItem(item: PortalMobileNavItem<T>) {
    const active = activeId === item.id;
    const badge = item.badge ?? 0;
    const color = itemColor(active);

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
        <PortalMobileNavIcon color={color} name={item.icon ?? navIconFromId(item.id)} />
        <Text numberOfLines={1} style={[styles.bottomNavLabel, { color }]}>
          {item.label}
        </Text>
        {badge > 0 ? (
          <View style={styles.bottomNavBadge}>
            <Text style={styles.bottomNavBadgeText}>{String(badge)}</Text>
          </View>
        ) : null}
      </Pressable>
    );
  }

  return (
    <>
      <View style={[styles.bottomNav, dark ? styles.bottomNavDark : styles.bottomNavLight]}>
        {primaryItems.map(renderBottomNavItem)}
        {hasOverflow ? (
          <Pressable
            accessibilityLabel="More navigation options"
            accessibilityRole="button"
            accessibilityState={{ expanded: drawerVisible, selected: overflowActive }}
            onPress={openDrawer}
            style={styles.bottomNavItem}
          >
            <PortalMobileNavIcon color={itemColor(overflowActive)} name="more" />
            <Text
              numberOfLines={1}
              style={[styles.bottomNavLabel, { color: itemColor(overflowActive) }]}
            >
              More
            </Text>
            {overflowBadgeCount > 0 ? (
              <View style={styles.bottomNavBadge}>
                <Text style={styles.bottomNavBadgeText}>{String(overflowBadgeCount)}</Text>
              </View>
            ) : null}
          </Pressable>
        ) : null}
      </View>
      <Modal animationType="none" onRequestClose={closeDrawer} transparent visible={drawerVisible}>
        <View style={styles.drawerRoot}>
          <Pressable
            accessibilityLabel="Close navigation menu"
            accessibilityRole="button"
            onPress={closeDrawer}
            style={styles.drawerBackdrop}
          />
          <Animated.View
            {...drawerPanResponder.panHandlers}
            style={[
              styles.drawerPanel,
              dark ? styles.drawerPanelDark : styles.drawerPanelLight,
              { transform: [{ translateY: drawerOffset }] },
            ]}
          >
            <View style={styles.drawerHandle} />
            <Text
              style={[styles.drawerTitle, dark ? styles.drawerTitleDark : styles.drawerTitleLight]}
            >
              More
            </Text>
            <View style={styles.drawerList}>
              {overflowItems.map((item) => {
                const active = activeId === item.id;
                const badge = item.badge ?? 0;
                const color = itemColor(active);

                return (
                  <Pressable
                    accessibilityRole="menuitem"
                    accessibilityState={{ selected: active }}
                    key={item.id}
                    onPress={() => {
                      closeDrawer();
                      onSelect(item.id);
                    }}
                    style={[
                      styles.drawerItem,
                      active
                        ? dark
                          ? styles.drawerItemActiveDark
                          : styles.drawerItemActiveLight
                        : null,
                    ]}
                  >
                    <PortalMobileNavIcon color={color} name={item.icon ?? navIconFromId(item.id)} />
                    <Text style={[styles.drawerItemLabel, { color }]}>{item.label}</Text>
                    {badge > 0 ? (
                      <View style={styles.drawerBadge}>
                        <Text style={styles.bottomNavBadgeText}>{String(badge)}</Text>
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

function navIconFromId(id: string): PortalMobileNavIconName {
  switch (id) {
    case 'attendance':
    case 'behaviour':
    case 'calendar':
    case 'clubs':
    case 'dashboard':
    case 'messages':
    case 'more':
    case 'notices':
    case 'pace':
    case 'leaderboard':
    case 'shop':
    case 'students':
    case 'wallet':
      return id;
    case 'home':
      return 'dashboard';
    default:
      return 'dashboard';
  }
}

function PortalMobileNavIcon({ color, name }: { color: string; name: PortalMobileNavIconName }) {
  switch (name) {
    case 'students':
      return <StudentsNavIcon color={color} />;
    case 'attendance':
      return <AttendanceNavIcon color={color} />;
    case 'behaviour':
      return <BehaviourNavIcon color={color} />;
    case 'calendar':
      return <CalendarNavIcon color={color} />;
    case 'clubs':
      return <ClubsNavIcon color={color} />;
    case 'messages':
      return <MessagesNavIcon color={color} />;
    case 'leaderboard':
      return <LeaderboardNavIcon color={color} />;
    case 'more':
      return <MoreNavIcon color={color} />;
    case 'notices':
      return <NoticesNavIcon color={color} />;
    case 'pace':
      return <PaceNavIcon color={color} />;
    case 'shop':
      return <ShopNavIcon color={color} />;
    case 'wallet':
      return <WalletNavIcon color={color} />;
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

function CalendarNavIcon({ color }: { color: string }) {
  return (
    <View style={styles.navIconBox}>
      <View style={[styles.calendarIconBody, { borderColor: color }]}>
        <View style={[styles.calendarIconHeader, { backgroundColor: color }]} />
        <View style={styles.calendarIconGrid}>
          <View style={[styles.calendarIconDot, { backgroundColor: color }]} />
          <View style={[styles.calendarIconDot, { backgroundColor: color }]} />
          <View style={[styles.calendarIconDot, { backgroundColor: color }]} />
          <View style={[styles.calendarIconDot, { backgroundColor: color }]} />
        </View>
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

function ClubsNavIcon({ color }: { color: string }) {
  return (
    <View style={styles.navIconBox}>
      <View style={[styles.clubHead, styles.clubHeadLeft, { borderColor: color }]} />
      <View style={[styles.clubHead, styles.clubHeadRight, { borderColor: color }]} />
      <View style={[styles.clubHeadPrimary, { borderColor: color }]} />
      <View style={[styles.clubBase, styles.clubBaseLeft, { borderColor: color }]} />
      <View style={[styles.clubBase, styles.clubBaseRight, { borderColor: color }]} />
      <View style={[styles.clubBasePrimary, { borderColor: color }]} />
    </View>
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

function WalletNavIcon({ color }: { color: string }) {
  return (
    <View style={styles.navIconBox}>
      <View style={[styles.walletIconBody, { borderColor: color }]}>
        <View style={[styles.walletIconFlap, { borderColor: color }]} />
        <View style={[styles.walletIconDot, { backgroundColor: color }]} />
      </View>
    </View>
  );
}

function LeaderboardNavIcon({ color }: { color: string }) {
  return (
    <View style={styles.navIconBox}>
      <View style={styles.leaderboardBars}>
        <View
          style={[styles.leaderboardBar, styles.leaderboardBarShort, { backgroundColor: color }]}
        />
        <View
          style={[styles.leaderboardBar, styles.leaderboardBarTall, { backgroundColor: color }]}
        />
        <View
          style={[styles.leaderboardBar, styles.leaderboardBarMid, { backgroundColor: color }]}
        />
      </View>
    </View>
  );
}

function ShopNavIcon({ color }: { color: string }) {
  return (
    <View style={styles.navIconBox}>
      <View style={[styles.shopBag, { borderColor: color }]}>
        <View style={[styles.shopHandle, { borderColor: color }]} />
      </View>
    </View>
  );
}

function MoreNavIcon({ color }: { color: string }) {
  return (
    <View style={styles.navIconBox}>
      <View style={styles.moreDotRow}>
        <View style={[styles.moreDot, { backgroundColor: color }]} />
        <View style={[styles.moreDot, { backgroundColor: color }]} />
        <View style={[styles.moreDot, { backgroundColor: color }]} />
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
    minHeight: 78,
    paddingBottom: 7,
    paddingHorizontal: 4,
    paddingTop: 8,
  },
  bottomNavBadge: {
    alignItems: 'center',
    backgroundColor: C.crimson,
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 16,
    minWidth: 16,
    paddingHorizontal: 4,
    position: 'absolute',
    right: 16,
    top: 6,
  },
  bottomNavBadgeText: {
    color: C.surface,
    fontSize: 9,
    fontWeight: '900',
  },
  bottomNavDark: {
    backgroundColor: C.navy,
    borderTopColor: 'rgba(255,255,255,0.22)',
  },
  bottomNavItem: {
    alignItems: 'center',
    flex: 1,
    gap: 5,
    justifyContent: 'center',
    minHeight: 58,
    position: 'relative',
  },
  bottomNavLabel: {
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 14,
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
  walletIconBody: {
    borderRadius: 5,
    borderWidth: 2.2,
    height: 20,
    justifyContent: 'center',
    width: 27,
  },
  walletIconDot: {
    borderRadius: 2,
    height: 4,
    position: 'absolute',
    right: 5,
    width: 4,
  },
  walletIconFlap: {
    borderTopWidth: 2.2,
    left: 4,
    position: 'absolute',
    right: 4,
    top: 5,
  },
  calendarIconBody: {
    borderRadius: 5,
    borderWidth: 2.2,
    height: 23,
    overflow: 'hidden',
    width: 24,
  },
  calendarIconDot: {
    borderRadius: 1.5,
    height: 3,
    width: 3,
  },
  calendarIconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    paddingHorizontal: 5,
    paddingTop: 5,
  },
  calendarIconHeader: {
    height: 6,
    width: '100%',
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
  clubBase: {
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
    borderTopWidth: 2.1,
    height: 9,
    position: 'absolute',
    top: 18,
    width: 13,
  },
  clubBaseLeft: {
    left: 3,
  },
  clubBasePrimary: {
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderTopWidth: 2.1,
    height: 10,
    position: 'absolute',
    top: 17,
    width: 18,
    zIndex: 1,
  },
  clubBaseRight: {
    right: 3,
  },
  clubHead: {
    borderRadius: 5,
    borderWidth: 2.1,
    height: 10,
    position: 'absolute',
    top: 6,
    width: 10,
  },
  clubHeadLeft: {
    left: 4,
  },
  clubHeadPrimary: {
    borderRadius: 6,
    borderWidth: 2.1,
    height: 12,
    position: 'absolute',
    top: 3,
    width: 12,
    zIndex: 1,
  },
  clubHeadRight: {
    right: 4,
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
  leaderboardBar: {
    borderRadius: 2,
    width: 5,
  },
  leaderboardBarMid: {
    height: 17,
  },
  leaderboardBarShort: {
    height: 12,
  },
  leaderboardBarTall: {
    height: 24,
  },
  leaderboardBars: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 4,
    height: 26,
  },
  drawerBackdrop: {
    flex: 1,
  },
  drawerBadge: {
    alignItems: 'center',
    backgroundColor: C.crimson,
    borderRadius: 9,
    justifyContent: 'center',
    minHeight: 18,
    minWidth: 18,
    paddingHorizontal: 5,
  },
  drawerHandle: {
    alignSelf: 'center',
    backgroundColor: C.border,
    borderRadius: 2,
    height: 4,
    marginBottom: 14,
    width: 42,
  },
  drawerItem: {
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 10,
    minHeight: 50,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  drawerItemActiveDark: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  drawerItemActiveLight: {
    backgroundColor: C.crimsonLight,
  },
  drawerItemLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
  },
  drawerList: {
    gap: 6,
  },
  drawerPanel: {
    borderBottomWidth: 0,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    marginBottom: -72,
    paddingBottom: 96,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  drawerPanelDark: {
    backgroundColor: C.navy,
    borderColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
  },
  drawerPanelLight: {
    backgroundColor: C.surface,
    borderColor: C.border,
    borderWidth: 1,
  },
  drawerRoot: {
    backgroundColor: 'rgba(10,18,42,0.34)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  drawerTitle: {
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 10,
  },
  drawerTitleDark: {
    color: C.surface,
  },
  drawerTitleLight: {
    color: C.navy,
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
  moreDot: {
    borderRadius: 3,
    height: 6,
    width: 6,
  },
  moreDotRow: {
    flexDirection: 'row',
    gap: 5,
  },
  navIconBox: {
    alignItems: 'center',
    height: 27,
    justifyContent: 'center',
    transform: [{ scale: 0.92 }],
    width: 31,
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
  shopBag: {
    borderRadius: 5,
    borderWidth: 2.2,
    height: 22,
    marginTop: 4,
    width: 24,
  },
  shopHandle: {
    borderRadius: 7,
    borderTopWidth: 2.2,
    height: 9,
    left: 5,
    position: 'absolute',
    top: -7,
    width: 10,
  },
  starIcon: {
    fontSize: 29,
    fontWeight: '500',
    height: 27,
    lineHeight: 28,
    textAlign: 'center',
    width: 31,
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

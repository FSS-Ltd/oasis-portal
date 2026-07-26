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
import { PortalMobileNavIcon } from './portal-mobile-nav-icon';
import type { PortalMobileNavIconName } from './portal-mobile-nav-icon-types';

type NavVariant = 'light' | 'dark';
export type { PortalMobileNavIconName } from './portal-mobile-nav-icon-types';

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

interface DrawerTimingStep {
  duration: number;
  easing: (value: number) => number;
  toValue: number;
}

const drawerSettleSteps: readonly DrawerTimingStep[] = [
  { duration: 210, easing: Easing.out(Easing.quad), toValue: -12 },
  { duration: 260, easing: Easing.in(Easing.quad), toValue: 7 },
  { duration: 180, easing: Easing.out(Easing.quad), toValue: -4 },
  { duration: 210, easing: Easing.in(Easing.quad), toValue: 2 },
];

const drawerOpenSteps: readonly DrawerTimingStep[] = [
  { duration: 620, easing: Easing.out(Easing.cubic), toValue: -30 },
  { duration: 330, easing: Easing.in(Easing.quad), toValue: 17 },
  { duration: 250, easing: Easing.out(Easing.quad), toValue: -11 },
  { duration: 270, easing: Easing.in(Easing.quad), toValue: 6 },
  { duration: 190, easing: Easing.out(Easing.quad), toValue: -3 },
  { duration: 210, easing: Easing.in(Easing.quad), toValue: 2 },
];

function drawerTiming(
  drawerOffset: Animated.Value,
  { duration, easing, toValue }: DrawerTimingStep,
) {
  return Animated.timing(drawerOffset, {
    duration,
    easing,
    toValue,
    useNativeDriver: true,
  });
}

function drawerSpring(drawerOffset: Animated.Value) {
  return Animated.spring(drawerOffset, {
    bounciness: 2,
    speed: 5,
    toValue: 0,
    useNativeDriver: true,
  });
}

function runDrawerBounce(drawerOffset: Animated.Value, steps: readonly DrawerTimingStep[]) {
  Animated.sequence([
    ...steps.map((step) => drawerTiming(drawerOffset, step)),
    drawerSpring(drawerOffset),
  ]).start();
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
    runDrawerBounce(drawerOffset, drawerSettleSteps);
  }

  function openDrawer() {
    setDrawerVisible(true);
    drawerOffset.setValue(360);
    runDrawerBounce(drawerOffset, drawerOpenSteps);
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
    case 'activity':
    case 'behaviour':
    case 'calendar':
    case 'clubs':
    case 'community':
    case 'dashboard':
    case 'faith':
    case 'fees':
    case 'incidents':
    case 'messages':
    case 'markets':
    case 'mobile':
    case 'more':
    case 'notices':
    case 'pace':
    case 'profile':
    case 'reports':
    case 'settings':
    case 'leaderboard':
    case 'shop':
    case 'slips':
    case 'students':
    case 'wallet':
      return id;
    case 'home':
      return 'dashboard';
    default:
      return 'dashboard';
  }
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
});

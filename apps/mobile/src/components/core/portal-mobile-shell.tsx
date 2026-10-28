import { CLUBS_VISIBLE, HOMEWORK_VISIBLE, ROTA_VISIBLE } from '@oasis/domain/portal-visibility';
import { selectionAsync } from 'expo-haptics';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import crest from '../../../assets/crest.png';
import { GlassFill, GlassGroup, GlassSurface, useGlassMode, useReduceMotion } from './glass';
import { C, elevation, radius, typeRamp } from './mobile-theme';
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
  /** Slides the bar out of view, as iOS does when a pushed screen needs the whole height. */
  hidden?: boolean;
  onSelect: (id: T) => void;
  primaryItemLimit?: number | undefined;
  variant?: NavVariant;
}

// Nav chrome scales with Dynamic Type but is capped so the brand row stays on screen.
const HEADER_MAX_FONT_SCALE = 1.5;
const BAR_RADIUS = 34;
const BAR_PADDING = 6;
const SLOT_HEIGHT = 54;
const DRAWER_HIDDEN = 420;
const DRAWER_RADIUS = 28;
const DRAWER_OVERSCAN = 40;

// Parent is crimson, student and staff are navy: identity lives in the accent, not a full-bleed bar.
function accentFor(variant: NavVariant) {
  return variant === 'dark' ? C.navy : C.crimson;
}

function indicatorTintFor(variant: NavVariant) {
  return variant === 'dark' ? 'rgba(27,43,94,0.11)' : C.glassTint;
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
  const accent = accentFor(variant);

  return (
    <View style={styles.header}>
      <View style={styles.brandGroup}>
        <View style={styles.logoFrame}>
          <Image
            accessibilityIgnoresInvertColors
            accessibilityLabel="Oasis Learning Centre"
            source={crest}
            style={styles.logo}
          />
        </View>
        <View style={styles.headerText}>
          <Text
            maxFontSizeMultiplier={HEADER_MAX_FONT_SCALE}
            numberOfLines={1}
            style={[styles.headerEyebrow, { color: accent }]}
          >
            {eyebrow}
          </Text>
          <Text
            accessibilityRole="header"
            maxFontSizeMultiplier={HEADER_MAX_FONT_SCALE}
            numberOfLines={2}
            style={styles.headerTitle}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              maxFontSizeMultiplier={HEADER_MAX_FONT_SCALE}
              numberOfLines={2}
              style={styles.headerSubtitle}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      <GlassSurface style={styles.accountGlass}>
        <Pressable
          accessibilityLabel={actionAccessibilityLabel}
          accessibilityRole="button"
          hitSlop={6}
          onPress={onActionPress}
          style={({ pressed }) => [styles.accountButton, pressed ? styles.pressed : null]}
        >
          <View style={[styles.accountAvatar, { backgroundColor: accent }]}>
            <Text maxFontSizeMultiplier={1} style={styles.accountAvatarText}>
              {avatarLabel}
            </Text>
          </View>
          <Text maxFontSizeMultiplier={1.3} style={styles.accountButtonText}>
            {actionLabel}
          </Text>
        </Pressable>
      </GlassSurface>
    </View>
  );
}

export function PortalMobileBottomNav<T extends string>({
  activeId,
  hidden = false,
  items: allItems,
  onSelect,
  primaryItemLimit = 4,
  variant = 'light',
}: PortalMobileBottomNavProps<T>) {
  const items = useMemo(
    () =>
      allItems.filter(
        (item) =>
          (CLUBS_VISIBLE || item.id !== 'clubs') &&
          (ROTA_VISIBLE || item.id !== 'rota') &&
          (HOMEWORK_VISIBLE || item.id !== 'activity'),
      ),
    [allItems],
  );
  const accent = accentFor(variant);
  const insets = useSafeAreaInsets();
  const mode = useGlassMode();
  const reduceMotion = useReduceMotion();
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [barWidth, setBarWidth] = useState(0);
  const drawerOffset = useRef(new Animated.Value(DRAWER_HIDDEN)).current;
  const indicatorX = useRef(new Animated.Value(0)).current;
  const indicatorPlaced = useRef(false);
  const hide = useRef(new Animated.Value(hidden ? 1 : 0)).current;
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
  const activePrimaryIndex = primaryItems.findIndex((item) => item.id === activeId);
  const activeSlot =
    activePrimaryIndex >= 0 ? activePrimaryIndex : overflowActive ? primaryItems.length : -1;
  const slotCount = primaryItems.length + (hasOverflow ? 1 : 0);
  const slotWidth = barWidth > 0 && slotCount > 0 ? (barWidth - BAR_PADDING * 2) / slotCount : 0;

  useEffect(() => {
    if (activeSlot < 0 || slotWidth === 0) return;
    const toValue = activeSlot * slotWidth;

    if (!indicatorPlaced.current || reduceMotion) {
      indicatorPlaced.current = true;
      indicatorX.setValue(toValue);
      return;
    }

    Animated.spring(indicatorX, {
      damping: 28,
      mass: 1,
      stiffness: 320,
      toValue,
      useNativeDriver: true,
    }).start();
  }, [activeSlot, indicatorX, reduceMotion, slotWidth]);

  useEffect(() => {
    const toValue = hidden ? 1 : 0;
    if (reduceMotion) {
      hide.setValue(toValue);
      return;
    }
    Animated.spring(hide, {
      damping: 30,
      mass: 1,
      overshootClamping: true,
      stiffness: 260,
      toValue,
      useNativeDriver: true,
    }).start();
  }, [hidden, hide, reduceMotion]);

  function settleDrawer() {
    Animated.spring(drawerOffset, {
      damping: 30,
      mass: 1,
      stiffness: 280,
      toValue: 0,
      useNativeDriver: true,
    }).start();
  }

  function openDrawer() {
    setDrawerVisible(true);
    if (reduceMotion) {
      drawerOffset.setValue(0);
      return;
    }
    drawerOffset.setValue(DRAWER_HIDDEN);
    settleDrawer();
  }

  function closeDrawer() {
    if (reduceMotion) {
      drawerOffset.setValue(DRAWER_HIDDEN);
      setDrawerVisible(false);
      return;
    }
    Animated.timing(drawerOffset, {
      duration: 220,
      easing: Easing.in(Easing.cubic),
      toValue: DRAWER_HIDDEN,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setDrawerVisible(false);
    });
  }

  function select(id: T) {
    if (Platform.OS === 'ios') selectionAsync().catch(() => undefined);
    onSelect(id);
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
    // closeDrawer and settleDrawer only read refs and the reduce-motion flag.
    [drawerOffset, reduceMotion],
  );

  function itemColor(active: boolean) {
    return active ? accent : C.textSecondary;
  }

  function badgeLabel(label: string, badge: number) {
    return badge > 0 ? `${label}, ${String(badge)} new` : label;
  }

  function renderBottomNavItem(item: PortalMobileNavItem<T>) {
    const active = activeId === item.id;
    const badge = item.badge ?? 0;
    const color = itemColor(active);

    return (
      <Pressable
        accessibilityLabel={badgeLabel(item.label, badge)}
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        key={item.id}
        onPress={() => {
          select(item.id);
        }}
        style={({ pressed }) => [styles.slot, pressed ? styles.pressed : null]}
      >
        <PortalMobileNavIcon color={color} name={item.icon ?? navIconFromId(item.id)} />
        <Text
          maxFontSizeMultiplier={1.2}
          numberOfLines={1}
          style={[styles.slotLabel, active ? styles.slotLabelActive : null, { color }]}
        >
          {item.label}
        </Text>
        {badge > 0 ? (
          <View style={styles.slotBadge}>
            <Text style={styles.slotBadgeText}>{String(badge)}</Text>
          </View>
        ) : null}
      </Pressable>
    );
  }

  return (
    <>
      <Animated.View
        accessibilityElementsHidden={hidden}
        importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}
        pointerEvents={hidden ? 'none' : 'box-none'}
        style={[
          styles.navHost,
          {
            opacity: hide.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] }),
            paddingBottom: Math.max(insets.bottom, 12),
            transform: [
              {
                translateY: hide.interpolate({
                  inputRange: [0, 1],
                  outputRange: [
                    0,
                    SLOT_HEIGHT + BAR_PADDING * 2 + Math.max(insets.bottom, 12) + 24,
                  ],
                }),
              },
            ],
          },
        ]}
      >
        <View
          onLayout={(event) => {
            setBarWidth(event.nativeEvent.layout.width);
          }}
          style={styles.barShadow}
        >
          <GlassGroup mode={mode} spacing={2} style={styles.bar}>
            <GlassFill borderRadius={BAR_RADIUS} mode={mode} />
            {activeSlot >= 0 && slotWidth > 0 ? (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.indicator,
                  { transform: [{ translateX: indicatorX }], width: slotWidth },
                ]}
              >
                <GlassFill
                  borderRadius={BAR_RADIUS - BAR_PADDING}
                  mode={mode}
                  tint={indicatorTintFor(variant)}
                />
              </Animated.View>
            ) : null}
            <View accessibilityRole="tablist" style={styles.slots}>
              {primaryItems.map(renderBottomNavItem)}
              {hasOverflow ? (
                <Pressable
                  accessibilityLabel="More navigation options"
                  accessibilityRole="button"
                  accessibilityState={{ expanded: drawerVisible, selected: overflowActive }}
                  onPress={openDrawer}
                  style={({ pressed }) => [styles.slot, pressed ? styles.pressed : null]}
                >
                  <PortalMobileNavIcon color={itemColor(overflowActive)} name="more" />
                  <Text
                    maxFontSizeMultiplier={1.2}
                    numberOfLines={1}
                    style={[
                      styles.slotLabel,
                      overflowActive ? styles.slotLabelActive : null,
                      { color: itemColor(overflowActive) },
                    ]}
                  >
                    More
                  </Text>
                  {overflowBadgeCount > 0 ? (
                    <View style={styles.slotBadge}>
                      <Text style={styles.slotBadgeText}>{String(overflowBadgeCount)}</Text>
                    </View>
                  ) : null}
                </Pressable>
              ) : null}
            </View>
          </GlassGroup>
        </View>
      </Animated.View>
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
              { paddingBottom: Math.max(insets.bottom, 12) + 8 + DRAWER_OVERSCAN },
              { transform: [{ translateY: drawerOffset }] },
            ]}
          >
            <GlassFill borderRadius={DRAWER_RADIUS} mode={mode} />
            <View style={styles.drawerHandle} />
            <Text accessibilityRole="header" style={styles.drawerTitle}>
              More
            </Text>
            <View style={styles.drawerList}>
              {overflowItems.map((item) => {
                const active = activeId === item.id;
                const badge = item.badge ?? 0;
                const color = active ? accent : C.navy;

                return (
                  <Pressable
                    accessibilityLabel={badgeLabel(item.label, badge)}
                    accessibilityRole="menuitem"
                    accessibilityState={{ selected: active }}
                    key={item.id}
                    onPress={() => {
                      closeDrawer();
                      select(item.id);
                    }}
                    style={({ pressed }) => [
                      styles.drawerItem,
                      active ? { backgroundColor: indicatorTintFor(variant) } : null,
                      pressed ? styles.drawerItemPressed : null,
                    ]}
                  >
                    <PortalMobileNavIcon color={color} name={item.icon ?? navIconFromId(item.id)} />
                    <Text style={[styles.drawerItemLabel, { color }]}>{item.label}</Text>
                    {badge > 0 ? (
                      <View style={[styles.drawerBadge, { backgroundColor: C.crimson }]}>
                        <Text style={styles.slotBadgeText}>{String(badge)}</Text>
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
    borderRadius: 13,
    height: 26,
    justifyContent: 'center',
    width: 26,
  },
  accountAvatarText: {
    color: C.surface,
    fontSize: 11,
    fontWeight: '700',
  },
  accountButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    minHeight: 40,
    paddingLeft: 7,
    paddingRight: 14,
  },
  accountButtonText: {
    ...typeRamp.subhead,
    color: C.navy,
    fontWeight: '600',
  },
  accountGlass: {
    borderColor: C.hairline,
    borderWidth: 1,
  },
  bar: {
    borderCurve: 'continuous',
    borderRadius: BAR_RADIUS,
    minHeight: SLOT_HEIGHT + BAR_PADDING * 2,
  },
  barShadow: {
    borderCurve: 'continuous',
    borderRadius: BAR_RADIUS,
    boxShadow: elevation.float,
  },
  brandGroup: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 12,
    minWidth: 200,
  },
  drawerBackdrop: {
    flex: 1,
  },
  drawerBadge: {
    alignItems: 'center',
    borderRadius: 10,
    justifyContent: 'center',
    minHeight: 20,
    minWidth: 20,
    paddingHorizontal: 6,
  },
  drawerHandle: {
    alignSelf: 'center',
    backgroundColor: C.hairline,
    borderRadius: 3,
    height: 5,
    marginBottom: 14,
    width: 40,
  },
  drawerItem: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: 14,
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  drawerItemLabel: {
    ...typeRamp.headline,
    flex: 1,
    fontWeight: '500',
  },
  drawerItemPressed: {
    backgroundColor: C.fillPressed,
  },
  drawerList: {
    gap: 4,
  },
  drawerPanel: {
    borderTopLeftRadius: DRAWER_RADIUS,
    borderTopRightRadius: DRAWER_RADIUS,
    marginBottom: -DRAWER_OVERSCAN,
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  drawerRoot: {
    backgroundColor: C.scrim,
    flex: 1,
    justifyContent: 'flex-end',
  },
  drawerTitle: {
    ...typeRamp.title3,
    color: C.navy,
    marginBottom: 8,
    paddingHorizontal: 14,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
    paddingBottom: 12,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  headerEyebrow: {
    ...typeRamp.caption,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  headerSubtitle: {
    ...typeRamp.footnote,
    color: C.textSecondary,
  },
  headerText: {
    flex: 1,
    gap: 1,
    minWidth: 0,
  },
  headerTitle: {
    ...typeRamp.headline,
    color: C.navy,
  },
  indicator: {
    borderCurve: 'continuous',
    borderRadius: BAR_RADIUS - BAR_PADDING,
    height: SLOT_HEIGHT,
    left: BAR_PADDING,
    position: 'absolute',
    top: BAR_PADDING,
  },
  logo: {
    height: 36,
    width: 36,
  },
  logoFrame: {
    alignItems: 'center',
    backgroundColor: C.surface,
    borderCurve: 'continuous',
    borderRadius: 13,
    boxShadow: elevation.card,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  navHost: {
    bottom: 0,
    left: 0,
    paddingHorizontal: 16,
    position: 'absolute',
    right: 0,
  },
  pressed: {
    opacity: 0.6,
  },
  slot: {
    alignItems: 'center',
    flex: 1,
    gap: 3,
    height: SLOT_HEIGHT,
    justifyContent: 'center',
    position: 'relative',
  },
  slotBadge: {
    alignItems: 'center',
    backgroundColor: C.crimson,
    borderColor: C.surface,
    borderRadius: 9,
    borderWidth: 1.5,
    justifyContent: 'center',
    left: '50%',
    marginLeft: 6,
    minHeight: 18,
    minWidth: 18,
    paddingHorizontal: 4,
    position: 'absolute',
    top: 3,
  },
  slotBadgeText: {
    color: C.surface,
    fontSize: 10,
    fontWeight: '700',
  },
  slotLabel: {
    fontSize: 10.5,
    fontWeight: '500',
    letterSpacing: 0.1,
    lineHeight: 13,
  },
  slotLabelActive: {
    fontWeight: '700',
  },
  slots: {
    flexDirection: 'row',
    padding: BAR_PADDING,
  },
});

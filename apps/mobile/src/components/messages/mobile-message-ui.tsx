import Feather from '@expo/vector-icons/Feather';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GlassSurface } from '../core/glass';
import { C } from '../core/mobile-theme';
import { avatarColour, initials, unreadLabel } from './mobile-message-utils';

export function Avatar({
  group = false,
  name,
  size = 44,
}: {
  group?: boolean;
  name: string;
  size?: number;
}) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.avatar,
        { backgroundColor: avatarColour(name), borderRadius: size / 2, height: size, width: size },
      ]}
    >
      {group ? (
        <Feather color={C.surface} name="users" size={size * 0.45} />
      ) : (
        <Text maxFontSizeMultiplier={1} style={[styles.avatarText, { fontSize: size * 0.38 }]}>
          {initials(name)}
        </Text>
      )}
    </View>
  );
}

/** Round glass back control, as in the iOS 26 navigation bar. */
export function GlassBackButton({
  accent,
  label,
  onPress,
  unread = 0,
}: {
  accent: string;
  label: string;
  onPress: () => void;
  unread?: number;
}) {
  return (
    <GlassSurface style={styles.backGlass}>
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="button"
        hitSlop={6}
        onPress={onPress}
        style={({ pressed }) => [styles.backPress, pressed ? styles.pressed : null]}
      >
        <Feather color={accent} name="chevron-left" size={26} />
      </Pressable>
      {unread > 0 ? (
        <View pointerEvents="none" style={[styles.backBadge, { backgroundColor: accent }]}>
          <Text style={styles.backBadgeText}>{unreadLabel(unread)}</Text>
        </View>
      ) : null}
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: C.surface,
    fontWeight: '600',
  },
  backBadge: {
    alignItems: 'center',
    borderColor: C.bg,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: 'center',
    minHeight: 20,
    minWidth: 20,
    paddingHorizontal: 4,
    position: 'absolute',
    right: -6,
    top: -6,
  },
  backBadgeText: {
    color: C.surface,
    fontSize: 11,
    fontWeight: '700',
  },
  backGlass: {
    height: 42,
    width: 42,
  },
  backPress: {
    alignItems: 'center',
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  pressed: {
    opacity: 0.6,
  },
});

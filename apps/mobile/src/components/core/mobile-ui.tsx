import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { C, elevation, radius, typeRamp } from './mobile-theme';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'navy' | 'blue';
type BadgeVariant = 'neutral' | 'success' | 'warning' | 'danger' | 'blue' | 'crimson';

interface MobileButtonProps {
  label: string;
  accessibilityLabel?: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  compact?: boolean;
}

interface CardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  style?: StyleProp<TextStyle>;
}

interface StatCardProps {
  label: string;
  value: string;
  accent?: string;
}

// Filled buttons carry the brand; everything else is a quiet tinted fill, as on iOS.
const buttonPalette: Record<
  ButtonVariant,
  { bg: string; pressed: string; fg: string; border: string }
> = {
  primary: { bg: C.crimson, pressed: '#661724', fg: C.surface, border: 'transparent' },
  secondary: { bg: C.fill, pressed: C.fillPressed, fg: C.navy, border: C.hairline },
  danger: { bg: C.dangerBg, pressed: '#FECACA', fg: C.danger, border: 'transparent' },
  success: { bg: C.successBg, pressed: '#BBF7D0', fg: C.success, border: 'transparent' },
  navy: { bg: C.navy, pressed: C.navyMid, fg: C.surface, border: 'transparent' },
  blue: { bg: C.blueLight, pressed: C.blueMid, fg: C.navy, border: 'transparent' },
};

const badgePalette: Record<BadgeVariant, { bg: string; fg: string; border: string }> = {
  neutral: { bg: C.fill, fg: C.textSecondary, border: 'transparent' },
  success: { bg: C.successBg, fg: C.success, border: 'transparent' },
  warning: { bg: C.warningBg, fg: C.warning, border: 'transparent' },
  danger: { bg: C.dangerBg, fg: C.danger, border: 'transparent' },
  blue: { bg: C.blueLight, fg: C.navy, border: 'transparent' },
  crimson: { bg: C.crimsonLight, fg: C.crimson, border: 'transparent' },
};

export function Card({ children, style }: CardProps) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <Text accessibilityRole="header" style={styles.sectionTitle}>
      {children}
    </Text>
  );
}

export function MutedText({ children }: { children: ReactNode }) {
  return <Text style={styles.muted}>{children}</Text>;
}

export function ErrorText({ children }: { children: ReactNode }) {
  return <Text style={styles.error}>{children}</Text>;
}

export function Badge({ children, variant = 'neutral', style }: BadgeProps) {
  const palette = badgePalette[variant];
  return (
    <Text
      style={[
        styles.badge,
        { backgroundColor: palette.bg, borderColor: palette.border, color: palette.fg },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function StatCard({ label, value, accent = C.blue }: StatCardProps) {
  return (
    <View style={styles.statCard}>
      <View style={styles.statHeader}>
        <View style={[styles.statDot, { backgroundColor: accent }]} />
        <Text
          adjustsFontSizeToFit
          minimumFontScale={0.75}
          numberOfLines={1}
          style={styles.statLabel}
        >
          {label}
        </Text>
      </View>
      <Text adjustsFontSizeToFit minimumFontScale={0.6} numberOfLines={1} style={styles.statValue}>
        {value}
      </Text>
    </View>
  );
}

export function MobileButton({
  label,
  accessibilityLabel,
  onPress,
  variant = 'primary',
  disabled = false,
  compact = false,
}: MobileButtonProps) {
  const palette = buttonPalette[variant];
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={compact ? 4 : 0}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        compact ? styles.compactButton : null,
        { backgroundColor: pressed ? palette.pressed : palette.bg, borderColor: palette.border },
        disabled ? styles.disabled : null,
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          compact ? styles.compactButtonText : null,
          { color: palette.fg },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

interface FieldProps {
  testID?: string;
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string | undefined;
  keyboardType?: 'default' | 'email-address' | 'numeric';
  secureTextEntry?: boolean;
  multiline?: boolean;
  disabled?: boolean;
}

export function Field({
  testID,
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  secureTextEntry = false,
  multiline = false,
  disabled = false,
}: FieldProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        testID={testID}
        accessibilityLabel={label}
        editable={!disabled}
        autoCapitalize="none"
        keyboardType={keyboardType}
        multiline={multiline}
        onBlur={() => {
          setFocused(false);
        }}
        onChangeText={onChangeText}
        onFocus={() => {
          setFocused(true);
        }}
        placeholder={placeholder}
        placeholderTextColor={C.textMuted}
        secureTextEntry={secureTextEntry}
        selectionColor={C.crimson}
        style={[
          styles.input,
          focused ? styles.inputFocused : null,
          multiline ? styles.multiline : null,
          disabled ? styles.disabled : null,
        ]}
        value={value}
      />
    </View>
  );
}

export function InlineSpinner({ label }: { label: string }) {
  return (
    <View style={styles.spinner}>
      <ActivityIndicator color={C.blue} />
      <MutedText>{label}</MutedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    ...typeRamp.caption,
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    borderWidth: 1,
    fontWeight: '600',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  button: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: radius.md,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  buttonText: {
    ...typeRamp.headline,
  },
  card: {
    backgroundColor: C.surface,
    borderCurve: 'continuous',
    borderRadius: radius.lg,
    boxShadow: elevation.card,
    gap: 12,
    padding: 16,
  },
  compactButton: {
    borderRadius: radius.sm,
    minHeight: 40,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  compactButtonText: {
    ...typeRamp.subhead,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.45,
  },
  error: {
    ...typeRamp.footnote,
    color: C.danger,
    fontWeight: '600',
  },
  field: {
    gap: 6,
  },
  input: {
    ...typeRamp.body,
    backgroundColor: C.surface,
    borderColor: C.border,
    borderCurve: 'continuous',
    borderRadius: radius.sm,
    borderWidth: 1,
    color: C.textPrimary,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  inputFocused: {
    borderColor: C.blue,
    boxShadow: '0 0 0 3px rgba(91,144,197,0.28)',
  },
  label: {
    ...typeRamp.footnote,
    color: C.textSecondary,
    fontWeight: '600',
  },
  multiline: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  muted: {
    ...typeRamp.footnote,
    color: C.textSecondary,
  },
  sectionTitle: {
    ...typeRamp.title3,
    color: C.navy,
  },
  spinner: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  statCard: {
    backgroundColor: C.surface,
    borderCurve: 'continuous',
    borderRadius: radius.lg,
    boxShadow: elevation.card,
    flex: 1,
    gap: 6,
    minWidth: 104,
    padding: 14,
  },
  statDot: {
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  statHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  statLabel: {
    ...typeRamp.caption,
    color: C.textSecondary,
    flexShrink: 1,
    fontWeight: '600',
  },
  statValue: {
    color: C.navy,
    fontSize: 28,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});

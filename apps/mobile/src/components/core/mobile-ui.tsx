import type { ReactNode } from 'react';
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
import { C } from './mobile-theme';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'navy' | 'blue';
type BadgeVariant = 'neutral' | 'success' | 'warning' | 'danger' | 'blue' | 'crimson';

interface MobileButtonProps {
  label: string;
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

const buttonPalette: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
  primary: { bg: C.crimson, fg: C.surface, border: C.crimson },
  secondary: { bg: C.surface, fg: C.navy, border: C.border },
  danger: { bg: C.dangerBg, fg: C.danger, border: C.dangerMid },
  success: { bg: C.successBg, fg: C.success, border: C.successMid },
  navy: { bg: C.navy, fg: C.surface, border: C.navy },
  blue: { bg: C.blueLight, fg: C.navy, border: C.blueMid },
};

const badgePalette: Record<BadgeVariant, { bg: string; fg: string; border: string }> = {
  neutral: { bg: C.bg, fg: C.textSecondary, border: C.border },
  success: { bg: C.successBg, fg: C.success, border: C.successMid },
  warning: { bg: C.warningBg, fg: C.warning, border: C.warningBg },
  danger: { bg: C.dangerBg, fg: C.danger, border: C.dangerMid },
  blue: { bg: C.blueLight, fg: C.navy, border: C.blueMid },
  crimson: { bg: C.crimsonLight, fg: C.crimson, border: C.crimsonLight },
};

export function Card({ children, style }: CardProps) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
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
    <View style={[styles.statCard, { borderTopColor: accent }]}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

export function MobileButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  compact = false,
}: MobileButtonProps) {
  const palette = buttonPalette[variant];
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.button,
        compact ? styles.compactButton : null,
        { backgroundColor: palette.bg, borderColor: palette.border },
        disabled ? styles.disabled : null,
      ]}
    >
      <Text style={[styles.buttonText, { color: palette.fg }]}>{label}</Text>
    </Pressable>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string | undefined;
  keyboardType?: 'default' | 'email-address' | 'numeric';
  secureTextEntry?: boolean;
  multiline?: boolean;
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  secureTextEntry = false,
  multiline = false,
}: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        autoCapitalize="none"
        keyboardType={keyboardType}
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.textMuted}
        secureTextEntry={secureTextEntry}
        style={[styles.input, multiline ? styles.multiline : null]}
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
    alignSelf: 'flex-start',
    borderRadius: 20,
    borderWidth: 1,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  button: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1.5,
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  buttonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  card: {
    backgroundColor: C.surface,
    borderColor: C.border,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
    padding: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  compactButton: {
    minHeight: 34,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  disabled: {
    opacity: 0.45,
  },
  error: {
    color: C.danger,
    fontSize: 12,
    fontWeight: '600',
  },
  field: {
    gap: 5,
  },
  input: {
    backgroundColor: C.surface,
    borderColor: C.border,
    borderRadius: 8,
    borderWidth: 1.5,
    color: C.textPrimary,
    fontSize: 13,
    minHeight: 42,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  label: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  multiline: {
    minHeight: 86,
    textAlignVertical: 'top',
  },
  muted: {
    color: C.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  sectionTitle: {
    color: C.navy,
    fontSize: 17,
    fontWeight: '800',
  },
  spinner: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  statCard: {
    backgroundColor: C.surface,
    borderColor: C.border,
    borderRadius: 12,
    borderTopWidth: 3,
    borderWidth: 1,
    flex: 1,
    minWidth: 104,
    padding: 14,
  },
  statLabel: {
    color: C.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  statValue: {
    color: C.navy,
    fontSize: 24,
    fontWeight: '800',
    marginTop: 4,
  },
});

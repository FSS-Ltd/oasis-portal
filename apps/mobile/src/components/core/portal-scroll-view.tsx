import { ScrollView, StyleSheet, type ScrollViewProps, type ViewStyle } from 'react-native';
import { FLOATING_NAV_CLEARANCE } from './mobile-theme';

/**
 * ScrollView for screens that sit above the floating tab bar. It adds the bar's clearance to the
 * bottom padding so the last item can always scroll clear of it, whatever padding the caller set.
 */
export function PortalScrollView({ contentContainerStyle, ...props }: ScrollViewProps) {
  // flatten returns undefined for an absent style, whatever its declared type says.
  const content = (StyleSheet.flatten(contentContainerStyle) as ViewStyle | undefined) ?? {};
  const base = [content.paddingBottom, content.paddingVertical, content.padding].find(
    (value): value is number => typeof value === 'number',
  );

  return (
    <ScrollView
      {...props}
      contentContainerStyle={[content, { paddingBottom: (base ?? 0) + FLOATING_NAV_CLEARANCE }]}
    />
  );
}

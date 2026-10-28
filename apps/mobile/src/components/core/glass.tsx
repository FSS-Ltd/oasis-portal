import { useEffect, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';
import {
  GlassContainer,
  GlassView,
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
} from 'expo-glass-effect';
import { C, elevation, radius } from './mobile-theme';

/**
 * The only module that knows about Liquid Glass. Glass is for the controls layer that floats above
 * content (tab bar, header controls, sheets). It is never used on cards, lists or forms.
 *
 *   native  iOS 26+ with the glass API: real UIGlassEffect
 *   blur    iOS below 26, and web: frosted BlurView
 *   solid   Android, and anyone who turned on Reduce Transparency: opaque surface
 */
export type GlassMode = 'native' | 'blur' | 'solid';

export function resolveGlassMode(input: {
  os: string;
  nativeGlass: boolean;
  reduceTransparency: boolean;
}): GlassMode {
  if (input.reduceTransparency) return 'solid';
  if (input.os === 'ios') return input.nativeGlass ? 'native' : 'blur';
  if (input.os === 'web') return 'blur';
  return 'solid';
}

let nativeGlassCache: boolean | undefined;

function nativeGlassAvailable(): boolean {
  if (nativeGlassCache === undefined) {
    try {
      // Both checks: some iOS 26 betas lack the API and would crash when rendering a GlassView.
      nativeGlassCache =
        Platform.OS === 'ios' && isGlassEffectAPIAvailable() && isLiquidGlassAvailable();
    } catch {
      nativeGlassCache = false;
    }
  }
  return nativeGlassCache;
}

// react-native-web implements only some of these, and its addEventListener can return nothing, so
// every capability is optional here and an absent one reads as "off".
type AccessibilityApi = Partial<typeof AccessibilityInfo>;

const accessibilityFlags = {
  reduceMotion: {
    event: 'reduceMotionChanged',
    read: (info: AccessibilityApi) => info.isReduceMotionEnabled?.(),
  },
  reduceTransparency: {
    event: 'reduceTransparencyChanged',
    read: (info: AccessibilityApi) => info.isReduceTransparencyEnabled?.(),
  },
} as const;

export function readAccessibilityFlag(
  info: AccessibilityApi,
  flag: keyof typeof accessibilityFlags,
): Promise<boolean> {
  return accessibilityFlags[flag].read(info) ?? Promise.resolve(false);
}

function useAccessibilityFlag(flag: keyof typeof accessibilityFlags): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let active = true;
    readAccessibilityFlag(AccessibilityInfo, flag)
      .then((value) => {
        if (active) setEnabled(value);
      })
      .catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener(
      accessibilityFlags[flag].event,
      setEnabled,
    ) as { remove: () => void } | undefined;
    return () => {
      active = false;
      subscription?.remove();
    };
  }, [flag]);

  return enabled;
}

export function useReduceMotion(): boolean {
  return useAccessibilityFlag('reduceMotion');
}

export function useGlassMode(): GlassMode {
  const reduceTransparency = useAccessibilityFlag('reduceTransparency');
  return resolveGlassMode({
    os: Platform.OS,
    nativeGlass: nativeGlassAvailable(),
    reduceTransparency,
  });
}

interface GlassFillProps {
  mode: GlassMode;
  borderRadius: number;
  tint?: string | undefined;
}

/** Absolute-fill glass background. Content is rendered by the caller, above it. */
export function GlassFill({ mode, borderRadius, tint }: GlassFillProps) {
  const shape: ViewStyle = { borderRadius, borderCurve: 'continuous', overflow: 'hidden' };

  if (mode === 'native') {
    return (
      <GlassView
        glassEffectStyle="regular"
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, shape]}
        {...(tint ? { tintColor: tint } : {})}
      />
    );
  }

  if (mode === 'blur') {
    return (
      <BlurView
        intensity={80}
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, shape, styles.edge]}
        tint="systemChromeMaterialLight"
      >
        {tint ? <View style={[StyleSheet.absoluteFill, { backgroundColor: tint }]} /> : null}
      </BlurView>
    );
  }

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, shape, styles.edge, styles.solid]}>
      {tint ? <View style={[StyleSheet.absoluteFill, { backgroundColor: tint }]} /> : null}
    </View>
  );
}

interface GlassSurfaceProps {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  borderRadius?: number;
  tint?: string | undefined;
  floating?: boolean;
}

export function GlassSurface({
  children,
  style,
  borderRadius = radius.pill,
  tint,
  floating = false,
}: GlassSurfaceProps) {
  const mode = useGlassMode();

  return (
    <View
      style={[
        { borderRadius, borderCurve: 'continuous' },
        floating ? { boxShadow: elevation.float } : null,
        style,
      ]}
    >
      <GlassFill borderRadius={borderRadius} mode={mode} tint={tint} />
      {children}
    </View>
  );
}

interface GlassGroupProps {
  children: ReactNode;
  mode: GlassMode;
  style?: StyleProp<ViewStyle>;
  spacing?: number;
}

/** Lets neighbouring glass layers merge and morph instead of stacking glass on glass. */
export function GlassGroup({ children, mode, style, spacing = 12 }: GlassGroupProps) {
  if (mode === 'native') {
    return (
      <GlassContainer spacing={spacing} style={style}>
        {children}
      </GlassContainer>
    );
  }

  return <View style={style}>{children}</View>;
}

const styles = StyleSheet.create({
  edge: {
    borderColor: 'rgba(255,255,255,0.55)',
    borderWidth: StyleSheet.hairlineWidth,
  },
  solid: {
    backgroundColor: C.surface,
    borderColor: C.hairline,
  },
});

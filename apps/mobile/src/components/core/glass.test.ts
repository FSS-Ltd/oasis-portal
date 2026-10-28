import { describe, expect, it, vi } from 'vitest';
import { readAccessibilityFlag, resolveGlassMode } from './glass';

vi.mock('react-native', () => ({
  AccessibilityInfo: {},
  Platform: { OS: 'ios' },
  StyleSheet: { absoluteFill: {}, create: <T>(styles: T) => styles, hairlineWidth: 1 },
  View: 'View',
}));
vi.mock('expo-blur', () => ({ BlurView: 'BlurView' }));
vi.mock('expo-glass-effect', () => ({
  GlassContainer: 'GlassContainer',
  GlassView: 'GlassView',
  isGlassEffectAPIAvailable: () => true,
  isLiquidGlassAvailable: () => true,
}));

describe('resolveGlassMode', () => {
  it('uses native glass on iOS when the system supports it', () => {
    expect(resolveGlassMode({ nativeGlass: true, os: 'ios', reduceTransparency: false })).toBe(
      'native',
    );
  });

  it('falls back to a blur on iOS without the glass API', () => {
    expect(resolveGlassMode({ nativeGlass: false, os: 'ios', reduceTransparency: false })).toBe(
      'blur',
    );
  });

  it('uses an opaque surface on Android, which has no glass idiom', () => {
    expect(resolveGlassMode({ nativeGlass: false, os: 'android', reduceTransparency: false })).toBe(
      'solid',
    );
  });

  it('frosts on web', () => {
    expect(resolveGlassMode({ nativeGlass: false, os: 'web', reduceTransparency: false })).toBe(
      'blur',
    );
  });

  it.each(['ios', 'android', 'web'])('goes opaque on %s when Reduce Transparency is on', (os) => {
    expect(resolveGlassMode({ nativeGlass: true, os, reduceTransparency: true })).toBe('solid');
  });
});

describe('readAccessibilityFlag', () => {
  it('reads the platform preference when it exists', async () => {
    await expect(
      readAccessibilityFlag(
        { isReduceTransparencyEnabled: () => Promise.resolve(true) },
        'reduceTransparency',
      ),
    ).resolves.toBe(true);
  });

  it('treats a platform without the API as off instead of throwing (react-native-web)', async () => {
    await expect(readAccessibilityFlag({}, 'reduceTransparency')).resolves.toBe(false);
    await expect(readAccessibilityFlag({}, 'reduceMotion')).resolves.toBe(false);
  });
});

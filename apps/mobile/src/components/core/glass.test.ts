import { describe, expect, it, vi } from 'vitest';
import { resolveGlassMode } from './glass';

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

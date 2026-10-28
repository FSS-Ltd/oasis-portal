import { createElement } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mobileTestRenderer } from '../../test-utils/mobile-test-renderer';

const auth = { isLoaded: false };
const hideAsync = vi.fn(() => Promise.resolve());

// Animations finish instantly; the test is about when the splash leaves, not how it looks.
vi.mock('react-native', () => {
  const node = () => ({ interpolate: node });
  const anim = { start: (cb?: () => void) => cb?.(), stop: () => {} };
  return {
    AccessibilityInfo: { isReduceMotionEnabled: () => Promise.resolve(false) },
    Animated: {
      add: node,
      loop: () => anim,
      multiply: node,
      parallel: () => anim,
      sequence: () => anim,
      stagger: () => anim,
      timing: () => anim,
      Value: class {
        interpolate = node;
      },
      View: 'Animated.View',
    },
    Easing: { cubic: 0, in: () => 0, inOut: () => 0, out: () => 0, quad: 0, sin: 0 },
    Image: 'Image',
    Platform: { OS: 'ios' },
    StyleSheet: { absoluteFillObject: {}, create: <T>(styles: T) => styles },
    View: 'View',
  };
});
vi.mock('@clerk/clerk-expo', () => ({ useAuth: () => auth }));
vi.mock('expo-splash-screen', () => ({
  hideAsync,
  preventAutoHideAsync: () => Promise.resolve(),
}));
vi.mock('../../../assets/splash-icon.png', () => ({ default: 1 }));

const { LaunchSplash } = await import('./launch-splash');

beforeEach(() => {
  vi.useFakeTimers();
  auth.isLoaded = false;
});
afterEach(() => vi.useRealTimers());

function revealCrest(renderer: ReturnType<typeof mobileTestRenderer.create>) {
  const image = renderer.root.find((n) => n.type === 'Image');
  (image.props as { onLoadEnd: () => void }).onLoadEnd();
}

it('holds the crest until auth is ready, then leaves', async () => {
  const renderer = mobileTestRenderer.create(createElement(LaunchSplash));
  try {
    await mobileTestRenderer.act(async () => {
      revealCrest(renderer);
      await Promise.resolve();
    });
    mobileTestRenderer.act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(renderer.toJSON()).not.toBeNull();

    auth.isLoaded = true;
    renderer.update(createElement(LaunchSplash));
    expect(renderer.toJSON()).toBeNull();
  } finally {
    renderer.unmount();
  }
});

it('leaves after the safety timeout even if auth never loads', () => {
  const renderer = mobileTestRenderer.create(createElement(LaunchSplash));
  try {
    mobileTestRenderer.act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(renderer.toJSON()).toBeNull();
  } finally {
    renderer.unmount();
  }
});

it('releases the native splash once the crest image has loaded', () => {
  const renderer = mobileTestRenderer.create(createElement(LaunchSplash));
  try {
    revealCrest(renderer);
    expect(hideAsync).toHaveBeenCalled();
  } finally {
    renderer.unmount();
  }
});

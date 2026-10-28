import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { mobileTestRenderer } from '../../test-utils/mobile-test-renderer';
import { FLOATING_NAV_CLEARANCE } from './mobile-theme';
import { PortalScrollView } from './portal-scroll-view';

type StyleRecord = Record<string, number>;

vi.mock('react-native', () => ({
  ScrollView: 'ScrollView',
  StyleSheet: {
    flatten: (style: unknown): unknown =>
      Array.isArray(style)
        ? style.reduce<StyleRecord>((merged, item) => ({ ...merged, ...(item as StyleRecord) }), {})
        : style,
  },
}));

function bottomPaddingFor(contentContainerStyle?: StyleRecord): number | undefined {
  const renderer = mobileTestRenderer.create(
    createElement(PortalScrollView, contentContainerStyle ? { contentContainerStyle } : {}),
  );
  try {
    const scroll = renderer.root.find((node) => node.type === 'ScrollView');
    const { contentContainerStyle: styles } = scroll.props as {
      contentContainerStyle: StyleRecord[];
    };
    return styles.reduce<StyleRecord>((merged, item) => ({ ...merged, ...item }), {}).paddingBottom;
  } finally {
    renderer.unmount();
  }
}

describe('PortalScrollView', () => {
  it('adds the floating bar clearance when the caller sets no padding', () => {
    expect(bottomPaddingFor()).toBe(FLOATING_NAV_CLEARANCE);
  });

  it('adds clearance on top of uniform padding', () => {
    expect(bottomPaddingFor({ padding: 16 })).toBe(16 + FLOATING_NAV_CLEARANCE);
  });

  it('adds clearance on top of vertical padding', () => {
    expect(bottomPaddingFor({ paddingVertical: 12 })).toBe(12 + FLOATING_NAV_CLEARANCE);
  });

  it('prefers an explicit bottom padding over the broader values', () => {
    expect(bottomPaddingFor({ padding: 16, paddingBottom: 4 })).toBe(4 + FLOATING_NAV_CLEARANCE);
  });
});

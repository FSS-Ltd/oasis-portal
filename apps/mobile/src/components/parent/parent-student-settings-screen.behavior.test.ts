import { createElement, type ReactElement } from 'react';
import { expect, it, vi } from 'vitest';
import { mobileTestRenderer, type MobileTestRenderer } from '../../test-utils/mobile-test-renderer';

vi.mock('react-native', () => ({
  Alert: { alert: vi.fn() },
  Image: 'Image',
  Pressable: 'Pressable',
  RefreshControl: 'RefreshControl',
  ScrollView: 'ScrollView',
  StyleSheet: { create: <T>(styles: T) => styles, flatten: <T>(style: T) => style },
  Text: 'Text',
  View: 'View',
}));
vi.mock('../core/account-deletion-card', () => ({ AccountDeletionCard: () => null }));

vi.mock('../core/mobile-ui', () => ({
  Badge: 'Badge',
  Card: 'Card',
  ErrorText: 'ErrorText',
  Field: 'Field',
  InlineSpinner: 'InlineSpinner',
  MutedText: 'MutedText',
  MobileButton: 'MobileButton',
  SectionTitle: 'SectionTitle',
}));
function render(element: ReactElement): MobileTestRenderer {
  let renderer: MobileTestRenderer | undefined;
  mobileTestRenderer.act(() => {
    renderer = mobileTestRenderer.create(element);
  });
  if (!renderer) throw new Error('Expected the form to render');
  return renderer;
}
function control(renderer: MobileTestRenderer, type: string, label: string) {
  const node = renderer.root.find(
    (node) =>
      node.type === type &&
      typeof node.props === 'object' &&
      node.props !== null &&
      'label' in node.props &&
      node.props.label === label,
  );
  // The renderer's host props are deliberately unknown; narrow only the controls used here.
  return node.props as {
    value: string;
    onChangeText: (value: string) => void;
    onPress: () => void;
  };
}

import { ParentStudentSettingsScreen } from './parent-student-settings-screen';
const mocks = vi.hoisted(() => ({
  child: {
    studentId: 'child-one',
    fullName: 'Child',
    yearGroup: 'Year1',
    accountLinked: true,
    parentControlAllowed: true,
    loginHandle: 'child',
    studentCanManagePassword: false,
    dailyUsageLimitMinutes: 30,
    offLimitWeekdays: [1],
    parentAccountLocked: false,
    parentLockReason: null,
    headAcademicLocked: false,
    headAcademicLockReason: null,
    parentMeritShopBlocked: false,
    paceStatusVisible: true,
    childIconPhotoUrl: null,
    effectiveLock: { locked: false, primarySource: null },
  },
}));
vi.mock('../../lib/trpc', () => {
  const mutation = { useMutation: () => ({ isPending: false, error: null, mutateAsync: vi.fn() }) };
  return {
    api: {
      useUtils: () => ({}),
      studentSettings: {
        listLinkedChildren: {
          useQuery: () => ({
            data: [mocks.child],
            isLoading: false,
            isFetching: false,
            error: null,
            refetch: vi.fn(),
          }),
        },
        ...Object.fromEntries(
          [
            'setUsageLimits',
            'createChildLogin',
            'setLoginHandle',
            'setChildPassword',
            'setPasswordControl',
            'prepareChildIconPhotoUpload',
            'updateChildIconPhoto',
            'setParentLock',
            'setMeritShopBlock',
            'setPaceStatusVisibility',
          ].map((name) => [name, mutation]),
        ),
      },
    },
  };
});
it('preserves the daily-limit draft when remote weekday arrays refresh and resets on child change', () => {
  const element = () =>
    createElement(ParentStudentSettingsScreen, { onRefresh: () => Promise.resolve() });
  const renderer = render(element());
  try {
    mobileTestRenderer.act(() => {
      control(renderer, 'Field', 'Daily limit minutes').onChangeText('55');
    });
    mocks.child = { ...mocks.child, dailyUsageLimitMinutes: 90, offLimitWeekdays: [1, 2] };
    mobileTestRenderer.act(() => {
      renderer.update(element());
    });
    expect(control(renderer, 'Field', 'Daily limit minutes').value).toBe('55');
    mocks.child = { ...mocks.child, studentId: 'child-two', dailyUsageLimitMinutes: 120 };
    mobileTestRenderer.act(() => {
      renderer.update(element());
    });
    expect(control(renderer, 'Field', 'Daily limit minutes').value).toBe('120');
  } finally {
    mobileTestRenderer.act(() => {
      renderer.unmount();
    });
  }
});

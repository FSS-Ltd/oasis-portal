import { createElement, type ReactElement } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
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
vi.mock('../core/push-notifications-card', () => ({ PushNotificationsCard: () => null }));

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

import { ParentProfileRegistrationScreen } from './parent-profile-registration-screen';
const mocks = vi.hoisted(() => ({
  invalidate: vi.fn(() => Promise.resolve()),
  profile: {
    id: 'parent-one',
    fullName: 'Parent',
    email: 'parent@example.test',
    phone: '111',
    address: 'Original',
    active: true,
    children: [],
    emailNotificationPreferences: { enabled: true, optedOutCategories: [] as string[] },
  },
  registration: {
    registrationId: 'registration-one',
    homeAddress: 'Home',
    agreement: { guardianName: 'Guardian', agreementDate: new Date('2026-01-01') },
    students: [],
    emergencyContacts: [],
  },
}));
vi.mock('../../lib/trpc', () => {
  const query = (data: () => unknown) => ({
    useQuery: () => ({
      data: data(),
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    }),
  });
  const mutation = { useMutation: () => ({ isPending: false, error: null, mutateAsync: vi.fn() }) };
  return {
    api: {
      useUtils: () => ({
        profile: { me: { invalidate: mocks.invalidate } },
        registration: { mine: { invalidate: mocks.invalidate } },
      }),
      profile: {
        me: query(() => mocks.profile),
        spouseInviteStatus: query(() => null),
        updateMe: mutation,
        updateEmailNotificationPreferences: mutation,
        inviteSpouse: mutation,
      },
      registration: {
        mine: query(() => mocks.registration),
        status: query(() => ({ linkedChildrenCount: 0 })),
        listMyStudentParentLinkRequests: query(() => []),
        updateMine: mutation,
        addSiblings: mutation,
        confirmStudentParentLinkRequest: mutation,
        rejectStudentParentLinkRequest: mutation,
      },
    },
  };
});
beforeEach(() => {
  mocks.invalidate.mockReset();
  mocks.invalidate.mockImplementation(() => Promise.resolve());
  mocks.profile.phone = '111';
  mocks.profile.address = 'Original';
  mocks.profile.id = 'parent-one';
  mocks.profile.emailNotificationPreferences = { enabled: true, optedOutCategories: [] };
  mocks.registration.homeAddress = 'Home';
});
function textContent(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(textContent).join('');
  if (
    typeof value === 'object' &&
    value !== null &&
    'props' in value &&
    typeof value.props === 'object' &&
    value.props !== null &&
    'children' in value.props
  )
    return textContent(value.props.children);
  return '';
}
it('preserves notification preference edits across profile refreshes', () => {
  const element = () =>
    createElement(ParentProfileRegistrationScreen, { onRefresh: () => Promise.resolve() });
  const renderer = render(element());
  const toggle = (label: string) =>
    renderer.root.find(
      (node) =>
        node.type === 'Pressable' &&
        typeof node.props === 'object' &&
        node.props !== null &&
        'children' in node.props &&
        textContent(node.props.children).includes(label),
    ).props as {
      onPress: () => void;
      accessibilityState: { checked: boolean };
    };
  try {
    mobileTestRenderer.act(() => {
      toggle('Direct messages').onPress();
    });
    mobileTestRenderer.act(() => {
      toggle('Receive optional email notifications').onPress();
    });
    mocks.profile = {
      ...mocks.profile,
      emailNotificationPreferences: { enabled: true, optedOutCategories: ['Notice'] },
    };
    mobileTestRenderer.act(() => {
      renderer.update(element());
    });
    expect(toggle('Direct messages').accessibilityState.checked).toBe(false);
    expect(toggle('Receive optional email notifications').accessibilityState.checked).toBe(false);
  } finally {
    mobileTestRenderer.act(() => {
      renderer.unmount();
    });
  }
});
it('preserves edits entered while a successful save refresh is pending', async () => {
  let finishRefresh: () => void = () => {
    throw new Error('Refresh has not started');
  };
  mocks.invalidate.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finishRefresh = resolve;
      }),
  );
  const renderer = render(
    createElement(ParentProfileRegistrationScreen, { onRefresh: () => Promise.resolve() }),
  );
  try {
    mobileTestRenderer.act(() => {
      control(renderer, 'Field', 'Phone').onChangeText('submitted');
    });
    await mobileTestRenderer.act(async () => {
      control(renderer, 'MobileButton', 'Save profile').onPress();
      await Promise.resolve();
    });
    expect(mocks.invalidate).toHaveBeenCalled();
    mobileTestRenderer.act(() => {
      control(renderer, 'Field', 'Phone').onChangeText('newer draft');
    });
    await mobileTestRenderer.act(async () => {
      finishRefresh();
      await Promise.resolve();
    });
    expect(control(renderer, 'Field', 'Phone').value).toBe('newer draft');
  } finally {
    mobileTestRenderer.act(() => {
      renderer.unmount();
    });
  }
});
it('preserves edited profile and registration fields while refreshing untouched fields', () => {
  const element = () =>
    createElement(ParentProfileRegistrationScreen, { onRefresh: () => Promise.resolve() });
  const renderer = render(element());
  try {
    mobileTestRenderer.act(() => {
      control(renderer, 'Field', 'Phone').onChangeText('draft-phone');
      control(renderer, 'Field', 'Home address').onChangeText('Draft home');
    });
    mocks.profile = { ...mocks.profile, phone: 'remote-phone', address: 'Remote address' };
    mocks.registration = { ...mocks.registration, homeAddress: 'Remote home' };
    mobileTestRenderer.act(() => {
      renderer.update(element());
    });
    expect(control(renderer, 'Field', 'Phone').value).toBe('draft-phone');
    expect(control(renderer, 'Field', 'Address').value).toBe('Remote address');
    expect(control(renderer, 'Field', 'Home address').value).toBe('Draft home');
    mocks.profile = { ...mocks.profile, id: 'parent-two', phone: '222' };
    mobileTestRenderer.act(() => {
      renderer.update(element());
    });
    expect(control(renderer, 'Field', 'Phone').value).toBe('222');
  } finally {
    mobileTestRenderer.act(() => {
      renderer.unmount();
    });
  }
});

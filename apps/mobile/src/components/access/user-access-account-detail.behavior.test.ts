import { createElement } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { mobileTestRenderer, type MobileTestRenderer } from '../../test-utils/mobile-test-renderer';
import type { AccessAccount } from './user-access-model';
import { UserAccessAccountDetail } from './user-access-account-detail';
import { MobileButton } from '../core/mobile-ui';

const mocks = vi.hoisted(() => ({
  invalidate: vi.fn(() => Promise.resolve()),
  profile: { isPending: false, error: null, mutate: vi.fn() },
  onSuccess: undefined as (() => Promise<void>) | undefined,
}));
vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  Pressable: 'Pressable',
  StyleSheet: { create: <T>(styles: T) => styles },
  Text: 'Text',
  TextInput: 'TextInput',
  View: 'View',
}));
vi.mock('../../lib/trpc', () => {
  const mutation = { useMutation: () => ({ isPending: false, error: null, mutate: vi.fn() }) };
  return {
    api: {
      useUtils: () => ({ admin: { listUserAccounts: { invalidate: mocks.invalidate } } }),
      admin: {
        updateUserAccountProfile: {
          useMutation: (options: { onSuccess: () => Promise<void> }) => {
            mocks.onSuccess = options.onSuccess;
            return mocks.profile;
          },
        },
        updateUserAccountStatus: mutation,
        updateUserRole: mutation,
        updateUserTags: mutation,
      },
    },
  };
});
const initialAccount: AccessAccount = {
  id: 'account-one',
  fullName: 'Original Name',
  email: null,
  phone: '111',
  address: 'Original address',
  role: 'Parent',
  tags: [],
  active: true,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};
interface InputProps {
  value: string;
  editable: boolean;
  onChangeText: (value: string) => void;
}
function renderPanel() {
  const element = (account: AccessAccount) =>
    createElement(UserAccessAccountDetail, { account, currentUserId: 'operator' });
  let renderer: MobileTestRenderer | undefined;
  mobileTestRenderer.act(() => {
    renderer = mobileTestRenderer.create(element(initialAccount));
  });
  if (!renderer) throw new Error('Expected account detail to render');
  const rendered = renderer;
  function input(label: string): InputProps {
    const node = rendered.root.find(
      (node) =>
        node.type === 'TextInput' &&
        typeof node.props === 'object' &&
        node.props !== null &&
        'accessibilityLabel' in node.props &&
        node.props.accessibilityLabel === label,
    );
    // The real shared Field renders these TextInput props; retain its native behavior.
    return node.props as InputProps;
  }
  return {
    input,
    save() {
      const button = rendered.root.find(
        (node) =>
          node.type === MobileButton &&
          typeof node.props === 'object' &&
          node.props !== null &&
          'label' in node.props &&
          node.props.label === 'Save profile',
      ).props;
      if (
        typeof button !== 'object' ||
        button === null ||
        !('onPress' in button) ||
        typeof button.onPress !== 'function'
      )
        throw new Error('Save button must be actionable');
      // This is the real MobileButton callback; the renderer exposes props as unknown.
      const onPress = button.onPress as () => void;
      mobileTestRenderer.act(() => {
        onPress();
      });
    },
    update(account: AccessAccount) {
      mobileTestRenderer.act(() => {
        rendered.update(element(account));
      });
    },
    change(label: string, value: string) {
      mobileTestRenderer.act(() => {
        input(label).onChangeText(value);
      });
    },
    unmount() {
      mobileTestRenderer.act(() => {
        rendered.unmount();
      });
    },
  };
}
beforeEach(() => {
  mocks.profile.isPending = false;
  mocks.profile.mutate.mockClear();
  mocks.invalidate.mockReset();
  mocks.invalidate.mockResolvedValue(undefined);
});

it('preserves edited fields through snapshots and refreshes untouched or reverted fields', () => {
  const panel = renderPanel();
  try {
    panel.change('Full name', 'Unsaved name');
    panel.change('Address', '');
    panel.update({
      ...initialAccount,
      phone: '222',
      address: 'Server address',
      tags: ['club-lead'],
      active: false,
    });
    expect(panel.input('Full name').value).toBe('Unsaved name');
    expect(panel.input('Phone').value).toBe('222');
    expect(panel.input('Address').value).toBe('');
    panel.save();
    expect(mocks.profile.mutate).toHaveBeenCalledWith({
      userId: initialAccount.id,
      fullName: 'Unsaved name',
      phone: '222',
      address: '',
    });
    panel.change('Full name', initialAccount.fullName);
    panel.update({ ...initialAccount, fullName: 'New server name' });
    expect(panel.input('Full name').value).toBe('New server name');
  } finally {
    panel.unmount();
  }
});

it('resets drafts when selecting another account', () => {
  const panel = renderPanel();
  try {
    panel.change('Full name', 'Unsaved name');
    panel.update({ ...initialAccount, id: 'account-two', fullName: 'Second account' });
    expect(panel.input('Full name').value).toBe('Second account');
    panel.save();
    expect(mocks.profile.mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'account-two',
        fullName: 'Second account',
      }),
    );
  } finally {
    panel.unmount();
  }
});

it('adopts fresh data after save and prevents editing while the save is pending', async () => {
  const panel = renderPanel();
  try {
    panel.change('Full name', 'Saved name ');
    mocks.profile.isPending = true;
    panel.update(initialAccount);
    expect(panel.input('Full name').editable).toBe(false);
    mocks.invalidate.mockImplementation(() => {
      panel.update({ ...initialAccount, fullName: 'Saved name' });
      return Promise.resolve();
    });
    await mobileTestRenderer.act(async () => {
      await mocks.onSuccess?.();
    });
    expect(panel.input('Full name').value).toBe('Saved name');
    panel.update({ ...initialAccount, fullName: 'Later server name' });
    expect(panel.input('Full name').value).toBe('Later server name');
  } finally {
    panel.unmount();
  }
});

it('does not discard a new account draft when a previous account save finishes', async () => {
  const panel = renderPanel();
  try {
    const finishFirstSave = mocks.onSuccess;
    panel.update({ ...initialAccount, id: 'account-two', fullName: 'Second account' });
    panel.change('Full name', 'Second draft');
    await mobileTestRenderer.act(async () => {
      await finishFirstSave?.();
    });
    expect(panel.input('Full name').value).toBe('Second draft');
  } finally {
    panel.unmount();
  }
});

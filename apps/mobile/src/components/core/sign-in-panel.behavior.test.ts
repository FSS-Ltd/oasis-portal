import { createElement } from 'react';
import { expect, it, vi } from 'vitest';
import { mobileTestRenderer } from '../../test-utils/mobile-test-renderer';
import { SignInPanel } from './sign-in-panel';

vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  Image: 'Image',
  Linking: { openURL: vi.fn() },
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  StyleSheet: { create: <T>(styles: T) => styles },
  Text: 'Text',
  TextInput: 'TextInput',
  View: 'View',
}));
vi.mock('@clerk/clerk-expo', () => ({
  useSignIn: () => ({ isLoaded: true, signIn: {}, setActive: vi.fn() }),
  useSSO: () => ({ startSSOFlow: vi.fn() }),
}));
vi.mock('expo-web-browser', () => ({ WebBrowserResultType: {} }));

it('exposes unique sign-in input IDs while preserving accessible labels', () => {
  const renderer = mobileTestRenderer.create(createElement(SignInPanel));
  try {
    for (const [id, label] of [
      ['sign-in-email', 'Email or username'],
      ['sign-in-password', 'Password'],
    ]) {
      const input = renderer.root.find((node) => {
        const props = node.props;
        return (
          node.type === 'TextInput' &&
          typeof props === 'object' &&
          props !== null &&
          'testID' in props &&
          props.testID === id
        );
      });
      expect(input.props).toEqual(expect.objectContaining({ accessibilityLabel: label }));
    }
  } finally {
    renderer.unmount();
  }
});

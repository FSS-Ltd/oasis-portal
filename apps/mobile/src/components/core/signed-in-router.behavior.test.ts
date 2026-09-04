import { createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mobileTestRenderer, type MobileTestRenderer } from '../../test-utils/mobile-test-renderer';
import { SignedInRouter } from './signed-in-router';

interface HealthData {
  accountAccessState: string;
  linkedChildCount: number;
  parentVolunteerAccess: string;
  user: { id: string; role: string };
}

interface HealthQuery {
  data: HealthData | undefined;
  error: Error;
  isError: boolean;
  isFetching: boolean;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

interface RenderedParentPortalProps {
  onRefreshEntitlement: () => Promise<void>;
}

function hasWarningText(props: unknown): props is { children: string } {
  return (
    typeof props === 'object' &&
    props !== null &&
    'children' in props &&
    props.children === 'We could not refresh your access. Showing your last available information.'
  );
}

function hasText(props: unknown, text: string): props is { children: string } {
  return typeof props === 'object' && props !== null && 'children' in props && props.children === text;
}

function hasRetryAccessRefresh(props: unknown): props is { onPress: () => void } {
  return (
    typeof props === 'object' &&
    props !== null &&
    'accessibilityLabel' in props &&
    props.accessibilityLabel === 'Retry access refresh' &&
    'onPress' in props &&
    typeof props.onPress === 'function'
  );
}

const mocks = vi.hoisted(() => {
  const refetch = vi.fn(() => Promise.resolve(undefined));
  const listener = { current: undefined as ((state: string) => void) | undefined };
  const remove = vi.fn();
  const parentPortal = vi.fn<(props: RenderedParentPortalProps) => null>(() => null);
  const query: { current: HealthQuery } = {
    current: {
      data: {
        accountAccessState: 'active',
        linkedChildCount: 1,
        parentVolunteerAccess: 'parent',
        user: { id: 'parent_1', role: 'Parent' },
      },
      error: new Error('network unavailable'),
      isError: false,
      isFetching: false,
      isLoading: false,
      refetch,
    },
  };

  return {
    appState: {
      addEventListener: vi.fn((_event: string, callback: (state: string) => void) => {
        listener.current = callback;
        return { remove };
      }),
      currentState: 'active',
    },
    listener,
    parentPortal,
    query,
    refetch,
    remove,
  };
});

vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  AppState: mocks.appState,
  Pressable: 'Pressable',
  StyleSheet: { create: <T,>(styles: T) => styles },
  Text: 'Text',
  View: 'View',
}));

vi.mock('../../lib/trpc', () => ({
  api: { health: { me: { useQuery: () => mocks.query.current } } },
}));

vi.mock('../parent/parent-portal-screen', () => ({ ParentPortalScreen: mocks.parentPortal }));
vi.mock('../staff/staff-portal-screen', () => ({ StaffPortalScreen: () => null }));
vi.mock('../student/student-portal-screen', () => ({ StudentPortalScreen: () => null }));
vi.mock('../support/technical-support-portal-screen', () => ({
  TechnicalSupportPortalScreen: () => null,
}));
vi.mock('./mobile-access-revoked-screen', () => ({ MobileAccessRevokedScreen: () => null }));

function renderRouter(): MobileTestRenderer {
  let renderer: MobileTestRenderer | undefined;
  mobileTestRenderer.act(() => {
    renderer = mobileTestRenderer.create(createElement(SignedInRouter));
  });
  if (!renderer) throw new Error('Expected the signed-in router to render');
  return renderer;
}

function rerenderRouter(renderer: MobileTestRenderer) {
  mobileTestRenderer.act(() => {
    renderer.update(createElement(SignedInRouter));
  });
}

describe('signed-in router entitlement refresh', () => {
  beforeEach(() => {
    mocks.appState.addEventListener.mockClear();
    mocks.appState.currentState = 'active';
    mocks.listener.current = undefined;
    mocks.parentPortal.mockClear();
    mocks.refetch.mockClear();
    mocks.remove.mockClear();
    mocks.query.current = {
      data: {
        accountAccessState: 'active',
        linkedChildCount: 1,
        parentVolunteerAccess: 'parent',
        user: { id: 'parent_1', role: 'Parent' },
      },
      error: new Error('network unavailable'),
      isError: false,
      isFetching: false,
      isLoading: false,
      refetch: mocks.refetch,
    };
  });

  it('refetches only when the app resumes and removes the AppState subscription on unmount', () => {
    const renderer = renderRouter();
    const listener = mocks.listener.current;
    if (!listener) throw new Error('Expected AppState listener registration');

    mobileTestRenderer.act(() => {
      listener('active');
      listener('background');
      listener('active');
      listener('inactive');
      listener('active');
    });

    expect(mocks.refetch).toHaveBeenCalledTimes(2);
    mobileTestRenderer.act(() => {
      renderer.unmount();
    });
    expect(mocks.remove).toHaveBeenCalledTimes(1);
  });

  it('keeps a cached portal mounted with a retryable refresh warning after pull-to-refresh fails', async () => {
    const renderer = renderRouter();
    expect(mocks.parentPortal).toHaveBeenCalledTimes(1);
    const parentPortalProps = mocks.parentPortal.mock.lastCall?.[0];
    if (!parentPortalProps) throw new Error('Expected Parent portal entitlement refresh behavior');

    await parentPortalProps.onRefreshEntitlement();
    expect(mocks.refetch).toHaveBeenCalledTimes(1);

    mocks.query.current = {
      ...mocks.query.current,
      isFetching: true,
    };
    rerenderRouter(renderer);
    expect(mocks.parentPortal).toHaveBeenCalledTimes(2);

    mocks.query.current = {
      ...mocks.query.current,
      isError: true,
      isFetching: false,
    };
    rerenderRouter(renderer);

    expect(mocks.parentPortal).toHaveBeenCalledTimes(3);
    expect(
      renderer.root.find((node) => node.type === 'Text' && hasWarningText(node.props)),
    ).toBeDefined();
    const warningRetry = renderer.root.find(
      (node) => node.type === 'Pressable' && hasRetryAccessRefresh(node.props),
    );
    const warningRetryProps = warningRetry.props as { onPress: () => void };

    mobileTestRenderer.act(() => {
      warningRetryProps.onPress();
    });
    expect(mocks.refetch).toHaveBeenCalledTimes(2);
  });

  it('keeps the initial-load failure retryable when there is no cached session', () => {
    const sensitiveError = 'Internal database host: production.example.test';
    mocks.query.current = {
      ...mocks.query.current,
      data: undefined,
      error: new Error(sensitiveError),
      isError: true,
    };
    const renderer = renderRouter();
    const retry = renderer.root.find((node) => node.type === 'Pressable');
    const retryProps = retry.props as { onPress: () => void };

    expect(mocks.parentPortal).not.toHaveBeenCalled();
    expect(
      renderer.root.find(
        (node) =>
          node.type === 'Text' &&
          hasText(node.props, 'We could not refresh your access. Please try again.'),
      ),
    ).toBeDefined();
    expect(() =>
      renderer.root.find((node) => node.type === 'Text' && hasText(node.props, sensitiveError)),
    ).toThrow();
    mobileTestRenderer.act(() => {
      retryProps.onPress();
    });
    expect(mocks.refetch).toHaveBeenCalledTimes(1);
  });
});

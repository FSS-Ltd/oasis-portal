import { createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mobileTestRenderer, type MobileTestRenderer } from '../../test-utils/mobile-test-renderer';
import { ParentPortalScreen } from './parent-portal-screen';

interface ParentHomeScreenProps {
  onRefresh: () => Promise<void>;
}

interface ParentNavigationProps {
  activeId: string;
  items: Array<{ id: string }>;
  onSelect: (route: string) => void;
}

const mocks = vi.hoisted(() => {
  const entitlementRefetch = vi.fn(() => Promise.resolve(undefined));
  const queryRefetch = vi.fn(() => Promise.resolve(undefined));
  const parentHome = vi.fn<(props: ParentHomeScreenProps) => null>(() => null);
  const parentVolunteer = vi.fn(() => null);
  const bottomNav = vi.fn<(props: ParentNavigationProps) => null>(() => null);

  return {
    bottomNav,
    parentHome,
    parentVolunteer,
    queryResult: {
      data: undefined,
      error: null,
      isFetching: false,
      isLoading: false,
      refetch: queryRefetch,
    },
    entitlementRefetch,
    queryRefetch,
    volunteerQueryOptions: [] as Array<{ enabled?: boolean }>,
  };
});

vi.mock('react-native', () => ({
  RefreshControl: 'RefreshControl',
  ScrollView: 'ScrollView',
  StyleSheet: { create: <T,>(styles: T) => styles },
  View: 'View',
}));
vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
vi.mock('@clerk/clerk-expo', () => ({ useClerk: () => ({ signOut: vi.fn() }) }));
vi.mock('@oasis/domain', () => ({
  canUseParentVolunteerNavigation: (access: 'parent' | 'staff' | null) => access !== null,
}));
vi.mock('../../lib/trpc', () => ({
  api: {
    calendar: { listForParents: { useQuery: () => mocks.queryResult } },
    childLog: { parentDashboard: { useQuery: () => mocks.queryResult } },
    club: {
      linkedChildSignupContext: { useQuery: () => mocks.queryResult },
      myClubNotices: { useQuery: () => mocks.queryResult },
    },
    invoice: { listParent: { useQuery: () => mocks.queryResult } },
    meritLedger: { balances: { useQuery: () => mocks.queryResult } },
    message: {
      listConversations: { useQuery: () => mocks.queryResult },
      listRecipients: { useQuery: () => mocks.queryResult },
    },
    notice: { listForParents: { useQuery: () => mocks.queryResult } },
    permissionSlip: { listParent: { useQuery: () => mocks.queryResult } },
    profile: { me: { useQuery: () => mocks.queryResult } },
    registration: { status: { useQuery: () => mocks.queryResult } },
    rota: {
      parentVolunteerSlots: {
        useQuery: (_input: undefined, options: { enabled?: boolean }) => {
          mocks.volunteerQueryOptions.push(options);
          return mocks.queryResult;
        },
      },
    },
    shop: {
      listItems: { useQuery: () => mocks.queryResult },
      listReservations: { useQuery: () => mocks.queryResult },
    },
    useUtils: () => ({ message: { listConversations: { invalidate: mocks.queryRefetch } } }),
  },
}));
vi.mock('../core/portal-mobile-shell', () => ({
  PortalMobileBottomNav: mocks.bottomNav,
  PortalMobileHeader: () => null,
}));
vi.mock('../core/mobile-ui', () => ({
  Card: () => null,
  ErrorText: () => null,
  MutedText: () => null,
  SectionTitle: () => null,
}));
vi.mock('./parent-home-utils', () => ({ selectedParentChild: () => undefined }));
vi.mock('./parent-home-screen', () => ({ ParentHomeScreen: mocks.parentHome }));
vi.mock('./parent-volunteer-screen', () => ({ ParentVolunteerScreen: mocks.parentVolunteer }));
vi.mock('./parent-calendar-screen', () => ({ ParentCalendarScreen: () => null }));
vi.mock('./parent-child-detail-screen', () => ({ ParentChildDetailScreen: () => null }));
vi.mock('./parent-clubs-screen', () => ({ ParentClubsScreen: () => null }));
vi.mock('./parent-fees-invoices-screen', () => ({ ParentFeesInvoicesScreen: () => null }));
vi.mock('./parent-incident-reports-screen', () => ({ ParentIncidentReportsScreen: () => null }));
vi.mock('./parent-messages-screen', () => ({ ParentMessagesScreen: () => null }));
vi.mock('./parent-notices-screen', () => ({ ParentNoticesScreen: () => null }));
vi.mock('./parent-permission-slips-screen', () => ({ ParentPermissionSlipsScreen: () => null }));
vi.mock('./parent-profile-registration-screen', () => ({ ParentProfileRegistrationScreen: () => null }));
vi.mock('./parent-reports-ranks-screen', () => ({ ParentReportsRanksScreen: () => null }));
vi.mock('./parent-shop-reservations-screen', () => ({ ParentShopReservationsScreen: () => null }));
vi.mock('./parent-student-settings-screen', () => ({ ParentStudentSettingsScreen: () => null }));

const user = { id: 'parent_1', requires2fa: false, role: 'Parent' as const, tags: [] };

function renderPortal(parentVolunteerAccess: 'parent' | 'staff' | null): MobileTestRenderer {
  let renderer: MobileTestRenderer | undefined;
  mobileTestRenderer.act(() => {
    renderer = mobileTestRenderer.create(
      createElement(ParentPortalScreen, {
        onRefreshEntitlement: mocks.entitlementRefetch,
        parentVolunteerAccess,
        user,
      }),
    );
  });
  if (!renderer) throw new Error('Expected the parent portal to render');
  return renderer;
}

function updateEntitlement(
  renderer: MobileTestRenderer,
  parentVolunteerAccess: 'parent' | 'staff' | null,
) {
  mobileTestRenderer.act(() => {
    renderer.update(
      createElement(ParentPortalScreen, {
        onRefreshEntitlement: mocks.entitlementRefetch,
        parentVolunteerAccess,
        user,
      }),
    );
  });
}

describe('parent volunteer entitlement behavior', () => {
  beforeEach(() => {
    mocks.bottomNav.mockClear();
    mocks.parentHome.mockClear();
    mocks.parentVolunteer.mockClear();
    mocks.entitlementRefetch.mockClear();
    mocks.queryRefetch.mockClear();
    mocks.volunteerQueryOptions.length = 0;
  });

  it('refreshes the owning health entitlement through the Parent portal refresh action', async () => {
    renderPortal('staff');
    const homeProps = mocks.parentHome.mock.lastCall?.[0];
    if (!homeProps) throw new Error('Expected the Parent Home screen to receive refresh behavior');

    await mobileTestRenderer.act(async () => {
      await homeProps.onRefresh();
    });

    expect(mocks.entitlementRefetch).toHaveBeenCalledTimes(1);
    expect(mocks.queryRefetch).toHaveBeenCalledTimes(3);
  });

  it('removes and exits Volunteer when refreshed entitlement is lost', () => {
    const renderer = renderPortal('staff');
    const navigation = mocks.bottomNav.mock.lastCall?.[0];
    if (!navigation) throw new Error('Expected parent navigation');

    mobileTestRenderer.act(() => {
      navigation.onSelect('volunteer');
    });
    expect(mocks.parentVolunteer).toHaveBeenCalledTimes(1);
    expect(mocks.volunteerQueryOptions.at(-1)).toMatchObject({ enabled: true });

    updateEntitlement(renderer, null);

    expect(mocks.parentVolunteer).toHaveBeenCalledTimes(1);
    expect(mocks.volunteerQueryOptions.at(-1)).toMatchObject({ enabled: false });
    const postLossNavigation = mocks.bottomNav.mock.lastCall?.[0];
    if (!postLossNavigation) throw new Error('Expected updated parent navigation');
    expect(postLossNavigation.activeId).toBe('home');
    expect(postLossNavigation.items.some((item) => item.id === 'volunteer')).toBe(false);
  });
});

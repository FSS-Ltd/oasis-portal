import { createElement, type ReactElement } from 'react';
import { expect, it, vi } from 'vitest';
import { mobileTestRenderer, type MobileTestRenderer } from '../../test-utils/mobile-test-renderer';

vi.mock('react-native', () => ({
  Alert: { alert: vi.fn() },
  Image: 'Image',
  Pressable: 'Pressable',
  RefreshControl: 'RefreshControl',
  ScrollView: 'ScrollView',
  StyleSheet: { create: <T>(styles: T) => styles },
  Text: 'Text',
  View: 'View',
}));
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

function first<T>(rows: readonly T[]): T {
  const row = rows[0];
  if (!row) throw new Error('Expected a fixture row');
  return row;
}
import { StaffRotaScreen } from './staff-rota-screen';
const mocks = vi.hoisted(() => ({
  monthlySuccess: undefined as
    | ((
        rows: { id: string; date: string; startMinute: number; endMinute: number }[],
      ) => Promise<void>)
    | undefined,
  invalidateMonth: vi.fn(() => Promise.resolve()),
  weekly: [{ id: 'weekly-one', dayOfWeek: 1, startMinute: 540, endMinute: 600 }],
  monthly: [{ id: 'monthly-one', date: '2026-10-26', startMinute: 540, endMinute: 600 }],
}));
vi.mock('@clerk/clerk-expo', () => ({ useClerk: () => ({ signOut: vi.fn() }) }));
vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
vi.mock('../core/portal-mobile-shell', () => ({ PortalMobileHeader: 'PortalMobileHeader' }));
vi.mock('./staff-rota-common', () => ({ TabButton: 'TabButton' }));
vi.mock('./staff-rota-availability-panel', () => ({ AvailabilityPanel: 'AvailabilityPanel' }));
vi.mock('./staff-rota-rota-panel', () => ({ RotaPanel: 'RotaPanel' }));
vi.mock('./staff-rota-swap-panel', () => ({ SwapPanel: 'SwapPanel' }));
vi.mock('../../lib/trpc', () => {
  const query = (data: () => unknown) => ({
    useQuery: () => ({
      data: data(),
      error: null,
      isLoading: false,
      isFetching: false,
      refetch: vi.fn(),
    }),
  });
  const mutation = { useMutation: () => ({ isPending: false, error: null, mutate: vi.fn() }) };
  return {
    api: {
      useUtils: () => ({
        rota: { myMonthlyAvailability: { invalidate: mocks.invalidateMonth } },
        staffHome: { summary: { invalidate: () => Promise.resolve() } },
      }),
      rota: {
        ...Object.fromEntries(
          [
            'myRota',
            'myCombinedSchedule',
            'parentVolunteerSchedule',
            'swapCandidates',
            'mySwapRequests',
          ].map((name) => [name, query(() => [])]),
        ),
        myAvailability: query(() => mocks.weekly),
        myMonthlyAvailability: query(() => mocks.monthly),
        setMyAvailability: mutation,
        setMyMonthlyAvailability: {
          useMutation: (options: { onSuccess: NonNullable<typeof mocks.monthlySuccess> }) => {
            mocks.monthlySuccess = options.onSuccess;
            return { isPending: false, error: null, mutate: vi.fn() };
          },
        },
        requestSwap: mutation,
      },
    },
  };
});
it('preserves availability drafts on refresh and ignores a save response from the previous month', async () => {
  const element = () =>
    createElement(StaffRotaScreen, { onBack: () => undefined, user: undefined });
  const renderer = render(element());
  function panel() {
    return renderer.root.find((node) => node.type === 'AvailabilityPanel').props as {
      weeklyDraft: typeof mocks.weekly;
      monthlyDraft: typeof mocks.monthly;
      onChangeWeekly: (rows: typeof mocks.weekly) => void;
      onChangeMonthly: (rows: typeof mocks.monthly) => void;
      onChangeMonth: (month: string) => void;
      onSaveMonthly: () => void;
    };
  }
  try {
    mobileTestRenderer.act(() => {
      control(renderer, 'TabButton', 'Availability').onPress();
    });
    mobileTestRenderer.act(() => {
      panel().onChangeWeekly([{ ...first(mocks.weekly), startMinute: 660 }]);
      panel().onChangeMonthly([{ ...first(mocks.monthly), startMinute: 720 }]);
    });
    const submittedMonth = renderer.root.find((node) => node.type === 'AvailabilityPanel')
      .props as { month: string };
    mobileTestRenderer.act(() => {
      panel().onSaveMonthly();
    });
    mocks.weekly = [{ ...first(mocks.weekly), startMinute: 800 }];
    mocks.monthly = [{ ...first(mocks.monthly), startMinute: 850 }];
    mobileTestRenderer.act(() => {
      renderer.update(element());
    });
    expect(panel().weeklyDraft[0]?.startMinute).toBe(660);
    expect(panel().monthlyDraft[0]?.startMinute).toBe(720);
    const nextMonth = submittedMonth.month === '2026-12' ? '2027-01' : '2026-12';
    mobileTestRenderer.act(() => {
      panel().onChangeMonth(nextMonth);
    });
    expect(panel().monthlyDraft[0]?.startMinute).toBe(850);
    mobileTestRenderer.act(() => {
      panel().onChangeMonthly([
        { id: 'new-month', date: `${nextMonth}-01`, startMinute: 900, endMinute: 960 },
      ]);
    });
    await mobileTestRenderer.act(async () => {
      await mocks.monthlySuccess?.([
        { id: 'saved-old-month', date: '2026-10-26', startMinute: 720, endMinute: 780 },
      ]);
    });
    expect(panel().monthlyDraft[0]?.startMinute).toBe(900);
    expect(mocks.invalidateMonth).toHaveBeenCalledWith({ month: submittedMonth.month });
  } finally {
    mobileTestRenderer.act(() => {
      renderer.unmount();
    });
  }
});

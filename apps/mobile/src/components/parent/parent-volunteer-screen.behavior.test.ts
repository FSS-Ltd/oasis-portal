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
import { ParentVolunteerScreen } from './parent-volunteer-screen';
type Slots = NonNullable<Parameters<typeof ParentVolunteerScreen>[0]['slots']>;
const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  onSuccess: undefined as
    | ((data: unknown, variables: { termId: string }) => Promise<void>)
    | undefined,
}));
vi.mock('../../lib/trpc', () => ({
  api: {
    useUtils: () => ({ rota: { parentVolunteerSlots: { invalidate: () => Promise.resolve() } } }),
    rota: {
      setMyParentVolunteerDays: {
        useMutation: (options: { onSuccess: typeof mocks.onSuccess }) => {
          mocks.onSuccess = options.onSuccess;
          return { isPending: false, error: null, mutate: mocks.save };
        },
      },
    },
  },
}));
function slots(scope: 'parent' | 'staff', id = 'term-one'): Slots {
  const day = {
    date: '2026-10-26',
    status: 'Available' as const,
    selected: false,
    spacesRemaining: 3,
  };
  const term = {
    id,
    label: 'Term',
    from: '2026-10-01',
    to: '2026-12-31',
    lunchAndClubs: {
      primary: { dailyCapacity: 3, days: [day] },
      secondary: { dailyCapacity: 2, days: [day] },
    },
    centreVolunteer: { dailyCapacity: 3, days: [day] },
  };
  return scope === 'parent' ? { scope, terms: [term] } : { scope, terms: [term] };
}
for (const scope of ['parent', 'staff'] as const) {
  it(
    'preserves ' + scope + ' volunteer selections on same-term refresh and clears on term switch',
    async () => {
      let data = slots(scope);
      const element = () =>
        createElement(ParentVolunteerScreen, { slots: data, error: null, loading: false });
      const renderer = render(element());
      function dayButton() {
        return renderer.root.find(
          (node) =>
            node.type === 'Pressable' &&
            typeof node.props === 'object' &&
            node.props !== null &&
            'accessibilityLabel' in node.props &&
            typeof node.props.accessibilityLabel === 'string' &&
            node.props.accessibilityLabel.includes('26 Oct') &&
            node.props.accessibilityLabel.startsWith(scope === 'parent' ? 'Mon' : 'Primary'),
        ).props as { onPress: () => void; accessibilityState: { selected: boolean } };
      }
      try {
        mobileTestRenderer.act(() => {
          dayButton().onPress();
        });
        expect(dayButton().accessibilityState.selected).toBe(true);
        data = slots(scope);
        mobileTestRenderer.act(() => {
          renderer.update(element());
        });
        expect(dayButton().accessibilityState.selected).toBe(true);
        data = slots(scope, 'term-two');
        mobileTestRenderer.act(() => {
          renderer.update(element());
        });
        expect(dayButton().accessibilityState.selected).toBe(false);
        mobileTestRenderer.act(() => {
          dayButton().onPress();
        });
        await mobileTestRenderer.act(async () => {
          await mocks.onSuccess?.(undefined, { termId: 'term-one' });
        });
        data = slots(scope, 'term-two');
        mobileTestRenderer.act(() => {
          renderer.update(element());
        });
        expect(dayButton().accessibilityState.selected).toBe(true);
      } finally {
        mobileTestRenderer.act(() => {
          renderer.unmount();
        });
      }
    },
  );
}

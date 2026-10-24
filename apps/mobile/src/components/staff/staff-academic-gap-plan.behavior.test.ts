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

import { StaffAcademicGapPlan } from './staff-academic-gap-plan';
const mocks = vi.hoisted(() => ({
  data: {
    currentPaceNumber: 1010,
    completedPaceNumbers: [] as number[],
    plans: [
      {
        id: 'plan-one',
        status: 'Active',
        reviewRequired: false,
        version: 1,
        jumpToPaceNumber: 1040,
        items: [{ paceNumber: 1001, removed: false, completed: false }],
      },
    ],
  },
  update: vi.fn(),
  onSuccess: undefined as
    | ((data: unknown, variables: { planId: string }) => Promise<void>)
    | undefined,
  onError: undefined as ((error: { message: string; data: { code: string } }) => void) | undefined,
}));
vi.mock('@oasis/domain', () => ({ PACE_CATALOGUE: [1001, 1002, 1003, 1040, 1050, 1060] }));
vi.mock('../../lib/trpc', () => {
  const mutation = { useMutation: () => ({ isPending: false, error: null, mutate: vi.fn() }) };
  return {
    api: {
      useUtils: () => {
        const invalidation = { invalidate: () => Promise.resolve() };
        return {
          pace: { forStudent: invalidation, parentCurrent: invalidation },
          academicInventory: { summary: invalidation },
          childLog: {
            drillThrough: invalidation,
            snapshot: invalidation,
            centreSnapshot: invalidation,
            parentDashboard: invalidation,
          },
        };
      },
      academicInventory: {
        gapPlansForAssignment: {
          useQuery: () => ({
            data: mocks.data,
            isLoading: false,
            isError: false,
            isFetching: false,
            refetch: () => Promise.resolve({ data: mocks.data }),
          }),
        },
        createGapPlan: mutation,
        cancelGapPlan: mutation,
        reviewGapPlan: mutation,
        updateGapPlan: {
          useMutation: (options: {
            onError: typeof mocks.onError;
            onSuccess: typeof mocks.onSuccess;
          }) => {
            mocks.onSuccess = options.onSuccess;
            mocks.onError = options.onError;
            return { isPending: false, error: null, mutate: mocks.update };
          },
        },
      },
    },
  };
});
it('preserves dirty gap PACEs and the original optimistic version until explicit conflict refresh', async () => {
  const element = () =>
    createElement(StaffAcademicGapPlan, { studentId: 'student-one', subjectId: 'subject-one' });
  const renderer = render(element());
  try {
    mobileTestRenderer.act(() => {
      control(renderer, 'Field', 'Jump to PACE').onChangeText('1050');
      control(renderer, 'Field', 'Range from').onChangeText('1002');
      control(renderer, 'Field', 'Range to').onChangeText('1002');
    });
    mobileTestRenderer.act(() => {
      control(renderer, 'MobileButton', 'Add Range').onPress();
    });
    const previousPlan = mocks.data.plans[0];
    if (!previousPlan) throw new Error('Expected the active fixture plan');
    mocks.data = {
      ...mocks.data,
      plans: [{ ...previousPlan, version: 2, jumpToPaceNumber: 1060 }],
    };
    mobileTestRenderer.act(() => {
      renderer.update(element());
    });
    expect(control(renderer, 'Field', 'Jump to PACE').value).toBe('1050');
    mobileTestRenderer.act(() => {
      control(renderer, 'MobileButton', 'Save Changes').onPress();
    });
    expect(mocks.update).toHaveBeenLastCalledWith({
      planId: 'plan-one',
      expectedVersion: 1,
      remainingPaceNumbers: [1001, 1002],
      jumpToPaceNumber: 1050,
    });
    mobileTestRenderer.act(() =>
      mocks.onError?.({ message: 'Changed remotely', data: { code: 'CONFLICT' } }),
    );
    await mobileTestRenderer.act(async () => {
      control(renderer, 'MobileButton', 'Refresh latest plan').onPress();
      await Promise.resolve();
    });
    expect(control(renderer, 'Field', 'Jump to PACE').value).toBe('1060');
    mobileTestRenderer.act(() => {
      control(renderer, 'MobileButton', 'Save Changes').onPress();
    });
    expect(mocks.update).toHaveBeenLastCalledWith(expect.objectContaining({ expectedVersion: 2 }));
    mocks.data = {
      ...mocks.data,
      plans: [{ ...previousPlan, version: 2, jumpToPaceNumber: 1060, id: 'plan-two' }],
    };
    mobileTestRenderer.act(() => {
      renderer.update(element());
    });
    mobileTestRenderer.act(() => {
      control(renderer, 'Field', 'Jump to PACE').onChangeText('1050');
    });
    await mobileTestRenderer.act(async () => {
      await mocks.onSuccess?.(undefined, { planId: 'plan-one' });
    });
    mocks.data = { ...mocks.data };
    mobileTestRenderer.act(() => {
      renderer.update(element());
    });
    expect(control(renderer, 'Field', 'Jump to PACE').value).toBe('1050');
  } finally {
    mobileTestRenderer.act(() => {
      renderer.unmount();
    });
  }
});

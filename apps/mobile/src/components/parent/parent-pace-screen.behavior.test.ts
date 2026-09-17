import { createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mobileTestRenderer, type MobileTestRenderer } from '../../test-utils/mobile-test-renderer';
import { type ParentDashboardChild } from './parent-home-utils';
import { ParentPaceScreen } from './parent-pace-screen';

interface QueryState {
  data: unknown;
  error: Error | null;
  isFetching: boolean;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

interface PressableProps {
  accessibilityLabel?: string;
  onPress?: () => void;
}

function hasText(props: unknown, text: string): props is { children: string } {
  return typeof props === 'object' && props !== null && 'children' in props && props.children === text;
}

function hasPressableLabel(props: unknown, label: string): props is PressableProps {
  return (
    typeof props === 'object' &&
    props !== null &&
    'accessibilityLabel' in props &&
    props.accessibilityLabel === label &&
    'onPress' in props &&
    typeof props.onPress === 'function'
  );
}

const mocks = vi.hoisted(() => {
  const refetch = vi.fn(() => Promise.resolve(undefined));
  const current: QueryState = {
    data: undefined,
    error: null,
    isFetching: false,
    isLoading: false,
    refetch,
  };
  const history: QueryState = {
    data: undefined,
    error: null,
    isFetching: false,
    isLoading: false,
    refetch,
  };
  return {
    current,
    history,
    historyInputs: [] as Array<{
      page: number;
      pageSize: number;
      period: { startYear: number; type: 'AcademicYear' } | { term: string; type: 'Term' };
      studentId: string;
    }>,
    refetch,
  };
});

vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  Modal: 'Modal',
  Pressable: 'Pressable',
  RefreshControl: 'RefreshControl',
  ScrollView: 'ScrollView',
  StyleSheet: { create: <T,>(styles: T) => styles },
  Text: 'Text',
  View: 'View',
}));

vi.mock('../../lib/trpc', () => ({
  api: {
    pace: {
      parentCurrent: { useQuery: () => mocks.current },
      parentHistory: {
        useQuery: (input: (typeof mocks.historyInputs)[number]) => {
          mocks.historyInputs.push(input);
          return mocks.history;
        },
      },
    },
  },
}));

const child: ParentDashboardChild = {
  attendance: [],
  behaviour: [],
  metrics: {
    attendanceRate: null,
    attendedDays: 0,
    meritBalances: {
      Given: 0,
      Investment: 0,
      Saving: 0,
      ShopReserved: 0,
      Spend: 0,
      TithePaid: 0,
    },
    pacesCompletedThisAcademicYear: 0,
    presentDays: 0,
    recordedAttendanceDays: 0,
    totalMerits: 0,
  },
  notes: [],
  pace: [],
  student: {
    active: true,
    enrolmentDate: '2026-01-01',
    fullName: 'Jamie Learner',
    id: 'student_1',
    subjects: [],
    yearGroup: 'Year 6',
  },
  todayStatus: { date: '2026-09-17', kind: 'unmarked', label: 'No mark' },
};

function renderScreen(selectedChild: ParentDashboardChild | null = child): MobileTestRenderer {
  let renderer: MobileTestRenderer | undefined;
  mobileTestRenderer.act(() => {
    renderer = mobileTestRenderer.create(
      createElement(ParentPaceScreen, {
        children: selectedChild ? [selectedChild] : [],
        onRefresh: mocks.refetch,
        onSelectChild: vi.fn(),
        selectedChild,
      }),
    );
  });
  if (!renderer) throw new Error('Expected the PACE screen to render');
  return renderer;
}

function press(renderer: MobileTestRenderer, label: string): void {
  const button = renderer.root.find(
    (node) => node.type === 'Pressable' && hasPressableLabel(node.props, label),
  );
  const props = button.props as PressableProps;
  if (!props.onPress) throw new Error(`Expected ${label} to be pressable`);
  mobileTestRenderer.act(() => {
    props.onPress?.();
  });
}

describe('parent PACE screen behavior', () => {
  beforeEach(() => {
    mocks.current.data = {
      subjects: [{ currentPaceNumber: 1029, subjectCode: 'ENG', subjectName: 'English' }],
    };
    mocks.current.error = null;
    mocks.current.isFetching = false;
    mocks.current.isLoading = false;
    mocks.history.data = {
      page: 1,
      pageSize: 20,
      rows: [
        {
          completedAt: new Date('2026-06-20T00:00:00.000Z'),
          id: 'pace_1',
          paceNumber: 1029,
          result: 'Passed',
          score: 100,
          subjectCode: 'ENG',
          subjectName: 'English',
          testType: 'SelfTest',
        },
      ],
      totalPages: 2,
      totalRows: 21,
    };
    mocks.history.error = null;
    mocks.history.isFetching = false;
    mocks.history.isLoading = false;
    mocks.historyInputs.length = 0;
    mocks.refetch.mockClear();
  });

  it('shows the no-linked-child state', () => {
    const renderer = renderScreen(null);

    expect(
      renderer.root.find((node) => node.type === 'Text' && hasText(node.props, 'No linked child')),
    ).toBeDefined();
  });

  it('shows current PACE loading, error, and empty states', () => {
    mocks.current.isLoading = true;
    const renderer = renderScreen();
    expect(
      renderer.root.find(
        (node) => node.type === 'Text' && hasText(node.props, 'Loading current PACE subjects'),
      ),
    ).toBeDefined();

    mocks.current.isLoading = false;
    mocks.current.error = new Error('PACE service unavailable');
    mobileTestRenderer.act(() => {
      renderer.update(
        createElement(ParentPaceScreen, {
          children: [child],
          onRefresh: mocks.refetch,
          onSelectChild: vi.fn(),
          selectedChild: child,
        }),
      );
    });
    expect(
      renderer.root.find(
        (node) => node.type === 'Text' && hasText(node.props, 'PACE service unavailable'),
      ),
    ).toBeDefined();

    mocks.current.error = null;
    mocks.current.data = { subjects: [] };
    mobileTestRenderer.act(() => {
      renderer.update(
        createElement(ParentPaceScreen, {
          children: [child],
          onRefresh: mocks.refetch,
          onSelectChild: vi.fn(),
          selectedChild: child,
        }),
      );
    });
    expect(
      renderer.root.find(
        (node) => node.type === 'Text' && hasText(node.props, 'No active PACE subjects are assigned.'),
      ),
    ).toBeDefined();
  });

  it('resets history pagination when the selected period changes', () => {
    const renderer = renderScreen();

    press(renderer, 'History');
    expect(mocks.historyInputs.at(-1)).toMatchObject({ page: 1, pageSize: 20 });

    press(renderer, 'Next PACE history page');
    expect(mocks.historyInputs.at(-1)).toMatchObject({ page: 2 });

    press(renderer, 'Choose academic year');
    press(renderer, '2025/26 Academic Year');
    expect(mocks.historyInputs.at(-1)).toMatchObject({
      page: 1,
      period: { startYear: 2025, type: 'AcademicYear' },
    });
  });
});

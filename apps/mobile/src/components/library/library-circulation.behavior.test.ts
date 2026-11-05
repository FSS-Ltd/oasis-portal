import { createElement } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { mobileTestRenderer } from '../../test-utils/mobile-test-renderer';
import { LibraryStudentHistory } from './library-student-history';
import { LibraryLoanRecords } from './library-loan-records';

const mocks = vi.hoisted(() => ({
  history: vi.fn(),
  loans: vi.fn(),
  returnLoan: vi.fn(),
  invalidate: vi.fn(),
}));
vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  Pressable: 'Pressable',
  Text: 'Text',
  TextInput: 'TextInput',
  View: 'View',
  StyleSheet: { create: <T>(styles: T) => styles },
}));
vi.mock('../../lib/trpc', () => ({
  api: {
    library: {
      borrowerHistoryPage: { useQuery: mocks.history },
      circulationPage: { useQuery: mocks.loans },
      checkin: { useMutation: () => ({ isPending: false, error: null, mutate: mocks.returnLoan }) },
    },
    useUtils: () => ({ library: { invalidate: mocks.invalidate } }),
  },
}));
afterEach(() => vi.clearAllMocks());

it('loads history only when a student accordion opens, with the selected student ID', () => {
  mocks.history.mockReturnValue({
    data: {
      items: [{ id: 'child-jane', name: 'Jane', yearGroup: 'Year 6', active: true, totalLoans: 4 }],
      nextPage: null,
    },
    isLoading: false,
    isFetching: false,
  });
  mocks.loans.mockReturnValue({
    data: { items: [], nextPage: null },
    isLoading: false,
    isFetching: false,
  });
  const renderer = mobileTestRenderer.create(createElement(LibraryStudentHistory));
  expect(mocks.loans).not.toHaveBeenCalled();
  const summary = renderer.root.find(
    (node) =>
      node.type === 'Pressable' &&
      String((node.props as { accessibilityLabel?: string }).accessibilityLabel).includes(
        'expand history',
      ),
  );
  mobileTestRenderer.act(() => {
    (summary.props as { onPress: () => void }).onPress();
  });
  expect(mocks.loans).toHaveBeenLastCalledWith({
    status: 'All',
    studentId: 'child-jane',
    bookId: undefined,
    page: 1,
    search: '',
  });
  renderer.unmount();
});

it('returns the chosen child’s exact loan when the same title has multiple borrowers', () => {
  mocks.loans.mockReturnValue({
    data: {
      items: ['Jane', 'Amos'].map((name, i) => ({
        id: `loan-${String(i)}`,
        student: { id: `child-${String(i)}`, name, yearGroup: 'Year 6' },
        book: { barcode: '123', title: 'Shared title', author: 'Author' },
        checkedOutAt: new Date('2026-11-01T12:00:00Z'),
        dueOn: new Date('2026-11-12T00:00:00Z'),
        returnedAt: null,
        status: 'Checked out',
      })),
      nextPage: null,
    },
    isLoading: false,
    isFetching: false,
  });
  const renderer = mobileTestRenderer.create(createElement(LibraryLoanRecords, { status: 'Open' }));
  const action = renderer.root.find(
    (node) =>
      node.type === 'Pressable' &&
      (node.props as { accessibilityLabel?: string }).accessibilityLabel ===
        'Mark Shared title returned for Amos',
  );
  mobileTestRenderer.act(() => {
    (action.props as { onPress: () => void }).onPress();
  });
  expect(mocks.returnLoan).toHaveBeenCalledWith(
    { barcode: '123', loanId: 'loan-1' },
    expect.any(Object),
  );
  renderer.unmount();
});

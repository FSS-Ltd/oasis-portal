import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { mobileTestRenderer, type MobileTestInstance } from '../../test-utils/mobile-test-renderer';
import { InventoryOrderList } from './staff-academic-inventory-order-list';

type Props = Parameters<typeof InventoryOrderList>[0];
type Order = Props['orders'][number];
let fixtureOrders: Order[] = [];

vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  StyleSheet: { create: <T>(styles: T) => styles },
  Text: 'Text',
  View: 'View',
}));
vi.mock('../core/mobile-ui', () => ({
  Badge: 'Badge',
  Card: 'Card',
  Field: 'Field',
  MobileButton: 'MobileButton',
  MutedText: 'MutedText',
}));
vi.mock('../../lib/trpc', () => ({
  api: {
    academicInventory: {
      ordersForStudent: {
        useQuery: ({
          studentId,
          status,
          page,
          pageSize,
        }: {
          studentId: string;
          status: string;
          page: number;
          pageSize: number;
        }) => {
          const matching = fixtureOrders.filter(
            (order) =>
              order.studentId === studentId &&
              (status === 'Outstanding' ? order.status !== 'Delivered' : order.status === status),
          );
          return {
            data: {
              rows: matching.slice((page - 1) * pageSize, page * pageSize),
              totalRows: matching.length,
            },
            isLoading: false,
            error: null,
          };
        },
      },
    },
  },
}));

function order(id: string, status: Order['status']): Order {
  const now = new Date('2026-10-13T09:00:00Z');
  return {
    id,
    studentId: 'student_1',
    subjectId: 'subject_1',
    paceNumber: 1013 + Number(id.slice(-1)),
    status,
    orderedAt: now,
    inTransitAt: status === 'Ordered' ? null : now,
    deliveredAt: status === 'Delivered' ? now : null,
    createdById: 'head_1',
    createdAt: now,
    updatedAt: now,
  };
}

function control(root: MobileTestInstance, label: string): MobileTestInstance {
  return root.find(
    (node) =>
      typeof node.props === 'object' &&
      node.props !== null &&
      'accessibilityLabel' in node.props &&
      node.props.accessibilityLabel === label,
  );
}

function button(root: MobileTestInstance, label: string): MobileTestInstance {
  return root.find(
    (node) =>
      node.type === 'MobileButton' &&
      typeof node.props === 'object' &&
      node.props !== null &&
      'label' in node.props &&
      node.props.label === label,
  );
}

function render(pending = false, orderRows?: Order[]) {
  fixtureOrders = orderRows ?? [
    order('order_1', 'Ordered'),
    order('order_2', 'InTransit'),
    order('order_3', 'Delivered'),
  ];
  const onSelectionChange = vi.fn<(ids: string[]) => void>();
  const props: Props = {
    onAdvance: vi.fn(),
    onSelectionChange,
    orders: fixtureOrders,
    pending,
    selectedOrderIds: [],
    students: [
      {
        id: 'student_1',
        fullName: 'Ada Student',
        subjects: [
          {
            id: 'assignment_1',
            studentId: 'student_1',
            subjectId: 'subject_1',
            currentPaceNumber: 1013,
            subject: { id: 'subject_1', code: 'MA', name: 'Maths', active: true },
          },
        ],
      },
    ],
    summary: {
      orderCountsByStudent: (['Ordered', 'InTransit', 'Delivered'] as const).map((status) => ({
        studentId: 'student_1',
        status,
        _count: { _all: fixtureOrders.filter((row) => row.status === status).length },
      })),
    },
  };
  const renderer = mobileTestRenderer.create(createElement(InventoryOrderList, props));
  return { onSelectionChange, props, renderer };
}

describe('InventoryOrderList', () => {
  it('starts collapsed and selects eligible orders across statuses', () => {
    const { onSelectionChange, renderer } = render();
    expect(() => control(renderer.root, 'Select visible orders')).toThrow();
    mobileTestRenderer.act(() => {
      (
        button(renderer.root, 'Select all 2 matching orders').props as { onPress: () => void }
      ).onPress();
    });
    expect(onSelectionChange).toHaveBeenCalledWith(['order_1', 'order_2']);
    renderer.unmount();
  });

  it('selects visible rows and delivers a single in-transit order', () => {
    const { onSelectionChange, props, renderer } = render();
    mobileTestRenderer.act(() => {
      (
        renderer.root.find(
          (node) =>
            typeof node.props === 'object' &&
            node.props !== null &&
            'accessibilityState' in node.props &&
            typeof node.props.accessibilityState === 'object' &&
            node.props.accessibilityState !== null &&
            'expanded' in node.props.accessibilityState &&
            node.props.accessibilityState.expanded === false,
        ).props as { onPress: () => void }
      ).onPress();
    });
    mobileTestRenderer.act(() => {
      (control(renderer.root, 'Select visible orders').props as { onPress: () => void }).onPress();
    });
    expect(onSelectionChange).toHaveBeenCalledWith(['order_1', 'order_2']);
    mobileTestRenderer.act(() => {
      (button(renderer.root, 'Mark delivered').props as { onPress: () => void }).onPress();
    });
    expect(props.onAdvance).toHaveBeenCalledWith(fixtureOrders[1]);
    renderer.unmount();
  });

  it('disables bulk selection while a status update is pending', () => {
    const { renderer } = render(true);
    expect(button(renderer.root, 'Select all 2 matching orders').props).toMatchObject({
      disabled: true,
    });
    renderer.unmount();
  });

  it('keeps selection across order pages and selects all matching orders', () => {
    const rows = Array.from({ length: 7 }, (_, index) =>
      order(`order_${String(index + 1)}`, index === 6 ? 'InTransit' : 'Ordered'),
    );
    const { onSelectionChange, props, renderer } = render(false, rows);
    mobileTestRenderer.act(() => {
      (
        button(renderer.root, 'Select all 7 matching orders').props as { onPress: () => void }
      ).onPress();
    });
    expect(onSelectionChange).toHaveBeenLastCalledWith(rows.map((row) => row.id));
    mobileTestRenderer.act(() => {
      renderer.update(
        createElement(InventoryOrderList, {
          ...props,
          selectedOrderIds: rows.map((row) => row.id),
        }),
      );
      (
        renderer.root.find(
          (node) =>
            typeof node.props === 'object' &&
            node.props !== null &&
            'accessibilityState' in node.props &&
            typeof node.props.accessibilityState === 'object' &&
            node.props.accessibilityState !== null &&
            'expanded' in node.props.accessibilityState &&
            node.props.accessibilityState.expanded === false,
        ).props as { onPress: () => void }
      ).onPress();
    });
    const next = renderer.root.find(
      (node) =>
        node.type === 'MobileButton' &&
        typeof node.props === 'object' &&
        node.props !== null &&
        'label' in node.props &&
        node.props.label === 'Next' &&
        'disabled' in node.props &&
        node.props.disabled === false,
    );
    mobileTestRenderer.act(() => {
      (next.props as { onPress: () => void }).onPress();
    });
    expect(control(renderer.root, 'Select visible orders').props).toMatchObject({
      accessibilityState: { checked: true },
    });
    renderer.unmount();
  });
});

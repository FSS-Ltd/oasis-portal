import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { mobileTestRenderer, type MobileTestInstance } from '../../test-utils/mobile-test-renderer';
import { InventoryOrderList } from './staff-academic-inventory-order-list';

vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  StyleSheet: { create: <T>(styles: T) => styles },
  Text: 'Text',
  View: 'View',
}));

vi.mock('../core/mobile-ui', () => ({
  Badge: 'Badge',
  Card: 'Card',
  MobileButton: 'MobileButton',
  MutedText: 'MutedText',
}));

type Props = Parameters<typeof InventoryOrderList>[0];
type Order = Props['orders'][number];

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

describe('InventoryOrderList selection', () => {
  const orders = [
    order('order_1', 'Ordered'),
    order('order_2', 'Ordered'),
    order('order_3', 'InTransit'),
    order('order_4', 'Delivered'),
  ];

  function render(selectedOrderIds: string[] = [], pending = false) {
    const onSelectionChange = vi.fn<(ids: string[]) => void>();
    const onMarkSelected = vi.fn();
    const props: Props = {
      bulkPending: pending,
      onAdvance: vi.fn(),
      onMarkSelected,
      onSelectionChange,
      orders,
      pending,
      selectedOrderIds,
      students: [],
      updatingOrderId: null,
    };
    const renderer = mobileTestRenderer.create(createElement(InventoryOrderList, props));
    return { onMarkSelected, onSelectionChange, props, renderer };
  }

  it('selects only Ordered orders and reports mixed and all-selected states', () => {
    const { onSelectionChange, props, renderer } = render();
    const selectAll = control(renderer.root, 'Select all');
    expect(selectAll.props).toMatchObject({ accessibilityState: { checked: false } });
    expect(control(renderer.root, 'Select PACE #1014 order for student, subject')).toBeDefined();
    expect(() => control(renderer.root, 'Select PACE #1016 order for student, subject')).toThrow();
    mobileTestRenderer.act(() => {
      (selectAll.props as { onPress: () => void }).onPress();
    });
    expect(onSelectionChange).toHaveBeenCalledWith(['order_1', 'order_2']);

    mobileTestRenderer.act(() => {
      renderer.update(
        createElement(InventoryOrderList, { ...props, selectedOrderIds: ['order_1'] }),
      );
    });
    expect(control(renderer.root, 'Select all').props).toMatchObject({
      accessibilityState: { checked: 'mixed' },
    });
    mobileTestRenderer.act(() => {
      renderer.update(
        createElement(InventoryOrderList, { ...props, selectedOrderIds: ['order_1', 'order_2'] }),
      );
    });
    expect(control(renderer.root, 'Select all').props).toMatchObject({
      accessibilityState: { checked: true },
    });
    mobileTestRenderer.act(() => {
      (control(renderer.root, 'Select all').props as { onPress: () => void }).onPress();
    });
    expect(onSelectionChange).toHaveBeenLastCalledWith([]);
    renderer.unmount();
  });

  it('toggles individual orders and submits the selected group', () => {
    const { onMarkSelected, onSelectionChange, props, renderer } = render();
    mobileTestRenderer.act(() => {
      (
        control(renderer.root, 'Select PACE #1014 order for student, subject').props as {
          onPress: () => void;
        }
      ).onPress();
    });
    expect(onSelectionChange).toHaveBeenCalledWith(['order_1']);
    mobileTestRenderer.act(() => {
      renderer.update(
        createElement(InventoryOrderList, { ...props, selectedOrderIds: ['order_1'] }),
      );
    });
    mobileTestRenderer.act(() => {
      (
        button(renderer.root, 'Mark selected in transit').props as { onPress: () => void }
      ).onPress();
    });
    expect(onMarkSelected).toHaveBeenCalledOnce();
    mobileTestRenderer.act(() => {
      (button(renderer.root, 'Clear selection').props as { onPress: () => void }).onPress();
    });
    expect(onSelectionChange).toHaveBeenLastCalledWith([]);
    renderer.unmount();
  });

  it('disables selection and status actions while the bulk request is pending', () => {
    const { renderer, props } = render(['order_1'], true);
    const firstOrder = orders[0];
    if (!firstOrder) throw new Error('expected first order fixture');
    mobileTestRenderer.act(() => {
      renderer.update(createElement(InventoryOrderList, { ...props, orders: [firstOrder] }));
    });
    expect(control(renderer.root, 'Select all').props).toMatchObject({ disabled: true });
    expect(
      control(renderer.root, 'Select PACE #1014 order for student, subject').props,
    ).toMatchObject({
      disabled: true,
    });
    expect(button(renderer.root, 'Marking in transit…').props).toMatchObject({ disabled: true });
    expect(button(renderer.root, 'Mark InTransit').props).toMatchObject({ disabled: true });
    renderer.unmount();
  });

  it('disables bulk actions when the list is empty', () => {
    const { props } = render();
    const renderer = mobileTestRenderer.create(
      createElement(InventoryOrderList, { ...props, orders: [] }),
    );
    expect(control(renderer.root, 'Select all').props).toMatchObject({ disabled: true });
    expect(button(renderer.root, 'Clear selection').props).toMatchObject({ disabled: true });
    expect(button(renderer.root, 'Mark selected in transit').props).toMatchObject({
      disabled: true,
    });
    renderer.unmount();
  });
});

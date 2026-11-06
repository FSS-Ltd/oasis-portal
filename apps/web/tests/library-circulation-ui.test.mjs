import assert from 'node:assert/strict';
import test from 'node:test';
import { mount } from './helpers/live-form-renderer.mjs';

const loans = ['Jane', 'Amos'].map((name, i) => ({
  id: `loan-${i}`,
  checkedOutAt: new Date('2026-11-01T12:00:00Z'),
  dueOn: new Date('2026-11-04T00:00:00Z'),
  returnedAt: null,
  status: 'Overdue',
  book: { id: 'same-title', barcode: '123', title: 'Shared title', author: 'Author' },
  student: { id: `student-${i}`, name, yearGroup: 'Year 6' },
}));

test('a return selects one named child’s loan even when titles and barcodes match', () => {
  let selected;
  const view = mount(
    'components/library/library-loan-table.tsx',
    'LibraryLoanTable',
    {},
    {
      loans,
      onReturn: (loan) => {
        selected = loan;
      },
      returningLoanId: null,
    },
  );
  const buttons = view.root.findAllByType('button');
  assert.equal(buttons.length, 2);
  assert.match(buttons[1].props['aria-label'], /Amos/);
  buttons[1].props.onClick();
  assert.equal(selected.id, 'loan-1');
  assert.equal(selected.book.barcode, '123');
  view.unmount();
});

test('returned history has no return control and shows returned date', () => {
  const view = mount(
    'components/library/library-loan-table.tsx',
    'LibraryLoanTable',
    {},
    {
      loans: [{ ...loans[0], returnedAt: new Date('2026-11-05T12:00:00Z'), status: 'Returned' }],
      onReturn() {},
      returningLoanId: null,
    },
  );
  assert.equal(view.root.findAllByType('button').length, 0);
  assert.equal(view.root.findByProps({ className: 'library-due ' }).children[0], 'Returned');
  assert.ok(view.root.findAllByType('small').some((node) => node.children.includes('5 Nov 2026')));
  view.unmount();
});

test('all return controls disable while a selected return is pending', () => {
  const view = mount(
    'components/library/library-loan-table.tsx',
    'LibraryLoanTable',
    {},
    {
      loans,
      onReturn() {},
      returningLoanId: 'loan-1',
    },
  );
  assert.ok(view.root.findAllByType('button').every((button) => button.props.disabled));
  view.unmount();
});

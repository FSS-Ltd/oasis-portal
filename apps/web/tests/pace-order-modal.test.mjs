import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const React = require('react');
const { act, create } = require('react-test-renderer');
const ts = require('typescript');

globalThis.document = { body: { style: {} } };

function loadModal() {
  const stubs = {
    'lucide-react': new Proxy({}, { get: () => () => null }),
    '@/lib/notifications': { friendlyErrorMessage: (error) => error.message },
    '@/components/ui/button': {
      Button: (props) => React.createElement('button', props, props.children),
    },
    '@/components/ui/field': {
      Field: (props) => React.createElement('label', null, props.children),
      SelectInput: (props) => React.createElement('select', props, props.children),
    },
    './pace-catalogue-picker': {
      PaceCataloguePicker: (props) => React.createElement('picker', props),
    },
  };
  const code = ts.transpileModule(
    readFileSync(
      new URL('../src/components/pace/pace-inventory-order-modal.tsx', import.meta.url),
      'utf8',
    ),
    {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
      },
    },
  ).outputText;
  const exports = {};
  vm.runInNewContext(code, {
    exports,
    require: (key) => stubs[key] ?? require(key),
    document: globalThis.document,
    console,
    Error,
  });
  return exports;
}

const subjects = [
  {
    subjectId: 'maths',
    subjectLabel: 'MATH · Maths',
    currentPaceNumber: 1010,
    availablePaceNumbers: [1011, 1012, 1013],
  },
  {
    subjectId: 'english',
    subjectLabel: 'ENG · English',
    currentPaceNumber: 1020,
    availablePaceNumbers: [1021, 1022],
  },
];

function mountModal(onSubmit) {
  const { PaceInventoryOrderModal, PartialOrderError } = loadModal();
  let renderer;
  act(() => {
    renderer = create(
      React.createElement(PaceInventoryOrderModal, {
        onClose() {},
        onSubmit,
        pending: false,
        studentName: 'Ada Example',
        subjects,
      }),
    );
  });
  const root = renderer.root;
  return {
    PartialOrderError,
    picker: () => root.findByType('picker').props,
    select: () => root.findByType('select').props,
    submitButton: () =>
      root.findAllByType('button').find((node) => node.props.type === 'submit').props,
    form: () => root.findByType('form').props,
    errors: () =>
      root
        .findAll((node) => node.props.role === 'alert')
        .map((node) => String(node.props.children)),
  };
}

// Values built inside the vm sandbox have a different Array prototype; compare plain copies.
const plain = (value) => JSON.parse(JSON.stringify(value));
const choose = (ui, subjectId) =>
  act(() => ui.select().onChange({ currentTarget: { value: subjectId } }));
const pick = (ui, paces) => act(() => ui.picker().onChange(paces));

test('picks for one subject survive switching to another subject and back', () => {
  const ui = mountModal(async () => {});
  pick(ui, [1011, 1012]);
  choose(ui, 'english');
  assert.deepEqual(plain(ui.picker().selectedPaceNumbers), []);
  pick(ui, [1021]);
  choose(ui, 'maths');
  assert.deepEqual(plain(ui.picker().selectedPaceNumbers), [1011, 1012]);
  choose(ui, 'english');
  assert.deepEqual(plain(ui.picker().selectedPaceNumbers), [1021]);
});

test('every subject with picks is ordered in one submit and the footer says so', async () => {
  const calls = [];
  const ui = mountModal(async (orders) => {
    calls.push(orders);
  });
  pick(ui, [1011, 1012]);
  assert.equal(ui.submitButton().children.at(-1), 'Create order');
  choose(ui, 'english');
  pick(ui, [1021]);
  assert.match(String(ui.submitButton().children.at(-1)), /3 PACEs.*2 subjects/);
  await act(async () => ui.form().onSubmit({ preventDefault() {} }));
  assert.deepEqual(plain(calls), [
    [
      { subjectId: 'maths', paceNumbers: [1011, 1012] },
      { subjectId: 'english', paceNumbers: [1021] },
    ],
  ]);
});

test('subject options show how many PACEs are chosen', () => {
  const ui = mountModal(async () => {});
  pick(ui, [1011, 1012]);
  const labels = ui
    .select()
    .children.flat()
    .filter(Boolean)
    .map((option) => String(option.props.children));
  assert.ok(
    labels.some((label) => /MATH · Maths.*2 selected/.test(label)),
    labels.join(' | '),
  );
  assert.ok(
    labels.some((label) => label === 'ENG · English'),
    labels.join(' | '),
  );
});

test('after a partial failure only the failed subject keeps its picks', async () => {
  let ui;
  const failing = async () => {
    throw new ui.PartialOrderError(['maths'], 'English could not be ordered.');
  };
  ui = mountModal(failing);
  pick(ui, [1011]);
  choose(ui, 'english');
  pick(ui, [1021, 1022]);
  await act(async () => ui.form().onSubmit({ preventDefault() {} }));
  assert.deepEqual(plain(ui.picker().selectedPaceNumbers), [1021, 1022]);
  assert.ok(ui.errors().some((message) => /English could not be ordered/.test(message)));
  choose(ui, 'maths');
  assert.deepEqual(plain(ui.picker().selectedPaceNumbers), []);
});

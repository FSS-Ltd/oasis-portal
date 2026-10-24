import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const React = require('react');
const ts = require('typescript');
const { act, create } = require('react-test-renderer');
const compiled = ts.transpileModule(
  readFileSync(
    new URL('../src/app/compliance/update-compliance-modal.tsx', import.meta.url),
    'utf8',
  ),
  {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  },
).outputText;
const first = {
  id: 'person-one',
  dob: null,
  dbsCertificateNumber: 'Certificate one',
  dbsApplicationReference: 'Reference one',
  dbsCompletedAt: null,
  dbsIssueDate: null,
  dbsApplicationType: null,
  dbsStatus: 'AwaitingCertificate',
  firstAidCompletedAt: null,
  firstAidLevel: null,
  safeguardingCompletedAt: null,
  safeguardingLevel: null,
};

function renderEditor() {
  const exports = {};
  const people = {
    'person-one': first,
    'person-two': { ...first, id: 'person-two', dbsCertificateNumber: 'Certificate two' },
  };
  let forcedData;
  const submitted = [];
  const mutation = {
    isPending: false,
    mutate(input) {
      submitted.push(input);
    },
  };
  let success;
  let invalidate = async () => {};
  let renderer;
  const stub = (tag) => (props) => React.createElement(tag, props, props.children);
  const imports = {
    '@oasis/domain': {
      DBS_APPLICATION_TYPES: ['Basic', 'Standard', 'Enhanced'],
      DBS_CERTIFICATE_STATUSES: ['AwaitingCertificate', 'RecordedCurrent', 'NoLongerCurrent'],
      updateAdultComplianceInput: { safeParse: (data) => ({ success: true, data }) },
    },
    '@/components/ui/button': { Button: stub('button') },
    '@/components/ui/field': {
      Field: stub('label'),
      TextInput: stub('input'),
      SelectInput: stub('select'),
    },
    '@/lib/notifications': { friendlyErrorMessage: String, showSuccessToast() {} },
    '@/lib/trpc': {
      api: {
        useUtils: () => ({
          compliance: Object.fromEntries(
            ['register', 'person', 'badgeSummaries', 'allBadgeSummaries'].map((key) => [
              key,
              { invalidate: () => (key === 'person' ? invalidate() : Promise.resolve()) },
            ]),
          ),
        }),
        compliance: {
          person: {
            useQuery: ({ userId }) => ({
              data: forcedData ?? people[userId],
              isLoading: false,
              error: null,
            }),
          },
          update: {
            useMutation: (options) => {
              success = options.onSuccess;
              return mutation;
            },
          },
        },
      },
    },
  };
  vm.runInNewContext(compiled, { exports, require: (name) => imports[name] ?? require(name) });
  const element = () =>
    React.createElement(exports.UpdateComplianceModal, {
      onClose: () => renderer.update(null),
      options: [],
      optionsLoading: false,
      optionsError: null,
    });
  act(() => {
    renderer = create(element(), {
      createNodeMock: ({ type }) =>
        type === 'dialog'
          ? {
              showModal() {},
              querySelector: () => ({ focus() {} }),
              close: () => renderer.root.findByType('dialog').props.onClose(),
            }
          : null,
    });
  });
  const input = (label) =>
    renderer.root
      .find((node) => node.type === 'label' && node.props.label === label)
      .find((node) => node.type === 'input' || node.type === 'select');
  return {
    mutation,
    input,
    submitted,
    change(label, value) {
      act(() => input(label).props.onChange({ target: { value } }));
    },
    update(data) {
      people[data.id] = data;
      act(() => renderer.update(element()));
    },
    force(data) {
      forcedData = data;
      act(() => renderer.update(element()));
    },
    submit() {
      act(() => renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }));
    },
    setInvalidate(callback) {
      invalidate = callback;
    },
    success() {
      return success;
    },
    disabled() {
      return renderer.root.findAllByType('fieldset').every((node) => node.props.disabled);
    },
    cancel() {
      act(() =>
        renderer.root
          .find((node) => node.type === 'button' && node.props.children === 'Cancel')
          .props.onClick(),
      );
    },
    reopen() {
      act(() => renderer.update(element()));
    },
    unmount() {
      act(() => renderer.unmount());
    },
  };
}

test('same-person compliance snapshots retain edited and cleared fields while untouched fields refresh', () => {
  const editor = renderEditor();
  try {
    editor.change('Person', first.id);
    editor.change('Certificate number', 'Unsaved certificate');
    editor.change('Date of birth', '');
    editor.update({ ...first, dob: '1980-01-01', dbsApplicationReference: 'New reference' });
    assert.equal(editor.input('Certificate number').props.value, 'Unsaved certificate');
    assert.equal(editor.input('Application reference').props.value, 'New reference');
    assert.equal(editor.input('Date of birth').props.value, '1980-01-01');
    editor.change('Date of birth', '');
    editor.update({ ...first, dob: '1981-01-01' });
    assert.equal(editor.input('Date of birth').props.value, '');
    editor.submit();
    assert.equal(editor.submitted[0].userId, first.id);
    assert.equal(editor.submitted[0].dbsCertificateNumber, 'Unsaved certificate');
    assert.equal(editor.submitted[0].dob, null);
  } finally {
    editor.unmount();
  }
});

test('selecting a person resets drafts and refuses a mismatched query snapshot', () => {
  const editor = renderEditor();
  try {
    editor.change('Person', first.id);
    editor.change('Certificate number', 'Unsaved certificate');
    editor.force(first);
    editor.change('Person', 'person-two');
    assert.equal(editor.disabled(), true);
    editor.submit();
    assert.equal(editor.submitted.length, 0);
    editor.force(undefined);
    assert.equal(editor.input('Certificate number').props.value, 'Certificate two');
    editor.submit();
    assert.equal(editor.submitted[0].userId, 'person-two');
  } finally {
    editor.unmount();
  }
});

test('cancel and successful save close the modal; reopening uses the current record', async () => {
  const editor = renderEditor();
  try {
    editor.change('Person', first.id);
    editor.change('Certificate number', 'Cancelled draft');
    editor.cancel();
    editor.reopen();
    editor.change('Person', first.id);
    assert.equal(editor.input('Certificate number').props.value, 'Certificate one');
    editor.change('Certificate number', 'Saved certificate');
    editor.setInvalidate(async () =>
      editor.update({ ...first, dbsCertificateNumber: 'Saved certificate' }),
    );
    await act(async () => editor.success()());
    editor.reopen();
    editor.change('Person', first.id);
    assert.equal(editor.input('Certificate number').props.value, 'Saved certificate');
  } finally {
    editor.unmount();
  }
});

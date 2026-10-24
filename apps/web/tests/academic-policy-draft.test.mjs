import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const React = require('react');
const ts = require('typescript');
const { act, create } = require('react-test-renderer');
function load(relative, imports) {
  const exports = {};
  const compiled = ts.transpileModule(readFileSync(new URL(relative, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(compiled, { exports, require: (name) => imports[name] ?? require(name) });
  return exports;
}
const initial = {
  id: 'default',
  dailyTestLimitEnabled: false,
  maxTestsPerStudentPerDay: 2,
  samePaceSameDayBlockEnabled: true,
  passThreshold: 80,
};

function renderEditor() {
  const query = { data: initial, isLoading: false, error: null };
  const submitted = [];
  const mutation = {
    isPending: false,
    error: null,
    mutate(input) {
      submitted.push(input);
    },
  };
  let success;
  let invalidate = async () => {};
  const stub = (tag) => (props) => React.createElement(tag, props, props.children);
  const imports = {
    'lucide-react': { Save: stub('svg'), Trash2: stub('svg'), SlidersHorizontal: stub('svg') },
    '@/components/ui/button': { Button: stub('button') },
    '@/components/ui/field': { Field: stub('label'), TextInput: stub('input') },
    '@/lib/notifications': {
      friendlyErrorMessage: String,
      showErrorToast() {},
      showSuccessToast() {},
    },
    './school-year-options': { standardSchoolYearOptions: [] },
    '@/lib/trpc': {
      api: {
        useUtils: () => ({ admin: { getPacePolicy: { invalidate: () => invalidate() } } }),
        admin: {
          ...Object.fromEntries(
            ['listYearGroupBands', 'listAgeBandStudents', 'listSubjects'].map((key) => [
              key,
              { useQuery: () => ({ data: [], isLoading: false, error: null }) },
            ]),
          ),
          ...Object.fromEntries(
            [
              'createYearGroupBand',
              'updateYearGroupBand',
              'deactivateYearGroupBand',
              'createSubject',
              'updateSubject',
              'deactivateSubject',
            ].map((key) => [
              key,
              { useMutation: () => ({ isPending: false, error: null, mutate() {} }) },
            ]),
          ),
          getPacePolicy: { useQuery: () => ({ ...query }) },
          updatePacePolicy: {
            useMutation: (options) => {
              success = options.onSuccess;
              return mutation;
            },
          },
        },
      },
    },
  };
  imports['./_components/academic-panels'] = load(
    '../src/app/(admin)/admin/academic/_components/academic-panels.tsx',
    imports,
  );
  const { AcademicSettingsClient } = load(
    '../src/app/(admin)/admin/academic/academic-settings-client.tsx',
    imports,
  );
  let renderer;
  act(() => {
    renderer = create(React.createElement(AcademicSettingsClient));
  });
  const input = (label) =>
    renderer.root
      .find((node) => node.type === 'label' && node.props.label === label)
      .findByType('input');
  const policy = () =>
    renderer.root.findByType(imports['./_components/academic-panels'].PacePolicyPanel);
  return {
    mutation,
    input,
    submitted,
    update(data) {
      query.data = data;
      act(() => renderer.update(React.createElement(AcademicSettingsClient)));
    },
    change(label, value) {
      act(() => input(label).props.onChange({ target: { value } }));
    },
    toggleDailyLimit(checked) {
      const checkbox = policy()
        .findAllByType('input')
        .find((node) => node.props.type === 'checkbox');
      act(() => checkbox.props.onChange({ target: { checked } }));
    },
    submit() {
      act(() =>
        policy()
          .findByType('form')
          .props.onSubmit({ preventDefault() {} }),
      );
    },
    setInvalidate(callback) {
      invalidate = callback;
    },
    success() {
      return success;
    },
    unmount() {
      act(() => renderer.unmount());
    },
  };
}

test('policy refreshes preserve edited fields and use latest untouched values when saving', () => {
  const editor = renderEditor();
  try {
    editor.change('Pass threshold', '90');
    editor.update({ ...initial, maxTestsPerStudentPerDay: 4 });
    assert.equal(editor.input('Pass threshold').props.value, '90');
    assert.equal(editor.input('Maximum tests per student per day').props.value, '4');
    editor.submit();
    assert.equal(editor.submitted[0].passThreshold, 90);
    assert.equal(editor.submitted[0].maxTestsPerStudentPerDay, 4);
    editor.change('Pass threshold', '80');
    editor.update({ ...initial, passThreshold: 85 });
    assert.equal(editor.input('Pass threshold').props.value, '85');
  } finally {
    editor.unmount();
  }
});

test('successful policy saves clear submitted drafts but keep edits made while saving', async () => {
  const editor = renderEditor();
  try {
    editor.change('Pass threshold', '090');
    editor.submit();
    const submitted = editor.submitted[0];
    editor.mutation.isPending = true;
    editor.update(initial);
    editor.change('Maximum tests per student per day', '5');
    editor.setInvalidate(async () => editor.update({ ...initial, ...submitted }));
    await act(async () => editor.success()({ ...initial, ...submitted }, submitted));
    assert.equal(editor.input('Pass threshold').props.value, '90');
    assert.equal(editor.input('Maximum tests per student per day').props.value, '5');
    editor.update({ ...initial, passThreshold: 85 });
    assert.equal(editor.input('Pass threshold').props.value, '85');
    assert.equal(editor.input('Maximum tests per student per day').props.value, '5');
  } finally {
    editor.unmount();
  }
});

test('edits made during a save survive even when they restore pre-save values', async () => {
  const editor = renderEditor();
  try {
    editor.change('Pass threshold', '90');
    editor.toggleDailyLimit(true);
    editor.submit();
    const submitted = editor.submitted[0];
    editor.mutation.isPending = true;
    editor.update(initial);
    editor.change('Pass threshold', '80');
    editor.toggleDailyLimit(false);
    editor.setInvalidate(async () => editor.update({ ...initial, ...submitted }));
    await act(async () => editor.success()({ ...initial, ...submitted }, submitted));
    assert.equal(editor.input('Pass threshold').props.value, '80');
    editor.mutation.isPending = false;
    editor.update({ ...initial, ...submitted });
    editor.submit();
    assert.equal(editor.submitted[1].passThreshold, 80);
    assert.equal(editor.submitted[1].dailyTestLimitEnabled, false);
  } finally {
    editor.unmount();
  }
});

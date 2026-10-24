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
    new URL('../src/components/faith-corner/faith-corner-admin-client.tsx', import.meta.url),
    'utf8',
  ),
  {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  },
).outputText;
const initial = {
  id: 'publication-one',
  ready: true,
  weeklyTheme: 'Hope',
  memoryVerse: { reference: 'Reference 1', text: 'Memory text', translation: 'NKJV' },
  reflectionPrompt: 'Reflect on hope',
  verseOfDay: { reference: 'Reference 2', text: 'Daily text', translation: 'NKJV' },
  publishedAt: new Date('2026-01-01'),
  likeCount: 0,
  commentCount: 0,
};

function renderEditor() {
  const exports = {};
  const query = { data: initial, isLoading: false, error: null };
  const submitted = [];
  const mutation = {
    isPending: false,
    mutate(input) {
      submitted.push(input);
    },
  };
  let success;
  let invalidate = async () => {};
  const stub = (tag) => (props) => React.createElement(tag, props, props.children);
  const imports = {
    'lucide-react': Object.fromEntries(
      ['BookOpenText', 'Check', 'MessageCircle', 'Sparkles', 'X'].map((name) => [
        name,
        stub('svg'),
      ]),
    ),
    '@/components/ui/button': { Button: stub('button') },
    '@/components/ui/empty-state': { EmptyState: () => null },
    '@/components/ui/field': { Field: stub('label'), TextInput: stub('input') },
    '@/lib/notifications': {
      friendlyErrorMessage: String,
      showErrorToast() {},
      showSuccessToast() {},
    },
    '@/lib/trpc': {
      api: {
        useUtils: () => ({
          faithCorner: {
            currentForAdmin: { invalidate: () => invalidate() },
            pendingCommentsForAdmin: { invalidate: async () => {} },
          },
        }),
        faithCorner: {
          currentForAdmin: { useQuery: () => ({ ...query }) },
          pendingCommentsForAdmin: {
            useQuery: () => ({ data: [], isLoading: false, error: null }),
          },
          publish: {
            useMutation: (options) => {
              success = options.onSuccess;
              return mutation;
            },
          },
          reviewComment: { useMutation: () => ({ isPending: false, mutate() {} }) },
        },
      },
    },
  };
  vm.runInNewContext(compiled, { exports, require: (name) => imports[name] ?? require(name) });
  const element = () => React.createElement(exports.FaithCornerAdminClient);
  let renderer;
  act(() => {
    renderer = create(element());
  });
  const input = (label) =>
    renderer.root
      .find((node) => node.type === 'label' && node.props.label === label)
      .find((node) => node.type === 'input' || node.type === 'textarea');
  return {
    mutation,
    input,
    submitted,
    update(data) {
      query.data = data;
      act(() => renderer.update(element()));
    },
    change(label, value) {
      act(() => input(label).props.onChange({ target: { value } }));
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
    unmount() {
      act(() => renderer.unmount());
    },
  };
}

test('engagement snapshots retain edits and cleared verses while untouched content refreshes', () => {
  const editor = renderEditor();
  try {
    editor.change('Weekly theme', 'Draft theme');
    editor.change('Memory verse text', 'Draft memory text');
    editor.change('Verse of the day reference', '');
    editor.change('Verse of the day text', '');
    editor.update({
      ...initial,
      likeCount: 3,
      commentCount: 2,
      reflectionPrompt: 'Fresh reflection',
    });
    assert.equal(editor.input('Weekly theme').props.value, 'Draft theme');
    assert.equal(editor.input('Memory verse text').props.value, 'Draft memory text');
    assert.equal(editor.input('Reflection prompt').props.value, 'Fresh reflection');
    editor.submit();
    assert.deepEqual(JSON.parse(JSON.stringify(editor.submitted[0])), {
      weeklyTheme: 'Draft theme',
      memoryVerseReference: 'Reference 1',
      memoryVerseText: 'Draft memory text',
      reflectionPrompt: 'Fresh reflection',
      verseOfDayReference: null,
      verseOfDayText: null,
    });
    editor.change('Weekly theme', initial.weeklyTheme);
    editor.update({ ...initial, weeklyTheme: 'Updated theme' });
    assert.equal(editor.input('Weekly theme').props.value, 'Updated theme');
  } finally {
    editor.unmount();
  }
});

test('a new publication resets all fields and ignores the previous publication save callback', async () => {
  const editor = renderEditor();
  try {
    editor.change('Weekly theme', 'Old draft');
    const finishOldSave = editor.success();
    editor.update({
      ...initial,
      id: 'publication-two',
      weeklyTheme: 'New publication',
      verseOfDay: null,
    });
    assert.equal(editor.input('Weekly theme').props.value, 'New publication');
    assert.equal(editor.input('Verse of the day text').props.value, '');
    editor.change('Weekly theme', 'New draft');
    await act(async () => finishOldSave());
    assert.equal(editor.input('Weekly theme').props.value, 'New draft');
  } finally {
    editor.unmount();
  }
});

test('successful publishing adopts the refreshed fields and releases them for later updates', async () => {
  const editor = renderEditor();
  try {
    editor.change('Weekly theme', 'Saved theme ');
    editor.mutation.isPending = true;
    editor.update(initial);
    assert.equal(editor.input('Weekly theme').props.disabled, true);
    assert.equal(editor.input('Memory verse text').props.disabled, true);
    editor.setInvalidate(async () => editor.update({ ...initial, weeklyTheme: 'Saved theme' }));
    await act(async () => editor.success()());
    assert.equal(editor.input('Weekly theme').props.value, 'Saved theme');
    editor.update({ ...initial, weeklyTheme: 'Later update' });
    assert.equal(editor.input('Weekly theme').props.value, 'Later update');
  } finally {
    editor.unmount();
  }
});

test('removing the current publication resets to an empty form', () => {
  const editor = renderEditor();
  try {
    editor.change('Weekly theme', 'Old draft');
    editor.update({ ...initial, id: null, ready: false, memoryVerse: null, verseOfDay: null });
    assert.equal(editor.input('Weekly theme').props.value, '');
    assert.equal(editor.input('Memory verse text').props.value, '');
  } finally {
    editor.unmount();
  }
});

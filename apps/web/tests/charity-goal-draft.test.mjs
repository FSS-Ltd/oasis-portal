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
    new URL('../src/components/leaderboard/leaderboard-client.tsx', import.meta.url),
    'utf8',
  ),
  {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  },
).outputText;
const initial = { goalMerits: 100, currentMerits: 10, progressPct: 10, goalReached: false };

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
  let canManageCharityGoal = true;
  const stub = (props) => React.createElement('svg', props);
  const imports = {
    'lucide-react': { Goal: stub, Medal: stub, ShieldAlert: stub },
    '@oasis/domain': { displaySchoolYearLabel: String },
    '@/lib/notifications': { showErrorToast() {}, showSuccessToast() {} },
    '@/lib/trpc': {
      api: {
        useUtils: () => ({
          leaderboard: { charityPot: { get: { invalidate: () => invalidate() } } },
        }),
        leaderboard: {
          get: {
            useQuery: () => ({ data: { rows: [], viewerRows: [] }, isLoading: false, error: null }),
          },
          charityPot: {
            get: { useQuery: () => ({ ...query }) },
            updateGoal: {
              useMutation: (options) => {
                success = options.onSuccess;
                return mutation;
              },
            },
          },
        },
      },
    },
  };
  vm.runInNewContext(compiled, { exports, require: (name) => imports[name] ?? require(name) });
  const element = () =>
    React.createElement(exports.LeaderboardClient, { portal: 'admin', canManageCharityGoal });
  let renderer;
  act(() => {
    renderer = create(element());
  });
  const input = () => renderer.root.findByProps({ id: 'charity-pot-goal' });
  return {
    mutation,
    input,
    submitted,
    update(data) {
      query.data = data;
      act(() => renderer.update(element()));
    },
    permission(allowed) {
      canManageCharityGoal = allowed;
      act(() => renderer.update(element()));
    },
    change(value) {
      act(() => input().props.onChange({ target: { value } }));
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

test('live contributions do not erase a goal draft and submission uses the draft', () => {
  const editor = renderEditor();
  try {
    editor.change('250');
    editor.update({ ...initial, currentMerits: 30, progressPct: 30 });
    assert.equal(editor.input().props.value, '250');
    editor.submit();
    assert.equal(editor.submitted[0].goalMerits, 250);
  } finally {
    editor.unmount();
  }
});

test('untouched and reverted goals follow the latest saved goal', () => {
  const editor = renderEditor();
  try {
    editor.update({ ...initial, goalMerits: 150 });
    assert.equal(editor.input().props.value, '150');
    editor.change('250');
    editor.change('150');
    editor.update({ ...initial, goalMerits: 200 });
    assert.equal(editor.input().props.value, '200');
  } finally {
    editor.unmount();
  }
});

test('a saved goal adopts the refreshed value and continues following snapshots', async () => {
  const editor = renderEditor();
  try {
    editor.change('0250');
    editor.mutation.isPending = true;
    editor.update(initial);
    assert.equal(editor.input().props.disabled, true);
    editor.setInvalidate(async () => editor.update({ ...initial, goalMerits: 250 }));
    await act(async () => editor.success()({ ...initial, goalMerits: 250 }));
    assert.equal(editor.input().props.value, '250');
    editor.update({ ...initial, goalMerits: 300 });
    assert.equal(editor.input().props.value, '300');
  } finally {
    editor.unmount();
  }
});

test('a revoked editing permission discards the hidden goal draft', () => {
  const editor = renderEditor();
  try {
    editor.change('250');
    editor.permission(false);
    editor.update({ ...initial, goalMerits: 200 });
    editor.permission(true);
    assert.equal(editor.input().props.value, '200');
  } finally {
    editor.unmount();
  }
});

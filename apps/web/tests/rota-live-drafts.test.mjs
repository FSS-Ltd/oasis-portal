import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const React = require('react');
const ts = require('typescript');
const { act, create } = require('react-test-renderer');
const window = { id: 'window', dayOfWeek: 1, date: '2026-10-01', startMinute: 540, endMinute: 720 };
const club = { id: 'club-one', name: 'First club' };
const secondClub = { id: 'club-two', name: 'Second club' };

function mount(path, name, queries, props = {}) {
  let pending = false;
  let rejectSave = false;
  let invalidate = () => Promise.resolve();
  const options = {};
  const submitted = [];
  const node = (path = '') =>
    new Proxy(() => {}, {
      get(_, key) {
        if (key === 'useQuery')
          return (input) => ({ data: queries[path]?.(input) ?? [], isLoading: false });
        if (key === 'useUtils') return () => node();
        if (key === 'invalidate') return (...args) => invalidate(path, ...args);
        if (key === 'useMutation')
          return (callbacks) => {
            options[path] = callbacks;
            return {
              isPending: pending,
              mutate(input) {
                submitted.push(input);
              },
              mutateAsync(input) {
                submitted.push(input);
                return rejectSave ? Promise.reject(new Error('Save failed')) : Promise.resolve();
              },
            };
          };
        return node(path ? `${path}.${String(key)}` : String(key));
      },
    });
  const stub = (type) => (props) => React.createElement(type, props, props.children);
  const imports = {
    '@/lib/trpc': { api: node() },
    '@/lib/notifications': {
      friendlyErrorMessage: String,
      showErrorToast() {},
      showSuccessToast() {},
    },
    '@/lib/profile-display': { roleLabel: String },
    '@/components/ui/button': { Button: stub('button') },
    '@/components/ui/field': {
      Field: stub('label'),
      TextInput: stub('input'),
      SelectInput: stub('select'),
    },
    '@/components/ui/badge': { Badge: stub('span') },
    '@/components/compliance/adult-name-badges': { AdultNameBadges: () => null },
    'lucide-react': new Proxy({}, { get: () => stub('svg') }),
  };
  function load(filename) {
    const exports = {};
    const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText;
    vm.runInNewContext(compiled, {
      exports,
      require: (name) =>
        imports[name] ??
        (name.startsWith('.')
          ? load(
              resolve(dirname(filename), `${name}.tsx`).replace(
                'club-schedule-utils.tsx',
                'club-schedule-utils.ts',
              ),
            )
          : require(name)),
    });
    return exports;
  }
  const component = load(fileURLToPath(new URL(`../src/components/${path}.tsx`, import.meta.url)))[
    name
  ];
  let renderer;
  const element = () => React.createElement(component, props);
  act(() => {
    renderer = create(element());
  });
  return {
    get root() {
      return renderer.root;
    },
    submitted,
    update(nextProps = props) {
      props = nextProps;
      act(() => renderer.update(element()));
    },
    change(input, value) {
      act(() => input.props.onChange({ target: { value } }));
    },
    pending(value) {
      pending = value;
      this.update();
    },
    rejectSave(value) {
      rejectSave = value;
    },
    invalidate(callback) {
      invalidate = callback;
    },
    async success(path) {
      await act(async () => {
        await options[path].onSuccess();
      });
    },
    unmount() {
      act(() => renderer.unmount());
    },
  };
}

for (const monthly of [false, true]) {
  const query = monthly ? 'rota.myMonthlyAvailability' : 'rota.myAvailability';
  const mutation = monthly ? 'rota.setMyMonthlyAvailability' : 'rota.setMyAvailability';
  const label = monthly ? 'Monthly unavailability start time' : 'Availability start time';
  test(`${monthly ? 'monthly' : 'weekly'} availability preserves drafts, follows clean snapshots, and resets after saving`, async () => {
    let snapshot = [window];
    const editor = mount(
      `rota/${monthly ? 'monthly-availability-editor' : 'my-availability-editor'}`,
      monthly ? 'MonthlyAvailabilityEditor' : 'MyAvailabilityEditor',
      { [query]: () => snapshot },
    );
    const input = () => editor.root.findByProps({ 'aria-label': label, type: 'time' });
    try {
      snapshot = [{ ...window, startMinute: 600 }];
      editor.update();
      assert.equal(input().props.value, '10:00');
      editor.change(input(), '11:00');
      snapshot = [{ ...window, startMinute: 630 }];
      editor.update();
      assert.equal(input().props.value, '11:00');
      editor.pending(true);
      assert.equal(input().props.disabled, true);
      editor.invalidate(() => {
        snapshot = [{ ...window, startMinute: 660 }];
        editor.update();
        return Promise.resolve();
      });
      await editor.success(mutation);
      snapshot = [{ ...window, startMinute: 690 }];
      editor.update();
      assert.equal(input().props.value, '11:30');
      if (monthly) {
        editor.pending(false);
        editor.change(input(), '12:00');
        editor.change(editor.root.findByProps({ type: 'month' }), '2026-11');
        assert.equal(input().props.value, '11:30');
      }
    } finally {
      editor.unmount();
    }
  });
}

test('club availability isolates drafts by club and retains failed saves', async () => {
  let snapshot = [window];
  const editor = mount(
    'clubs/my-club-rota-panel',
    'MyClubRotaPanel',
    { 'club.myClubAvailability': () => snapshot },
    { accessClubs: [club, secondClub] },
  );
  const input = () => editor.root.findAllByProps({ type: 'time' })[0];
  try {
    editor.change(input(), '11:00');
    snapshot = [{ ...window, startMinute: 600 }];
    editor.update();
    assert.equal(input().props.value, '11:00');
    editor.rejectSave(true);
    await act(async () => {
      await editor.root
        .findAllByType('button')
        .find((button) => button.props.children?.some?.((child) => child === 'Save availability'))
        .props.onClick();
    });
    assert.equal(input().props.value, '11:00');
    const selector = editor.root
      .findAllByType('select')
      .find((select) => select.props.value === club.id);
    editor.change(selector, secondClub.id);
    assert.equal(input().props.value, '10:00');
    editor.change(input(), '12:00');
    editor.pending(true);
    assert.equal(input().props.disabled, true);
  } finally {
    editor.unmount();
  }
});

test('club participant edits survive live refresh while untouched candidates update', () => {
  let candidates = [
    { id: 'one', selected: true, role: 'Parent' },
    { id: 'two', selected: false, role: 'Parent' },
  ];
  const editor = mount(
    'clubs/club-rota-panel',
    'ClubRotaPanel',
    { 'club.rotaCandidates': () => candidates },
    { club },
  );
  const boxes = () => editor.root.findAllByProps({ type: 'checkbox' }).slice(0, 2);
  try {
    act(() => boxes()[0].props.onChange());
    candidates = [{ ...candidates[0] }, { ...candidates[1], selected: true }];
    editor.update();
    assert.equal(boxes()[0].props.checked, false);
    assert.equal(boxes()[1].props.checked, true);
    editor.pending(true);
    assert.equal(boxes()[0].props.disabled, true);
    editor.update({ club: secondClub });
    assert.equal(boxes()[0].props.checked, true);
  } finally {
    editor.unmount();
  }
});

test('club participant saves retain failures and release drafts after refreshed success', async () => {
  let candidates = [{ id: 'one', selected: true, role: 'Parent' }];
  const editor = mount(
    'clubs/club-rota-panel',
    'ClubRotaPanel',
    { 'club.rotaCandidates': () => candidates },
    { club },
  );
  const box = () => editor.root.findAllByProps({ type: 'checkbox' })[0];
  const save = () =>
    editor.root
      .findAllByType('button')
      .find((button) => button.props.children?.some?.((child) => child === 'Save'));
  try {
    act(() => box().props.onChange());
    editor.rejectSave(true);
    await act(async () => {
      save().props.onClick();
    });
    assert.equal(box().props.checked, false);
    assert.equal(editor.submitted[0].userIds.length, 0);
    editor.rejectSave(false);
    editor.invalidate(() => {
      candidates = [{ ...candidates[0], selected: false }];
      editor.update();
      return Promise.resolve();
    });
    await act(async () => {
      save().props.onClick();
    });
    candidates = [{ ...candidates[0], selected: true }];
    editor.update();
    assert.equal(box().props.checked, true);
  } finally {
    editor.unmount();
  }
});

test('a late monthly save cannot erase another month draft', async () => {
  const editor = mount('rota/monthly-availability-editor', 'MonthlyAvailabilityEditor', {
    'rota.myMonthlyAvailability': () => [window],
  });
  const input = () =>
    editor.root.findByProps({ 'aria-label': 'Monthly unavailability start time', type: 'time' });
  let release;
  const catchup = new Promise((resolve) => {
    release = resolve;
  });
  try {
    editor.change(input(), '11:00');
    editor.invalidate(() => catchup);
    const saved = editor.success('rota.setMyMonthlyAvailability');
    editor.change(editor.root.findByProps({ type: 'month' }), '2026-11');
    editor.change(input(), '12:00');
    release();
    await saved;
    assert.equal(input().props.value, '12:00');
  } finally {
    editor.unmount();
  }
});

for (const monthly of [false, true]) {
  test(`${monthly ? 'monthly' : 'weekly'} draft controls remain locked through asynchronous catch-up`, async () => {
    const query = monthly ? 'rota.myMonthlyAvailability' : 'rota.myAvailability';
    const mutation = monthly ? 'rota.setMyMonthlyAvailability' : 'rota.setMyAvailability';
    const label = monthly ? 'Monthly unavailability start time' : 'Availability start time';
    const editor = mount(
      `rota/${monthly ? 'monthly-availability-editor' : 'my-availability-editor'}`,
      monthly ? 'MonthlyAvailabilityEditor' : 'MyAvailabilityEditor',
      { [query]: () => [window] },
    );
    let release;
    const catchup = new Promise((resolve) => {
      release = resolve;
    });
    try {
      editor.invalidate(() => catchup);
      const saved = editor.success(mutation);
      assert.equal(
        editor.root.findByProps({ 'aria-label': label, type: 'time' }).props.disabled,
        true,
      );
      release();
      await saved;
      assert.equal(
        editor.root.findByProps({ 'aria-label': label, type: 'time' }).props.disabled,
        false,
      );
    } finally {
      editor.unmount();
    }
  });
}

test('club participant controls remain locked until catch-up completes', async () => {
  const editor = mount(
    'clubs/club-rota-panel',
    'ClubRotaPanel',
    { 'club.rotaCandidates': () => [{ id: 'one', selected: true, role: 'Parent' }] },
    { club },
  );
  let release;
  const catchup = new Promise((resolve) => {
    release = resolve;
  });
  try {
    editor.invalidate(() => catchup);
    await act(async () => {
      editor.root
        .findAllByType('button')
        .find((button) => button.props.children?.some?.((child) => child === 'Save'))
        .props.onClick();
    });
    assert.equal(editor.submitted[0].userIds[0], 'one');
    assert.equal(editor.root.findAllByProps({ type: 'checkbox' })[0].props.disabled, true);
    await act(async () => {
      release();
    });
    assert.equal(editor.root.findAllByProps({ type: 'checkbox' })[0].props.disabled, false);
  } finally {
    editor.unmount();
  }
});

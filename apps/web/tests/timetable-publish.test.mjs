import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const React = require('react');
const ts = require('typescript');
const mobileRequire = createRequire(new URL('../../mobile/package.json', import.meta.url));
const { act, create } = mobileRequire('react-test-renderer');
const filename = new URL(
  '../src/components/timetable/student-timetable-editor.tsx',
  import.meta.url,
);
const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

function loadEditor() {
  const exports = {};
  const stub = (tag) => (props) => React.createElement(tag, props, props.children);
  const imports = {
    '@oasis/domain': { TIMETABLE_DAYS: ['Tuesday', 'Wednesday', 'Thursday', 'Friday'] },
    '@/components/ui/button': { Button: stub('button') },
    '@/components/ui/field': { Field: stub('label'), TextInput: stub('input') },
    './timetable-grid': { TimetableGrid: stub('test-grid') },
    './timetable-format': { timetableCellKey: (day, slot) => `${day}:${slot}` },
    './timetable.module.css': { default: {} },
  };
  vm.runInNewContext(compiled, {
    exports,
    require: (name) => imports[name] ?? require(name),
  });
  return exports.StudentTimetableEditor;
}

const Editor = loadEditor();
const draft = {
  student: { id: 'child', firstName: 'Child' },
  entries: [],
  subjects: [],
  timetableId: null,
};
const slots = [{ id: 'lesson', kind: 'Lesson', position: 0 }];

test('publishing a new timetable saves the on-screen selections before publishing', async () => {
  const calls = [];
  let finishSave;
  let renderer;
  await act(async () => {
    renderer = create(
      React.createElement(Editor, {
        draft,
        slots,
        pendingAction: null,
        publicationId: null,
        onSave: (entries) => {
          calls.push(['save', JSON.parse(JSON.stringify(entries))]);
          return new Promise((resolve) => {
            finishSave = resolve;
          });
        },
        onPublish: async () => {
          calls.push(['publish']);
        },
        onAddSubject: async () => {},
      }),
    );
  });
  await act(async () => {
    renderer.root.findByType('test-grid').props.onSubjectChange('Tuesday', 'lesson', 'math');
  });
  await act(async () => {
    renderer.root.findAllByType('button').at(-1).props.onClick();
  });
  assert.deepEqual(calls, [['save', [{ day: 'Tuesday', slotId: 'lesson', subjectId: 'math' }]]]);
  assert.equal(renderer.root.findAllByType('button').at(-1).props.disabled, true);
  await act(async () => {
    finishSave();
  });
  assert.deepEqual(calls.at(-1), ['publish']);
  assert.equal(renderer.root.findAllByType('button').at(-1).props.disabled, false);
  renderer.unmount();
});

test('a failed draft save prevents publishing and releases the action controls', async () => {
  let published = false;
  let renderer;
  await act(async () => {
    renderer = create(
      React.createElement(Editor, {
        draft,
        slots,
        pendingAction: null,
        publicationId: null,
        onSave: async () => {
          throw new Error('Save failed');
        },
        onPublish: async () => {
          published = true;
        },
        onAddSubject: async () => {},
      }),
    );
  });
  await act(async () => {
    renderer.root.findAllByType('button').at(-1).props.onClick();
  });
  assert.equal(published, false);
  assert.equal(renderer.root.findAllByType('button').at(-1).props.disabled, false);
  renderer.unmount();
});

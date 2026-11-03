import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import { mount } from './helpers/live-form-renderer.mjs';

const require = createRequire(import.meta.url);
const { act } = require('react-test-renderer');
const ts = require('typescript');

const student = {
  id: 'one',
  fullName: 'Original',
  dob: '2018-01-01',
  yearGroup: 'Year 1',
  enrolmentDate: '2020-01-01',
  address: 'Old',
  subjects: [],
};

function loadSource(relative, imports = {}) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL(relative, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, { exports, require: (key) => imports[key] ?? require(key) });
  return exports;
}

const schoolYears = loadSource('../../../packages/domain/src/schoolYears.ts');
const schoolReferenceDate = new Date('2026-11-03T12:00:00.000Z');
const fieldComponents = loadSource('../src/components/ui/field.tsx');
const studentLevelImports = {
  '@/components/ui/field': fieldComponents,
  '@oasis/domain': schoolYears,
  '@/lib/realtime/school-clock': { useSchoolNow: () => schoolReferenceDate },
};
studentLevelImports['@/components/students/student-level-field'] = loadSource(
  '../src/components/students/student-level-field.tsx',
  studentLevelImports,
);

for (const [name, path, component, initial, props] of [
  ['new', 'app/(admin)/admin/students/new/new-student-form.tsx', 'NewStudentForm', {}, {}],
  [
    'edit',
    'app/(admin)/admin/students/[id]/student-admin-editor.tsx',
    'StudentAdminEditor',
    { ...student, _loading: false },
    { studentId: 'one' },
  ],
]) {
  test(`${name} student level follows DOB in automatic mode`, async () => {
    const panel = mount(path, component, initial, props, studentLevelImports);
    try {
      act(() => panel.form.setValue('dob', '2014-08-31', { shouldDirty: true }));
      const level = () =>
        panel.root.findAll(
          (node) => node.props.readOnly === true && node.props.value === 'Level 7',
        );
      assert.ok(level().length > 0, 'the displayed read-only level follows the entered DOB');
      assert.equal(panel.form.getValues('yearGroup'), undefined);
      act(() => panel.form.setValue('dob', '2000-01-01', { shouldDirty: true }));
      assert.ok(
        panel.root.findAll(
          (node) => node.props.readOnly === true && node.props.value === 'Outside school age',
        ).length > 0,
      );
      act(() => panel.form.setValue('dob', '', { shouldDirty: true }));
      assert.ok(
        panel.root.findAll(
          (node) => node.props.readOnly === true && node.props.value === 'DOB required',
        ).length > 0,
      );
      act(() => panel.form.setValue('dob', '2014-08-31', { shouldDirty: true }));
      if (name === 'edit') {
        panel.update({ ...student, _loading: false, dob: '2018-01-01', address: 'Updated' });
        assert.equal(panel.form.getValues('dob'), '2014-08-31');
        assert.ok(level().length > 0, 'live snapshots must preserve the dirty DOB and its level');
      }
      await act(async () =>
        panel.root.findAllByType('form')[0].props.onSubmit({ preventDefault() {} }),
      );
      assert.equal(panel.mutations.input.dob.toISOString().slice(0, 10), '2014-08-31');
      assert.equal(Object.hasOwn(panel.mutations.input, 'yearGroup'), false);
      assert.equal(panel.mutations.input.yearGroupOverride, null);
    } finally {
      panel.unmount();
    }
  });
}

test('school date inputs reject rolled-over dates and use the supplied school clock', () => {
  assert.equal(
    schoolYears.resolveSchoolYearForDob('2018-02-31', schoolReferenceDate),
    'DOB required',
  );
  assert.equal(schoolYears.resolveSchoolYearForDob('2014-09-01', schoolReferenceDate), 'Year 7');
  assert.equal(
    schoolYears.resolveSchoolYearForDob('2014-09-01', new Date('2027-09-01T00:00:00.000Z')),
    'Year 8',
  );
});

for (const [name, path, component, initial, props] of [
  ['new', 'app/(admin)/admin/students/new/new-student-form.tsx', 'NewStudentForm', {}, {}],
  [
    'edit',
    'app/(admin)/admin/students/[id]/student-admin-editor.tsx',
    'StudentAdminEditor',
    { ...student, _loading: false, yearGroupOverride: null },
    { studentId: 'one' },
  ],
]) {
  test(`${name} student manual level survives DOB changes and resets explicitly to automatic`, async () => {
    let schoolNow = schoolReferenceDate;
    const panel = mount(path, component, initial, props, {
      ...studentLevelImports,
      '@/lib/realtime/school-clock': { useSchoolNow: () => schoolNow },
    });
    try {
      act(() => panel.form.setValue('dob', '2014-09-01', { shouldDirty: true }));
      const modes = () =>
        panel.root.findAll((node) => node.type === 'select' && node.props.name === 'levelMode');
      assert.equal(modes().length, 1, 'staff can choose automatic or manual level placement');
      act(() => modes()[0].props.onChange({ target: { value: 'manual' } }));
      const level = () =>
        panel.root.findAll(
          (node) => node.type === 'select' && node.props.name === 'yearGroupOverride',
        );
      act(() => level()[0].props.onChange({ target: { value: 'Year 3' } }));
      act(() => panel.form.setValue('dob', '2012-09-01', { shouldDirty: true }));
      schoolNow = new Date('2027-09-01T12:00:00.000Z');
      panel.update(name === 'edit' ? { ...initial, address: 'Updated snapshot' } : {});
      assert.equal(level()[0].props.value, 'Year 3');
      await act(async () =>
        panel.root.findAllByType('form')[0].props.onSubmit({ preventDefault() {} }),
      );
      assert.equal(panel.mutations.input.yearGroupOverride, 'Year 3');
      assert.equal(panel.mutations.input.dob.toISOString().slice(0, 10), '2012-09-01');
      if (name === 'edit') {
        await act(async () => panel.mutations.studentSave({}, { id: 'one' }));
        panel.update({ ...initial, dob: '2012-09-01', yearGroupOverride: 'Year 3' });
        assert.equal(level()[0].props.value, 'Year 3');
      }
      act(() => modes()[0].props.onChange({ target: { value: 'automatic' } }));
      await act(async () =>
        panel.root.findAllByType('form')[0].props.onSubmit({ preventDefault() {} }),
      );
      assert.equal(panel.mutations.input.yearGroupOverride, null);
      assert.equal(level().length, 0);
      assert.ok(
        panel.root.findAll(
          (node) =>
            node.type === 'input' && node.props.readOnly === true && node.props.value === 'Level 9',
        ).length > 0,
      );
      if (name === 'edit') {
        await act(async () => panel.mutations.studentSave({}, { id: 'one' }));
        panel.update({ ...initial, dob: '2012-09-01', yearGroupOverride: null });
        assert.equal(modes()[0].props.value, 'automatic');
      }
    } finally {
      panel.unmount();
    }
  });
}

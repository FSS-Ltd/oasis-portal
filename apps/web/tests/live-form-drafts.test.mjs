import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const React = require('react');
const { act, create } = require('react-test-renderer');
const ts = require('typescript');
const rhf = require('react-hook-form');
const stub = (props) => React.createElement('div', props, props.children);
function mount(path, name, initial, props = {}, extra = {}) {
  let data = initial;
  let form;
  const mutations = {};
  const apiNode = (path = '') =>
    new Proxy(() => {}, {
      get(_, key) {
        if (key === 'useQuery')
          return () => ({
            data,
            isLoading: data._loading ?? true,
            refetch: async () => ({ data }),
          });
        if (key === 'useMutation')
          return (options) => {
            if (path === '.student.update' && !mutations.studentSave)
              mutations.studentSave = options.onSuccess;
            mutations[path] = options;
            return {
              isPending: false,
              mutate(input) {
                mutations.input = input;
              },
            };
          };
        if (key === 'useUtils') return () => apiNode();
        if (key === 'invalidate' || key === 'refetch') return async () => {};
        return apiNode(`${path}.${String(key)}`);
      },
    });
  const imports = {
    'react-hook-form': {
      ...rhf,
      useForm(options) {
        form = rhf.useForm(options);
        return form;
      },
    },
    '@hookform/resolvers/zod': { zodResolver: () => undefined },
    '@oasis/domain/portal-visibility': { CLUBS_VISIBLE: false },
    '@oasis/domain': {
      STANDARD_SCHOOL_YEARS: ['Year 1'],
      canonicalSchoolYear: (v) => v,
      PACE_CATALOGUE: Array.from({ length: 144 }, (_, i) => 1001 + i),
      ADULT_USER_ACCOUNT_ROLES: ['Parent'],
      PARENT_EMAIL_NOTIFICATION_CATEGORIES: [],
    },
    '@/lib/trpc': { api: apiNode() },
    '@/lib/school-year-form': { deriveSchoolYearFromDateInput: () => null },
    'next/navigation': { useRouter: () => ({ replace() {}, push() {} }) },
    'lucide-react': new Proxy({}, { get: () => stub }),
    ...extra,
  };
  const exports = {};
  const code = ts.transpileModule(
    readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8'),
    {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
      },
    },
  ).outputText;
  vm.runInNewContext(code, {
    exports,
    require: (key) =>
      imports[key] ??
      (key.startsWith('@/') || key.startsWith('./')
        ? new Proxy({}, { get: () => stub })
        : require(key)),
  });
  let renderer;
  const element = () => React.createElement(exports[name], props);
  act(() => {
    renderer = create(element());
  });
  return {
    get root() {
      return renderer.root;
    },
    get form() {
      return form;
    },
    mutations,
    update(next, nextProps = props) {
      data = next;
      props = nextProps;
      act(() => renderer.update(element()));
    },
    unmount() {
      act(() => renderer.unmount());
    },
  };
}
const student = {
  id: 'one',
  fullName: 'Original',
  dob: '2018-01-01',
  yearGroup: 'Year 1',
  enrolmentDate: '2020-01-01',
  address: 'Old',
  subjects: [],
};
test('rendered student form preserves dirty personal fields and refreshes untouched fields', () => {
  const panel = mount(
    'app/(admin)/admin/students/[id]/student-admin-editor.tsx',
    'StudentAdminEditor',
    student,
    { studentId: 'one' },
  );
  try {
    act(() => panel.form.setValue('fullName', 'Draft', { shouldDirty: true }));
    panel.update({ ...student, address: 'New' });
    assert.equal(panel.form.getValues('fullName'), 'Draft');
    assert.equal(panel.form.getValues('address'), 'New');
    panel.update({ ...student, id: 'two', fullName: 'Second' }, { studentId: 'two' });
    assert.equal(panel.form.getValues('fullName'), 'Second');
  } finally {
    panel.unmount();
  }
});
const blank = () => ({
  homeAddress: 'Old',
  guardianContacts: [],
  emergencyContacts: [],
  pickupContacts: [],
  students: [{ fullName: 'Existing' }],
  agreement: { guardianName: 'Guardian', agreementDate: '2026-01-01' },
});
test('rendered registration preserves dirty arrays including added rows across live refresh', () => {
  const imports = {
    './registration-form-model': {
      blankRegistrationValues: blank,
      loadRegistrationDraftValues: blank,
      registrationValuesFromServer: (v) => v.values,
      siblingValuesFromServer: (v) => v.values,
    },
  };
  const panel = mount(
    'app/registration/registration-form.tsx',
    'RegistrationForm',
    { registrationId: 'one', values: blank() },
    { mode: 'edit' },
    imports,
  );
  try {
    act(() =>
      panel.form.setValue('students', [{ fullName: 'Edited' }, { fullName: 'New sibling' }], {
        shouldDirty: true,
      }),
    );
    panel.update({ registrationId: 'one', values: { ...blank(), homeAddress: 'New' } });
    assert.deepEqual(panel.form.getValues('students'), [
      { fullName: 'Edited' },
      { fullName: 'New sibling' },
    ]);
    assert.equal(panel.form.getValues('homeAddress'), 'New');
    panel.update({ registrationId: 'two', values: blank() });
    assert.equal(panel.form.getValues('students').length, 1);
  } finally {
    panel.unmount();
  }
});

const profile = {
  _loading: false,
  id: 'one',
  fullName: 'Original',
  email: 'one@example.test',
  phone: '111',
  address: 'Old',
  role: 'Parent',
  children: [],
  tags: [],
  createdAt: '2026-01-01',
  emailNotificationPreferences: { enabled: true, optedOutCategories: [] },
};
function click(panel, text) {
  act(() =>
    panel.root
      .findAll(
        (node) => node.props.children === text && typeof node.props.onClick === 'function',
      )[0]
      .props.onClick(),
  );
}
function valueNode(panel, value) {
  return panel.root.findAll(
    (node) => node.props.value === value && typeof node.props.onChange === 'function',
  )[0];
}
test('rendered self profile retains dirty contact fields and adopts untouched fields', () => {
  const panel = mount('components/profile/self-profile-client.tsx', 'SelfProfileClient', profile);
  try {
    click(panel, 'Edit Profile');
    act(() => valueNode(panel, 'Original').props.onChange({ target: { value: 'Draft' } }));
    panel.update({ ...profile, address: 'New' });
    assert.ok(valueNode(panel, 'Draft'));
    assert.ok(valueNode(panel, 'New'));
    click(panel, 'Cancel');
    assert.ok(valueNode(panel, 'Original'));
  } finally {
    panel.unmount();
  }
});
const plan = {
  id: 'plan-one',
  version: 1,
  status: 'Active',
  jumpToPaceNumber: 1010,
  items: [{ paceNumber: 1001, removed: false, completed: false }],
};
const gap = { _loading: false, currentPaceNumber: 1001, completedPaceNumbers: [], plans: [plan] };
test('rendered gap plan preserves edited destination and its original optimistic version', () => {
  const panel = mount('components/pace/pace-gap-plan-panel.tsx', 'PaceGapPlanPanel', gap, {
    studentId: 'one',
    subjectId: 'math',
  });
  try {
    act(() => valueNode(panel, '1010').props.onChange({ target: { value: '1012' } }));
    panel.update({ ...gap, plans: [{ ...plan, version: 2, jumpToPaceNumber: 1011 }] });
    assert.ok(valueNode(panel, '1012'));
    click(panel, 'Save Changes');
    assert.equal(panel.mutations.input.expectedVersion, 1);
    assert.equal(panel.mutations.input.jumpToPaceNumber, 1012);
  } finally {
    panel.unmount();
  }
});

test('student save releases dirty baseline for subsequent live updates', async () => {
  const panel = mount(
    'app/(admin)/admin/students/[id]/student-admin-editor.tsx',
    'StudentAdminEditor',
    student,
    { studentId: 'one' },
  );
  try {
    act(() => panel.form.setValue('fullName', 'Saved', { shouldDirty: true }));
    await act(async () => panel.mutations.studentSave({}, { id: 'one' }));
    panel.update({ ...student, fullName: 'Latest' });
    assert.equal(panel.form.getValues('fullName'), 'Latest');
  } finally {
    panel.unmount();
  }
});
test('registration preserves removal of all optional contact rows', () => {
  const values = { ...blank(), pickupContacts: [{ fullName: 'Pickup' }] };
  const imports = {
    './registration-form-model': {
      blankRegistrationValues: blank,
      loadRegistrationDraftValues: blank,
      registrationValuesFromServer: (v) => v.values,
      siblingValuesFromServer: (v) => v.values,
    },
  };
  const panel = mount(
    'app/registration/registration-form.tsx',
    'RegistrationForm',
    { registrationId: 'one', values },
    { mode: 'edit' },
    imports,
  );
  try {
    act(() => panel.form.setValue('pickupContacts', [], { shouldDirty: true }));
    panel.update({ registrationId: 'one', values: { ...values, homeAddress: 'Refreshed' } });
    assert.equal(panel.form.getValues('pickupContacts').length, 0);
    assert.equal(panel.form.getValues('homeAddress'), 'Refreshed');
    panel.update({ registrationId: 'one', values }, { mode: 'sibling' });
    assert.equal(panel.form.getValues('pickupContacts').length, 1);
  } finally {
    panel.unmount();
  }
});
test('self profile resets drafts on account change', () => {
  const panel = mount('components/profile/self-profile-client.tsx', 'SelfProfileClient', profile);
  try {
    click(panel, 'Edit Profile');
    act(() => valueNode(panel, 'Original').props.onChange({ target: { value: 'Draft' } }));
    panel.update({ ...profile, id: 'two', fullName: 'Second' });
    assert.ok(valueNode(panel, 'Second'));
    assert.equal(valueNode(panel, 'Draft'), undefined);
  } finally {
    panel.unmount();
  }
});
test('gap plan keeps edited selections but refreshes untouched destination', () => {
  const panel = mount('components/pace/pace-gap-plan-panel.tsx', 'PaceGapPlanPanel', gap, {
    studentId: 'one',
    subjectId: 'math',
  });
  try {
    const checkbox = panel.root
      .findAllByType('input')
      .find((node) => node.props.type === 'checkbox' && !node.props.checked);
    act(() => checkbox.props.onChange({ target: { checked: true } }));
    panel.update({ ...gap, plans: [{ ...plan, version: 2, jumpToPaceNumber: 1011 }] });
    assert.ok(valueNode(panel, '1011'));
    click(panel, 'Save Changes');
    assert.ok(
      panel.mutations.input,
      panel.root
        .findAllByType('p')
        .map((node) => String(node.props.children))
        .join(' | '),
    );
    assert.equal(panel.mutations.input.remainingPaceNumbers.length, 2);
    assert.equal(panel.mutations.input.expectedVersion, 1);
    panel.update(
      { ...gap, plans: [{ ...plan, id: 'second', version: 8, jumpToPaceNumber: 1020 }] },
      { studentId: 'two', subjectId: 'math' },
    );
    assert.ok(valueNode(panel, '1020'));
    click(panel, 'Save Changes');
    assert.equal(panel.mutations.input.expectedVersion, 8);
  } finally {
    panel.unmount();
  }
});

test('late student save cannot clear another student draft', async () => {
  const panel = mount(
    'app/(admin)/admin/students/[id]/student-admin-editor.tsx',
    'StudentAdminEditor',
    student,
    { studentId: 'one' },
  );
  try {
    panel.update({ ...student, id: 'two' }, { studentId: 'two' });
    act(() => panel.form.setValue('fullName', 'Second draft', { shouldDirty: true }));
    await act(async () => panel.mutations.studentSave({}, { id: 'one' }));
    panel.update({ ...student, id: 'two', address: 'New' });
    assert.equal(panel.form.getValues('fullName'), 'Second draft');
  } finally {
    panel.unmount();
  }
});
test('late gap save cannot clear another assignment draft', async () => {
  const panel = mount('components/pace/pace-gap-plan-panel.tsx', 'PaceGapPlanPanel', gap, {
    studentId: 'one',
    subjectId: 'math',
  });
  try {
    const saved = panel.mutations['.academicInventory.updateGapPlan'].onSuccess;
    panel.update(
      { ...gap, plans: [{ ...plan, id: 'second' }] },
      { studentId: 'two', subjectId: 'math' },
    );
    act(() => valueNode(panel, '1010').props.onChange({ target: { value: '1012' } }));
    await act(async () => saved({}, { planId: 'plan-one' }));
    assert.ok(valueNode(panel, '1012'));
  } finally {
    panel.unmount();
  }
});
test('late profile save cannot reset another account draft', async () => {
  const panel = mount('components/profile/self-profile-client.tsx', 'SelfProfileClient', profile);
  try {
    click(panel, 'Edit Profile');
    act(() => valueNode(panel, 'Original').props.onChange({ target: { value: 'First saved' } }));
    act(() => panel.root.findByType('form').props.onSubmit({ preventDefault() {} }));
    const saved = panel.mutations['.profile.updateMe'].onSuccess;
    panel.update({ ...profile, id: 'two', fullName: 'Second' });
    click(panel, 'Edit Profile');
    act(() => valueNode(panel, 'Second').props.onChange({ target: { value: 'Second draft' } }));
    await act(async () =>
      saved(
        {},
        {
          fullName: 'First saved',
          email: profile.email,
          phone: profile.phone,
          address: profile.address,
        },
      ),
    );
    assert.ok(valueNode(panel, 'Second draft'));
    panel.update({ ...profile, id: 'two', fullName: 'Second', address: 'New' });
    assert.ok(valueNode(panel, 'Second draft'));
  } finally {
    panel.unmount();
  }
});

test('notification preference drafts survive unrelated live profile refresh', () => {
  const panel = mount('components/profile/self-profile-client.tsx', 'SelfProfileClient', profile);
  try {
    click(panel, 'Email Notifications');
    act(() => panel.root.findByType('input').props.onChange({ target: { checked: false } }));
    panel.update({ ...profile, address: 'New' });
    assert.equal(panel.root.findByType('input').props.checked, false);
    panel.update({ ...profile, id: 'two' });
    assert.equal(panel.root.findByType('input').props.checked, true);
  } finally {
    panel.unmount();
  }
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const React = require('react');
const ts = require('typescript');
const { act, create } = require('react-test-renderer');
const filename = new URL(
  '../src/app/(admin)/admin/access/access-account-panel.tsx',
  import.meta.url,
);
const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const initialAccount = {
  id: 'account-one',
  fullName: 'Original Name',
  email: null,
  phone: '111',
  address: 'Original address',
  role: 'Parent',
  tags: [],
  active: true,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

function renderPanel() {
  const exports = {};
  const stub = (tag) => (props) => React.createElement(tag, props, props.children);
  const submitted = [];
  const profile = {
    isPending: false,
    error: null,
    mutate(input) {
      submitted.push(input);
    },
  };
  let onSuccess;
  let invalidate = async () => {};
  const mutation = { useMutation: () => ({ isPending: false, error: null, mutate() {} }) };
  const imports = {
    '@oasis/domain': {
      ADULT_USER_ACCOUNT_ROLES: ['Parent'],
      PERMISSION_TAGS: [],
      canAssignPermissionTag: () => true,
    },
    'lucide-react': Object.fromEntries(
      ['Mail', 'MapPin', 'Phone', 'Save', 'ShieldCheck', 'UserCheck', 'UserX'].map((name) => [
        name,
        stub('svg'),
      ]),
    ),
    '@/components/compliance/compliance-badges': { ComplianceBadges: () => null },
    '@/components/admin/confirmation-dialog': { ConfirmationDialog: stub('confirmation') },
    '@/components/ui/avatar': { Avatar: () => null },
    '@/components/ui/badge': { Badge: stub('span') },
    '@/components/ui/button': { Button: stub('button') },
    '@/components/ui/field': {
      Field: stub('label'),
      TextInput: stub('input'),
      SelectInput: stub('select'),
    },
    '@/lib/notifications': {
      friendlyErrorMessage: String,
      showErrorToast() {},
      showSuccessToast() {},
    },
    '@/lib/profile-display': { permissionTagLabel: String, roleLabel: String },
    '@/lib/trpc': {
      api: {
        useUtils: () => ({
          admin: {
            listUserAccounts: { invalidate: () => invalidate() },
            listUsers: { invalidate: async () => {} },
          },
        }),
        admin: {
          updateUserAccountProfile: {
            useMutation: (options) => {
              onSuccess = options.onSuccess;
              return profile;
            },
          },
          updateUserAccountStatus: mutation,
          updateUserRole: mutation,
          updateUserTags: mutation,
        },
      },
    },
    './access-account-model': {
      accountForm: (account) => ({
        fullName: account.fullName,
        phone: account.phone ?? '',
        address: account.address ?? '',
      }),
      formatAccountDate: () => '1 Jan 2026',
      statusTone: () => 'green',
    },
  };
  vm.runInNewContext(compiled, { exports, require: (name) => imports[name] ?? require(name) });
  const element = (account) =>
    React.createElement(exports.AccessAccountPanel, {
      account,
      currentUserId: 'operator',
      complianceSummary: null,
    });
  let renderer;
  act(() => {
    renderer = create(element(initialAccount));
  });
  const input = (label) =>
    renderer.root
      .find((node) => node.type === 'label' && node.props.label === label)
      .findByType('input');
  return {
    profile,
    input,
    submitted,
    submit() {
      act(() => renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }));
    },
    update(account) {
      act(() => {
        renderer.update(element(account));
      });
    },
    change(label, value) {
      act(() => {
        input(label).props.onChange({ target: { value } });
      });
    },
    click(text) {
      act(() => {
        renderer.root
          .find((node) => node.type === 'button' && node.props.children === text)
          .props.onClick();
      });
    },
    setInvalidate(callback) {
      invalidate = callback;
    },
    success() {
      return onSuccess;
    },
    unmount() {
      act(() => renderer.unmount());
    },
  };
}

test('same-account snapshots preserve edited fields and editing mode while refreshing untouched fields', () => {
  const panel = renderPanel();
  try {
    panel.click('Edit Profile');
    panel.change('Full name', 'Unsaved name');
    panel.change('Address', '');
    panel.update({
      ...initialAccount,
      phone: '222',
      address: 'Server address',
      tags: ['club-lead'],
      active: false,
    });
    assert.equal(panel.input('Full name').props.value, 'Unsaved name');
    assert.equal(panel.input('Full name').props.disabled, false);
    assert.equal(panel.input('Phone').props.value, '222');
    assert.equal(panel.input('Address').props.value, '');
    panel.submit();
    assert.deepEqual(JSON.parse(JSON.stringify(panel.submitted[0])), {
      userId: initialAccount.id,
      fullName: 'Unsaved name',
      phone: '222',
      address: '',
    });
    panel.change('Full name', initialAccount.fullName);
    panel.update({ ...initialAccount, fullName: 'New server name' });
    assert.equal(panel.input('Full name').props.value, 'New server name');
  } finally {
    panel.unmount();
  }
});

test('cancel adopts the latest snapshot and switching accounts clears the previous edit', () => {
  const panel = renderPanel();
  try {
    panel.click('Edit Profile');
    panel.change('Full name', 'Unsaved name');
    panel.update({ ...initialAccount, fullName: 'Server name' });
    panel.click('Cancel');
    assert.equal(panel.input('Full name').props.value, 'Server name');
    assert.equal(panel.input('Full name').props.disabled, true);
    panel.click('Edit Profile');
    panel.change('Full name', 'Another draft');
    panel.update({ ...initialAccount, id: 'account-two', fullName: 'Second account' });
    assert.equal(panel.input('Full name').props.value, 'Second account');
    assert.equal(panel.input('Full name').props.disabled, true);
    panel.click('Edit Profile');
    panel.submit();
    assert.equal(panel.submitted[0].userId, 'account-two');
    assert.equal(panel.submitted[0].fullName, 'Second account');
  } finally {
    panel.unmount();
  }
});

test('a successful save adopts refreshed data and permits subsequent snapshots', async () => {
  const panel = renderPanel();
  try {
    panel.click('Edit Profile');
    panel.change('Full name', 'Saved name ');
    panel.profile.isPending = true;
    panel.update(initialAccount);
    assert.equal(panel.input('Full name').props.disabled, true);
    panel.setInvalidate(async () => {
      panel.update({ ...initialAccount, fullName: 'Saved name' });
    });
    await act(async () => {
      await panel.success()();
    });
    assert.equal(panel.input('Full name').props.value, 'Saved name');
    panel.profile.isPending = false;
    panel.update({ ...initialAccount, fullName: 'Later server name' });
    assert.equal(panel.input('Full name').props.value, 'Later server name');
  } finally {
    panel.unmount();
  }
});

test('a late save callback from another account cannot discard the current draft', async () => {
  const panel = renderPanel();
  try {
    const finishFirstSave = panel.success();
    panel.update({ ...initialAccount, id: 'account-two', fullName: 'Second account' });
    panel.click('Edit Profile');
    panel.change('Full name', 'Second draft');
    await act(async () => {
      await finishFirstSave();
    });
    assert.equal(panel.input('Full name').props.value, 'Second draft');
    assert.equal(panel.input('Full name').props.disabled, false);
  } finally {
    panel.unmount();
  }
});

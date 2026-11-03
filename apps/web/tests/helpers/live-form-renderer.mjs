import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const React = require('react');
const { act, create } = require('react-test-renderer');
const ts = require('typescript');
const rhf = require('react-hook-form');
const stub = (props) => React.createElement('div', props, props.children);

export function mount(path, name, initial, props = {}, extra = {}) {
  let data = initial;
  let form;
  const mutations = {};
  const apiNode = (path = '') =>
    new Proxy(() => {}, {
      get(_, key) {
        if (key === 'useQuery')
          return () => ({
            data: ['.admin.listActiveSubjects', '.admin.searchGuardianAccounts'].includes(path)
              ? []
              : data,
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
      resolveSchoolYearForDob: () => 'Year 1',
      displaySchoolYearLabel: (value) => value.replace('Year ', 'Level '),
      PACE_CATALOGUE: Array.from({ length: 144 }, (_, i) => 1001 + i),
      ADULT_USER_ACCOUNT_ROLES: ['Parent'],
      PARENT_EMAIL_NOTIFICATION_CATEGORIES: [],
    },
    '@/lib/trpc': { api: apiNode() },
    '@/lib/realtime/school-clock': { useSchoolNow: () => new Date('2026-11-03T12:00:00.000Z') },
    'next/navigation': { useRouter: () => ({ replace() {}, push() {} }) },
    'lucide-react': new Proxy({}, { get: () => stub }),
    ...extra,
  };
  const exports = {};
  const code = ts.transpileModule(
    readFileSync(new URL(`../../src/${path}`, import.meta.url), 'utf8'),
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
    structuredClone,
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

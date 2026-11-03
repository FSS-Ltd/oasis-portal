import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const React = require('react');
const { act, create } = require('react-test-renderer');
const { useForm } = require('react-hook-form');
const ts = require('typescript');
const exports = {};
const compiled = ts.transpileModule(
  readFileSync(new URL('../src/components/ui/field.tsx', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } },
).outputText;
vm.runInNewContext(compiled, { exports, require });
const { TextInput, SelectInput } = exports;

for (const [name, Component, tag] of [
  ['text input', TextInput, 'input'],
  ['select input', SelectInput, 'select'],
]) {
  test(`${name} exposes its native field ref and clears it on unmount`, () => {
    const ref = React.createRef();
    const nativeField = { tagName: tag.toUpperCase() };
    let renderer;
    act(() => {
      renderer = create(React.createElement(Component, { ref, name: 'field' }), {
        createNodeMock: ({ type }) => (type === tag ? nativeField : null),
      });
    });
    try {
      assert.equal(ref.current, nativeField);
    } finally {
      act(() => renderer.unmount());
    }
    assert.equal(ref.current, null);
  });
}

test('a registered DOB input updates watched form data through its native ref', async () => {
  const nativeInput = { name: 'dob', type: 'date', value: '', focus() {} };
  function Form() {
    const { register, watch } = useForm({ defaultValues: { dob: '' } });
    return React.createElement(
      'form',
      null,
      React.createElement(TextInput, { type: 'date', ...register('dob') }),
      React.createElement('output', null, watch('dob')),
    );
  }
  let renderer;
  act(() => {
    renderer = create(React.createElement(Form), {
      createNodeMock: ({ type }) => (type === 'input' ? nativeInput : null),
    });
  });
  try {
    nativeInput.value = '2014-09-01';
    await act(async () => {
      await renderer.root.findByType('input').props.onChange({
        type: 'change',
        target: nativeInput,
      });
    });
    assert.deepEqual(renderer.root.findByType('output').children, ['2014-09-01']);
  } finally {
    act(() => renderer.unmount());
  }
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const React = require('react');
const { act, create } = require('react-test-renderer');
const ts = require('typescript');

test('book edits submit updated details without replacing the cover or losing identity', () => {
  let saved;
  const code = ts.transpileModule(
    readFileSync(
      new URL('../src/components/library/library-book-editor.tsx', import.meta.url),
      'utf8',
    ),
    {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    },
  ).outputText;
  const exports = {};
  vm.runInNewContext(code, {
    exports,
    require: (key) =>
      key === '@oasis/domain'
        ? {
            LIBRARY_BOOK_COLLECTIONS: ['General', 'RhinoReaders'],
            LIBRARY_BOOK_COLLECTION_LABELS: { General: 'Library', RhinoReaders: 'Rhino Readers' },
          }
        : key === '@/lib/trpc'
          ? {
              api: {
                library: {
                  updateBook: {
                    useMutation: () => ({
                      mutate: (input) => {
                        saved = input;
                      },
                      isPending: false,
                    }),
                  },
                },
              },
            }
          : require(key),
  });
  let renderer;
  act(() => {
    renderer = create(
      React.createElement(exports.LibraryBookEditor, {
        book: {
          id: 'book',
          title: 'Original',
          collection: 'General',
          author: 'Author',
          barcode: '123',
          quantity: 2,
          loanedCopies: 1,
        },
        onCancel() {},
        async onSaved() {},
      }),
    );
  });
  const inputs = renderer.root.findAllByType('input');
  assert.equal(inputs[2].props.disabled, true);
  assert.equal(inputs[3].props.min, 1);
  act(() => inputs[0].props.onChange({ target: { value: 'Edited title' } }));
  act(() =>
    renderer.root.findByType('select').props.onChange({ target: { value: 'RhinoReaders' } }),
  );
  act(() => renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }));
  assert.deepEqual(JSON.parse(JSON.stringify(saved)), {
    id: 'book',
    title: 'Edited title',
    collection: 'RhinoReaders',
    author: 'Author',
    barcode: '123',
    quantity: 2,
  });
  act(() => renderer.unmount());
});

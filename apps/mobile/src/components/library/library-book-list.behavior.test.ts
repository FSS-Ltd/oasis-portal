import { createElement } from 'react';
import { expect, it, vi } from 'vitest';
import { mobileTestRenderer } from '../../test-utils/mobile-test-renderer';
import { LibraryBookList } from './library-book-list';

vi.mock('react-native', () => ({
  Image: 'Image',
  Pressable: 'Pressable',
  Text: 'Text',
  View: 'View',
  StyleSheet: { create: <T>(styles: T) => styles },
}));

it('keeps covers hidden until a book is opened and exposes remaining stock', () => {
  let selected = '';
  const renderer = mobileTestRenderer.create(
    createElement(LibraryBookList, {
      books: [
        {
          id: 'book',
          title: 'A book',
          author: 'An author',
          coverUrl: 'https://example.com/book.jpg',
          quantity: 2,
          availableCopies: 1,
          loanedCopies: 1,
        },
      ],
      onSelect: (id) => {
        selected = id;
      },
    }),
  );
  expect(JSON.stringify(renderer.toJSON())).not.toContain('https://example.com/book.jpg');
  const row = () =>
    renderer.root.find((node) => node.type === 'Pressable').props as {
      onPress: () => void;
      accessibilityState: { expanded: boolean };
      accessibilityLabel: string;
    };
  expect(row().accessibilityLabel).toContain('1 of 2 available');
  mobileTestRenderer.act(() => {
    row().onPress();
  });
  expect(row().accessibilityState.expanded).toBe(true);
  expect(JSON.stringify(renderer.toJSON())).toContain('https://example.com/book.jpg');
  expect(selected).toBe('book');
  mobileTestRenderer.act(() => {
    row().onPress();
  });
  expect(JSON.stringify(renderer.toJSON())).not.toContain('https://example.com/book.jpg');
  renderer.unmount();
});

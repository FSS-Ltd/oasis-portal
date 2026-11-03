import {
  LIBRARY_BOOK_COLLECTIONS,
  LIBRARY_BOOK_COLLECTION_LABELS,
  type LibraryBookCollection,
} from '@oasis/domain';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { api, type RouterOutputs } from '../../lib/trpc';
import { C } from '../core/mobile-theme';
import { ErrorText, MobileButton, MutedText, SectionTitle } from '../core/mobile-ui';

type LibraryBook = NonNullable<RouterOutputs['library']['lookupBarcode']>;

export function LibraryBookEditor({
  book,
  onCancel,
  onSaved,
}: {
  book: LibraryBook;
  onCancel: () => void;
  onSaved: (barcode: string) => Promise<void>;
}) {
  const [collection, setCollection] = useState<LibraryBookCollection>(book.collection);
  const [title, setTitle] = useState(book.title);
  const [author, setAuthor] = useState(book.author);
  const [barcode, setBarcode] = useState(book.barcode);
  const [quantity, setQuantity] = useState(String(book.quantity));
  const update = api.library.updateBook.useMutation({
    onSuccess: async (result) => onSaved(result.barcode),
  });
  const count = Number(quantity);
  const valid =
    title.trim() &&
    author.trim() &&
    /^\d{1,64}$/.test(barcode) &&
    Number.isInteger(count) &&
    count >= Math.max(1, book.loanedCopies) &&
    count <= 1000;
  return (
    <View style={styles.form}>
      <SectionTitle>Edit book</SectionTitle>
      <Text style={styles.label}>Title</Text>
      <TextInput
        accessibilityLabel="Book title"
        maxLength={200}
        onChangeText={setTitle}
        style={styles.input}
        value={title}
      />
      <Text style={styles.label}>Author</Text>
      <TextInput
        accessibilityLabel="Book author"
        maxLength={200}
        onChangeText={setAuthor}
        style={styles.input}
        value={author}
      />
      <Text style={styles.label}>Book barcode</Text>
      <TextInput
        accessibilityLabel="Book barcode"
        editable={book.loanedCopies === 0}
        keyboardType="numeric"
        maxLength={64}
        onChangeText={setBarcode}
        style={styles.input}
        value={barcode}
      />
      {book.loanedCopies > 0 ? (
        <MutedText>Return all copies before changing the barcode.</MutedText>
      ) : null}
      <Text style={styles.label}>Quantity</Text>
      <TextInput
        accessibilityLabel="Book quantity"
        keyboardType="number-pad"
        onChangeText={setQuantity}
        style={styles.input}
        value={quantity}
      />
      <MutedText>
        Quantity must be at least {Math.max(1, book.loanedCopies)} and no more than 1,000.
      </MutedText>
      <Text style={styles.label}>Collection</Text>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="Book collection"
        style={styles.collections}
      >
        {LIBRARY_BOOK_COLLECTIONS.map((value) => (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ checked: value === collection }}
            key={value}
            onPress={() => {
              setCollection(value);
            }}
            style={[styles.choice, value === collection && styles.selectedChoice]}
          >
            <Text style={[styles.label, value === collection && styles.selectedLabel]}>
              {LIBRARY_BOOK_COLLECTION_LABELS[value]}
            </Text>
          </Pressable>
        ))}
      </View>
      {update.error ? <ErrorText>{update.error.message}</ErrorText> : null}
      <MobileButton
        disabled={!valid || update.isPending}
        label={update.isPending ? 'Saving…' : 'Save changes'}
        onPress={() => {
          update.mutate({ id: book.id, title, author, barcode, quantity: count, collection });
        }}
        variant="primary"
      />
      <MobileButton
        disabled={update.isPending}
        label="Cancel"
        onPress={onCancel}
        variant="secondary"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  collections: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: {
    minHeight: 44,
    justifyContent: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
  },
  selectedChoice: { backgroundColor: C.crimson, borderColor: C.crimson },
  selectedLabel: { color: C.surface },
  form: {
    gap: 10,
    backgroundColor: C.surface,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  label: { color: C.navy, fontSize: 13, fontWeight: '800' },
  input: {
    minHeight: 44,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 8,
    color: C.navy,
    fontSize: 16,
    paddingHorizontal: 12,
  },
});

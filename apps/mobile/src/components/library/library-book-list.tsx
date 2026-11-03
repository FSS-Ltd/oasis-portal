import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { C } from '../core/mobile-theme';

type CatalogueBook = {
  id: string;
  title: string;
  author: string;
  coverUrl: string;
  quantity: number;
  availableCopies: number;
  loanedCopies: number;
};

export function LibraryBookList({
  books,
  onSelect,
}: {
  books: readonly CatalogueBook[];
  onSelect?: (id: string) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  return (
    <View style={styles.list}>
      {books.map((book) => {
        const expanded = expandedId === book.id;
        return (
          <View key={book.id} style={styles.book}>
            <Pressable
              accessibilityLabel={`${book.title}, ${book.author}, ${String(book.availableCopies)} of ${String(book.quantity)} available`}
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              onPress={() => {
                setExpandedId(expanded ? null : book.id);
                if (!expanded) onSelect?.(book.id);
              }}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <View style={styles.copy}>
                <Text style={styles.title}>{book.title}</Text>
                <Text style={styles.author}>{book.author}</Text>
                <Text style={book.availableCopies > 0 ? styles.available : styles.onLoan}>
                  {book.availableCopies} of {book.quantity} available
                  {book.loanedCopies > 0 ? ` · ${String(book.loanedCopies)} on loan` : ''}
                </Text>
              </View>
              <Text accessibilityElementsHidden style={styles.chevron}>
                {expanded ? '−' : '+'}
              </Text>
            </Pressable>
            {expanded ? (
              <Image
                accessibilityLabel={`Cover of ${book.title}`}
                resizeMode="contain"
                source={{ uri: book.coverUrl }}
                style={styles.cover}
              />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8 },
  book: {
    backgroundColor: C.surface,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, padding: 14 },
  pressed: { backgroundColor: C.blueLight },
  copy: { flex: 1, gap: 4 },
  title: { color: C.navy, fontSize: 15, fontWeight: '800' },
  author: { color: C.textSecondary, fontSize: 13 },
  available: { color: C.success, fontSize: 12, fontWeight: '700' },
  onLoan: { color: C.warning, fontSize: 12, fontWeight: '700' },
  chevron: { color: C.navy, fontSize: 22 },
  cover: { alignSelf: 'center', height: 280, width: '100%', marginBottom: 14 },
});

import Feather from '@expo/vector-icons/Feather';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { C, elevation, radius, typeRamp } from '../core/mobile-theme';
import { MutedText } from '../core/mobile-ui';
import { Avatar } from './mobile-message-ui';
import type { ConversationKind, Recipient, RecipientGroup } from './mobile-message-types';

interface ContactsViewProps {
  accent: string;
  groups: RecipientGroup[];
  onBack: () => void;
  onSelect: (recipient: Recipient, kind: ConversationKind) => void;
}

/** The contacts page: pick a person and their conversation opens, as in Messages. */
export function ContactsView({ accent, groups, onBack, onSelect }: ContactsViewProps) {
  const [groupIndex, setGroupIndex] = useState(0);
  const [query, setQuery] = useState('');
  const group = groups[Math.min(groupIndex, Math.max(groups.length - 1, 0))];
  const contacts = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const all = group?.recipients ?? [];
    return needle
      ? all.filter((recipient) => recipient.fullName.toLowerCase().includes(needle))
      : all;
  }, [group, query]);

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityLabel="Cancel new message"
          accessibilityRole="button"
          hitSlop={8}
          onPress={onBack}
          style={({ pressed }) => [styles.cancel, pressed ? styles.pressed : null]}
        >
          <Text style={[styles.cancelText, { color: accent }]}>Cancel</Text>
        </Pressable>
        <Text accessibilityRole="header" style={styles.title}>
          New Message
        </Text>
        <View style={styles.cancel} />
      </View>

      {groups.length > 1 ? (
        <View accessibilityRole="tablist" style={styles.segments}>
          {groups.map((item, index) => {
            const active = index === groupIndex;
            return (
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                key={item.kind}
                onPress={() => {
                  setGroupIndex(index);
                }}
                style={[styles.segment, active ? styles.segmentActive : null]}
              >
                <Text
                  maxFontSizeMultiplier={1.3}
                  numberOfLines={1}
                  style={[styles.segmentText, active ? { color: accent } : null]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <View style={styles.search}>
        <Feather color={C.textSecondary} name="search" size={17} />
        <TextInput
          accessibilityLabel="Search contacts"
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setQuery}
          placeholder="Search"
          placeholderTextColor={C.textMuted}
          returnKeyType="search"
          selectionColor={accent}
          style={styles.searchInput}
          value={query}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {contacts.length === 0 ? (
          <View style={styles.empty}>
            <MutedText>
              {query.trim()
                ? 'No contacts match your search.'
                : 'No message recipients are currently available.'}
            </MutedText>
          </View>
        ) : (
          <View style={styles.card}>
            {contacts.map((recipient, index) => (
              <View key={recipient.id}>
                <Pressable
                  accessibilityLabel={`Message ${recipient.fullName}, ${recipient.role}`}
                  accessibilityRole="button"
                  onPress={() => {
                    if (group) onSelect(recipient, group.kind);
                  }}
                  style={({ pressed }) => [styles.row, pressed ? styles.rowPressed : null]}
                >
                  <Avatar name={recipient.fullName} />
                  <View style={styles.rowText}>
                    <Text numberOfLines={1} style={styles.name}>
                      {recipient.fullName}
                    </Text>
                    <Text numberOfLines={1} style={styles.role}>
                      {recipient.role}
                    </Text>
                  </View>
                </Pressable>
                {index === contacts.length - 1 ? null : <View style={styles.separator} />}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.surface,
    borderCurve: 'continuous',
    borderRadius: radius.lg,
    boxShadow: elevation.card,
    overflow: 'hidden',
  },
  cancel: {
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 64,
  },
  cancelText: {
    ...typeRamp.body,
  },
  empty: {
    alignItems: 'center',
    padding: 32,
  },
  list: {
    paddingBottom: 12,
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  name: {
    ...typeRamp.headline,
    color: C.navy,
    fontWeight: '500',
  },
  pressed: {
    opacity: 0.6,
  },
  role: {
    ...typeRamp.footnote,
    color: C.textSecondary,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 64,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  rowPressed: {
    backgroundColor: C.fill,
  },
  rowText: {
    flex: 1,
    gap: 1,
    minWidth: 0,
  },
  screen: {
    flex: 1,
    gap: 10,
  },
  search: {
    alignItems: 'center',
    backgroundColor: C.fill,
    borderCurve: 'continuous',
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 16,
    minHeight: 40,
    paddingHorizontal: 12,
  },
  searchInput: {
    ...typeRamp.body,
    color: C.textPrimary,
    flex: 1,
    paddingVertical: 8,
  },
  segment: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: radius.sm - 2,
    flex: 1,
    justifyContent: 'center',
    minHeight: 34,
  },
  segmentActive: {
    backgroundColor: C.surface,
    boxShadow: elevation.card,
  },
  segmentText: {
    ...typeRamp.footnote,
    color: C.textSecondary,
    fontWeight: '600',
  },
  segments: {
    backgroundColor: C.fill,
    borderCurve: 'continuous',
    borderRadius: radius.sm,
    flexDirection: 'row',
    marginHorizontal: 16,
    padding: 2,
  },
  separator: {
    backgroundColor: C.hairline,
    height: 1,
    marginLeft: 70,
  },
  title: {
    ...typeRamp.headline,
    color: C.navy,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
});

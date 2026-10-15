import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RouterOutputs } from '../../lib/trpc';
import { C } from '../core/mobile-theme';
import { Card, Field, MobileButton, MutedText } from '../core/mobile-ui';

type Student = RouterOutputs['academicInventory']['summary']['students'][number];
type Assignment = Student['subjects'][number];

function InventorySelectionSheet({
  label,
  onSelect,
  options,
  searchEnabled,
  selectedId,
}: {
  label: string;
  onSelect: (id: string) => void;
  options: Array<{ id: string; label: string }>;
  searchEnabled?: boolean;
  selectedId: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const selected = options.find((option) => option.id === selectedId);
  const matching = options.filter((option) =>
    option.label.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );
  return (
    <Card style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityLabel={`Choose ${label.toLocaleLowerCase()}`}
        accessibilityRole="button"
        accessibilityState={{ expanded: open, disabled: options.length === 0 }}
        disabled={options.length === 0}
        onPress={() => {
          setOpen(true);
        }}
        style={styles.trigger}
      >
        <Text style={styles.triggerText}>
          {selected?.label ?? `No ${label.toLocaleLowerCase()} available`}
        </Text>
        <Text style={styles.triggerText}>Change</Text>
      </Pressable>
      <Modal
        animationType="slide"
        onRequestClose={() => {
          setOpen(false);
        }}
        presentationStyle="overFullScreen"
        transparent
        visible={open}
      >
        <SafeAreaView style={styles.backdrop}>
          <View style={styles.sheet}>
            <View style={styles.header}>
              <Text accessibilityRole="header" style={styles.title}>
                Choose {label.toLocaleLowerCase()}
              </Text>
              <MobileButton
                compact
                label="Close"
                onPress={() => {
                  setOpen(false);
                }}
                variant="secondary"
              />
            </View>
            {searchEnabled ? (
              <Field label="Find child" onChangeText={setSearch} value={search} />
            ) : null}
            <ScrollView keyboardShouldPersistTaps="handled" style={styles.options}>
              {matching.length === 0 ? <MutedText>No children match your search.</MutedText> : null}
              {matching.map((option) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: option.id === selectedId }}
                  key={option.id}
                  onPress={() => {
                    onSelect(option.id);
                    setOpen(false);
                    setSearch('');
                  }}
                  style={[styles.option, option.id === selectedId ? styles.optionSelected : null]}
                >
                  <Text style={styles.optionText}>{option.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>
    </Card>
  );
}

export function InventoryStudentPicker({
  onSelect,
  selectedStudentId,
  students,
}: {
  onSelect: (studentId: string) => void;
  selectedStudentId: string;
  students: Student[];
}) {
  return (
    <InventorySelectionSheet
      label="Student"
      onSelect={onSelect}
      options={students.map((student) => ({
        id: student.id,
        label: `${student.fullName} · ${student.yearGroup}`,
      }))}
      searchEnabled
      selectedId={selectedStudentId}
    />
  );
}

export function InventorySubjectPicker({
  assignments,
  onSelect,
  selectedSubjectId,
}: {
  assignments: Assignment[];
  onSelect: (subjectId: string) => void;
  selectedSubjectId: string;
}) {
  return (
    <InventorySelectionSheet
      label="Assigned subject"
      onSelect={onSelect}
      options={assignments.map((assignment) => ({
        id: assignment.subjectId,
        label: `${assignment.subject.code} · ${assignment.subject.name} · Current #${String(assignment.currentPaceNumber)}`,
      }))}
      selectedId={selectedSubjectId}
    />
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(10, 18, 40, 0.6)', flex: 1, justifyContent: 'flex-end' },
  card: { gap: 8, padding: 12 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  label: { color: C.textSecondary, fontSize: 12, fontWeight: '800' },
  option: {
    borderColor: C.border,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
    minHeight: 48,
    padding: 12,
  },
  optionSelected: { backgroundColor: C.blueLight, borderColor: C.blue },
  optionText: { color: C.navy, fontSize: 14, fontWeight: '700' },
  options: { maxHeight: 420 },
  sheet: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    gap: 12,
    padding: 16,
  },
  title: { color: C.navy, fontSize: 18, fontWeight: '800' },
  trigger: {
    alignItems: 'center',
    borderColor: C.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 48,
    padding: 12,
  },
  triggerText: { color: C.navy, flexShrink: 1, fontSize: 13, fontWeight: '700' },
});

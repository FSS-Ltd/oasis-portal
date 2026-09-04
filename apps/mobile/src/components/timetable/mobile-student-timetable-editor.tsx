import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { TIMETABLE_DAYS, type TimetableDay } from '@oasis/domain';
import type { RouterOutputs } from '../../lib/trpc';
import { Badge, Card, Field, MobileButton, MutedText, SectionTitle } from '../core/mobile-ui';
import { C } from '../core/mobile-theme';
import {
  MobileTimetableGrid,
  type MobileTimetableEntry,
  type MobileTimetableSlot,
} from './mobile-timetable-grid';

type StudentDraft = RouterOutputs['timetable']['studentDraft'];

interface MobileStudentTimetableEditorProps {
  draft: StudentDraft;
  onAddSubject: (name: string) => Promise<void>;
  onDownload: () => Promise<void>;
  onPublish: () => Promise<void>;
  onSave: (
    entries: Array<{ day: TimetableDay; slotId: string; subjectId: string }>,
  ) => Promise<void>;
  pendingAction: 'subject' | 'save' | 'publish' | 'pdf' | null;
  slots: readonly MobileTimetableSlot[];
}

function cellKey(day: TimetableDay, slotId: string): string {
  return `${day}:${slotId}`;
}

export function MobileStudentTimetableEditor({
  draft,
  onAddSubject,
  onDownload,
  onPublish,
  onSave,
  pendingAction,
  slots,
}: MobileStudentTimetableEditorProps) {
  const [entries, setEntries] = useState<MobileTimetableEntry[]>(draft.entries);
  const [subjectName, setSubjectName] = useState('');
  const assignedCount = useMemo(
    () =>
      new Set(
        entries.filter((entry) => entry.subjectId).map((entry) => cellKey(entry.day, entry.slotId)),
      ).size,
    [entries],
  );
  const lessonCount = slots.filter((slot) => slot.kind === 'Lesson').length * TIMETABLE_DAYS.length;
  const missingCount = Math.max(0, lessonCount - assignedCount);

  function updateSubject(day: TimetableDay, slotId: string, subjectId: string): void {
    setEntries((current) => {
      const key = cellKey(day, slotId);
      const remaining = current.filter((entry) => cellKey(entry.day, entry.slotId) !== key);
      return subjectId ? [...remaining, { day, slotId, subjectId }] : remaining;
    });
  }

  function save(): void {
    const payload = entries.flatMap((entry) =>
      entry.subjectId ? [{ day: entry.day, slotId: entry.slotId, subjectId: entry.subjectId }] : [],
    );
    void onSave(payload).catch(() => undefined);
  }

  function addSubject(): void {
    const name = subjectName.trim();
    if (!name) return;
    void onAddSubject(name)
      .then(() => {
        setSubjectName('');
      })
      .catch(() => undefined);
  }

  return (
    <View style={styles.stack}>
      <Card style={styles.headingCard}>
        <View style={styles.headingRow}>
          <View style={styles.headingCopy}>
            <Text style={styles.eyebrow}>Individual timetable</Text>
            <SectionTitle>{draft.student.firstName}</SectionTitle>
            <MutedText>Tap a lesson to choose one of this child’s assigned subjects.</MutedText>
          </View>
          <Badge variant={draft.latestPublication ? 'success' : 'warning'}>
            {draft.latestPublication ? 'Published' : draft.timetableId ? 'Draft' : 'Not started'}
          </Badge>
        </View>
      </Card>

      <MobileTimetableGrid
        editable
        entries={entries}
        onSubjectChange={updateSubject}
        slots={slots}
        subjects={draft.subjects}
      />

      <Card style={missingCount === 0 ? styles.completeCard : styles.suggestionCard}>
        <Text style={styles.suggestionTitle}>
          {missingCount === 0
            ? 'Every lesson is assigned.'
            : `${String(missingCount)} lesson${missingCount === 1 ? '' : 's'} left open.`}
        </Text>
        <MutedText>
          Missing lessons are suggestions only. Some students will not take every subject yet.
        </MutedText>
      </Card>

      <Card style={styles.subjectCard}>
        <SectionTitle>Add another subject</SectionTitle>
        <MutedText>Extra subjects are reusable and appear in grey.</MutedText>
        <Field
          label="Subject name"
          onChangeText={setSubjectName}
          placeholder="e.g. French"
          value={subjectName}
        />
        <MobileButton
          disabled={!subjectName.trim() || pendingAction === 'subject'}
          label={pendingAction === 'subject' ? 'Adding subject…' : 'Add subject'}
          onPress={addSubject}
          variant="secondary"
        />
      </Card>

      <View style={styles.actions}>
        <MobileButton
          disabled={pendingAction !== null}
          label={pendingAction === 'save' ? 'Saving…' : 'Save draft'}
          onPress={save}
          variant="secondary"
        />
        <MobileButton
          disabled={pendingAction !== null}
          label={pendingAction === 'publish' ? 'Publishing…' : 'Publish timetable'}
          onPress={() => {
            void onPublish().catch(() => undefined);
          }}
          variant="navy"
        />
        {draft.latestPublication ? (
          <MobileButton
            disabled={pendingAction !== null}
            label={pendingAction === 'pdf' ? 'Preparing PDF…' : 'Download / print PDF'}
            onPress={() => {
              void onDownload().catch(() => undefined);
            }}
            variant="blue"
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: 8,
  },
  completeCard: {
    backgroundColor: C.successBg,
    borderColor: C.successMid,
    gap: 4,
    padding: 14,
  },
  eyebrow: {
    color: C.crimson,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  headingCard: {
    gap: 10,
    padding: 16,
  },
  headingCopy: {
    flex: 1,
    gap: 4,
  },
  headingRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  stack: {
    gap: 14,
  },
  subjectCard: {
    gap: 9,
    padding: 16,
  },
  suggestionCard: {
    backgroundColor: C.warningBg,
    borderColor: '#F4D78A',
    gap: 4,
    padding: 14,
  },
  suggestionTitle: {
    color: C.navy,
    fontSize: 13,
    fontWeight: '900',
  },
});

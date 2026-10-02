import { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { findScheduleIssues, type TimetableSlotInput } from '@oasis/domain';
import { Card, ErrorText, MobileButton, MutedText, SectionTitle } from '../core/mobile-ui';
import { C } from '../core/mobile-theme';

export interface MobileEditableScheduleSlot extends TimetableSlotInput {
  id?: string;
}

interface MobileScheduleEditorProps {
  initialSlots: readonly MobileEditableScheduleSlot[];
  onSave: (slots: MobileEditableScheduleSlot[]) => Promise<void>;
  pending: boolean;
  saved: boolean;
}

interface LocalSlot extends MobileEditableScheduleSlot {
  clientKey: string;
}

const slotKinds = ['Lesson', 'Break'] as const;

function formatMinutes(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function parseTime(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/u.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function MobileScheduleEditor({
  initialSlots,
  onSave,
  pending,
  saved,
}: MobileScheduleEditorProps) {
  const sequence = useRef(0);
  const [slots, setSlots] = useState<LocalSlot[]>(() =>
    initialSlots.map((slot, index) => ({ ...slot, clientKey: slot.id ?? `slot-${String(index)}` })),
  );
  const issues = useMemo(() => findScheduleIssues(slots), [slots]);

  function updateSlot(index: number, update: Partial<MobileEditableScheduleSlot>): void {
    setSlots((current) =>
      current.map((slot, slotIndex) => (slotIndex === index ? { ...slot, ...update } : slot)),
    );
  }

  function moveSlot(index: number, offset: -1 | 1): void {
    const nextIndex = index + offset;
    if (nextIndex < 0 || nextIndex >= slots.length) return;
    setSlots((current) => {
      const next = [...current];
      const currentSlot = next[index];
      const otherSlot = next[nextIndex];
      if (!currentSlot || !otherSlot) return current;
      next[index] = otherSlot;
      next[nextIndex] = currentSlot;
      return next;
    });
  }

  function addSlot(kind: 'Lesson' | 'Break'): void {
    sequence.current += 1;
    const startMinutes = slots.at(-1)?.endMinutes ?? 9 * 60;
    const lessonNumber = slots.filter((slot) => slot.kind === 'Lesson').length + 1;
    setSlots((current) => [
      ...current,
      {
        clientKey: `new-${String(sequence.current)}`,
        kind,
        label: kind === 'Break' ? 'Break' : `Lesson ${String(lessonNumber)}`,
        startMinutes,
        endMinutes: Math.min(startMinutes + 30, 24 * 60),
      },
    ]);
  }

  function save(): void {
    if (issues.length > 0) return;
    const payload = slots.map((slot) => ({
      ...(slot.id ? { id: slot.id } : {}),
      kind: slot.kind,
      label: slot.label,
      startMinutes: slot.startMinutes,
      endMinutes: slot.endMinutes,
    }));
    void onSave(payload).catch(() => undefined);
  }

  return (
    <Card style={styles.card}>
      <View style={styles.heading}>
        <View style={styles.headingCopy}>
          <SectionTitle>Shared times</SectionTitle>
          <MutedText>Reorder lessons and breaks, then edit each start and end time.</MutedText>
        </View>
        <Text style={saved ? styles.saved : styles.defaults}>{saved ? 'Saved' : 'Defaults'}</Text>
      </View>

      {slots.map((slot, index) => {
        const issue = issues.find((candidate) => candidate.position === index);
        return (
          <View key={slot.clientKey} style={styles.slotCard}>
            <View style={styles.slotHeading}>
              <Text style={styles.slotNumber}>{String(index + 1).padStart(2, '0')}</Text>
              <View style={styles.kindSwitch}>
                {slotKinds.map((kind) => (
                  <Pressable
                    accessibilityRole="button"
                    key={kind}
                    onPress={() => {
                      updateSlot(index, {
                        kind,
                        ...(kind === 'Break' ? { label: 'Break' } : {}),
                      });
                    }}
                    style={[styles.kindButton, slot.kind === kind ? styles.kindButtonActive : null]}
                  >
                    <Text
                      style={[
                        styles.kindButtonText,
                        slot.kind === kind ? styles.kindButtonTextActive : null,
                      ]}
                    >
                      {kind}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <TextInput
              accessibilityLabel={`Slot ${String(index + 1)} label`}
              onChangeText={(label) => {
                updateSlot(index, { label });
              }}
              style={styles.input}
              value={slot.label}
            />
            <View style={styles.timeRow}>
              <View style={styles.timeField}>
                <Text style={styles.label}>Starts</Text>
                <TextInput
                  accessibilityLabel={`${slot.label} start time`}
                  defaultValue={formatMinutes(slot.startMinutes)}
                  inputMode="text"
                  onEndEditing={(event) => {
                    const parsed = parseTime(event.nativeEvent.text);
                    if (parsed !== null) updateSlot(index, { startMinutes: parsed });
                  }}
                  placeholder="09:00"
                  style={styles.input}
                />
              </View>
              <View style={styles.timeField}>
                <Text style={styles.label}>Ends</Text>
                <TextInput
                  accessibilityLabel={`${slot.label} end time`}
                  defaultValue={formatMinutes(slot.endMinutes)}
                  inputMode="text"
                  onEndEditing={(event) => {
                    const parsed = parseTime(event.nativeEvent.text);
                    if (parsed !== null) updateSlot(index, { endMinutes: parsed });
                  }}
                  placeholder="09:30"
                  style={styles.input}
                />
              </View>
            </View>
            <View style={styles.actionRow}>
              <MobileButton
                compact
                disabled={index === 0}
                label="Move up"
                onPress={() => {
                  moveSlot(index, -1);
                }}
                variant="secondary"
              />
              <MobileButton
                compact
                disabled={index === slots.length - 1}
                label="Move down"
                onPress={() => {
                  moveSlot(index, 1);
                }}
                variant="secondary"
              />
              <MobileButton
                compact
                disabled={slots.length === 1}
                label="Remove"
                onPress={() => {
                  setSlots((current) => current.filter((_, slotIndex) => slotIndex !== index));
                }}
                variant="danger"
              />
            </View>
            {issue ? <ErrorText>{issue.message}</ErrorText> : null}
          </View>
        );
      })}

      <View style={styles.actionRow}>
        <MobileButton
          compact
          label="Add lesson"
          onPress={() => {
            addSlot('Lesson');
          }}
          variant="secondary"
        />
        <MobileButton
          compact
          label="Add break"
          onPress={() => {
            addSlot('Break');
          }}
          variant="secondary"
        />
      </View>
      <MobileButton
        disabled={issues.length > 0 || pending}
        label={pending ? 'Saving times…' : 'Save times'}
        onPress={save}
        variant="navy"
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  card: {
    gap: 14,
    padding: 16,
  },
  defaults: {
    backgroundColor: C.warningBg,
    borderRadius: 999,
    color: C.warning,
    fontSize: 10,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  heading: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  headingCopy: {
    flex: 1,
    gap: 4,
  },
  input: {
    backgroundColor: C.surface,
    borderColor: C.border,
    borderRadius: 8,
    borderWidth: 1,
    color: C.textPrimary,
    fontSize: 13,
    minHeight: 40,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  kindButton: {
    borderRadius: 7,
    minHeight: 30,
    justifyContent: 'center',
    paddingHorizontal: 9,
  },
  kindButtonActive: {
    backgroundColor: C.navy,
  },
  kindButtonText: {
    color: C.textSecondary,
    fontSize: 10,
    fontWeight: '800',
  },
  kindButtonTextActive: {
    color: C.surface,
  },
  kindSwitch: {
    backgroundColor: C.bg,
    borderRadius: 9,
    flexDirection: 'row',
    gap: 2,
    padding: 2,
  },
  label: {
    color: C.textSecondary,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  saved: {
    backgroundColor: C.successBg,
    borderRadius: 999,
    color: C.success,
    fontSize: 10,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  slotCard: {
    backgroundColor: '#FAFBFE',
    borderColor: C.borderLight,
    borderLeftColor: C.blue,
    borderLeftWidth: 3,
    borderRadius: 10,
    borderWidth: 1,
    gap: 9,
    padding: 10,
  },
  slotHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  slotNumber: {
    color: C.textMuted,
    fontSize: 10,
    fontWeight: '900',
  },
  timeField: {
    flex: 1,
    gap: 4,
  },
  timeRow: {
    flexDirection: 'row',
    gap: 8,
  },
});

import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { TIMETABLE_DAYS, type TimetableColour, type TimetableDay } from '@oasis/domain';
import { C } from '../core/mobile-theme';

export interface MobileTimetableSlot {
  endMinutes: number;
  id: string;
  kind: 'Lesson' | 'Break';
  label: string;
  position: number;
  startMinutes: number;
}

export interface MobileTimetableSubject {
  colour: TimetableColour;
  id: string;
  name: string;
}

export interface MobileTimetableEntry {
  day: TimetableDay;
  slotId: string;
  subjectColour?: TimetableColour | null;
  subjectId?: string | null;
  subjectName?: string | null;
}

interface MobileTimetableGridProps {
  editable?: boolean;
  entries: readonly MobileTimetableEntry[];
  onSubjectChange?: (day: TimetableDay, slotId: string, subjectId: string) => void;
  slots: readonly MobileTimetableSlot[];
  subjects?: readonly MobileTimetableSubject[];
}

const subjectColours: Record<TimetableColour, string> = {
  Yellow: '#FFE96B',
  Red: '#EF8587',
  PaleRed: '#F5B8B9',
  Purple: '#D29BE3',
  DarkBlue: '#7199CF',
  LightBlue: '#B8E7EF',
  Green: '#7BD654',
  Brown: '#B78868',
  Grey: '#D9DDE3',
};

function cellKey(day: TimetableDay, slotId: string): string {
  return `${day}:${slotId}`;
}

function formatMinutes(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

export function MobileTimetableGrid({
  editable = false,
  entries,
  onSubjectChange,
  slots,
  subjects = [],
}: MobileTimetableGridProps) {
  const [activeCell, setActiveCell] = useState<string | null>(null);
  const entryByCell = new Map(entries.map((entry) => [cellKey(entry.day, entry.slotId), entry]));
  const subjectById = new Map(subjects.map((subject) => [subject.id, subject]));

  return (
    <View style={styles.days}>
      {TIMETABLE_DAYS.map((day) => (
        <View key={day} style={styles.dayCard}>
          <Text style={styles.dayTitle}>{day}</Text>
          {slots.map((slot) => {
            const key = cellKey(day, slot.id);
            if (slot.kind === 'Break') {
              return (
                <View key={slot.id} style={styles.breakRow}>
                  <Text style={styles.timeLabel}>
                    {formatMinutes(slot.startMinutes)}–{formatMinutes(slot.endMinutes)}
                  </Text>
                  <View style={styles.breakMarker}>
                    <Text style={styles.breakText}>B.R.E.A.K.</Text>
                  </View>
                </View>
              );
            }

            const entry = entryByCell.get(key);
            const selectedSubject = entry?.subjectId ? subjectById.get(entry.subjectId) : undefined;
            const subjectName = entry?.subjectName ?? selectedSubject?.name ?? 'Unassigned';
            const colour = entry?.subjectColour ?? selectedSubject?.colour ?? null;
            const active = activeCell === key;

            return (
              <View key={slot.id} style={styles.lessonGroup}>
                <Pressable
                  accessibilityLabel={`${day} ${slot.label}, ${subjectName}`}
                  accessibilityRole={editable ? 'button' : 'text'}
                  disabled={!editable}
                  onPress={() => {
                    setActiveCell(active ? null : key);
                  }}
                  style={[
                    styles.lessonRow,
                    { backgroundColor: colour ? subjectColours[colour] : C.surface },
                    active ? styles.activeLesson : null,
                  ]}
                >
                  <View style={styles.lessonMeta}>
                    <Text style={styles.slotLabel}>{slot.label}</Text>
                    <Text style={styles.timeLabel}>
                      {formatMinutes(slot.startMinutes)}–{formatMinutes(slot.endMinutes)}
                    </Text>
                  </View>
                  <Text style={styles.subjectName}>{subjectName}</Text>
                </Pressable>
                {editable && active ? (
                  <ScrollView
                    contentContainerStyle={styles.subjectChoices}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                  >
                    <Pressable
                      onPress={() => {
                        onSubjectChange?.(day, slot.id, '');
                        setActiveCell(null);
                      }}
                      style={styles.subjectChoice}
                    >
                      <Text style={styles.subjectChoiceText}>Open</Text>
                    </Pressable>
                    {subjects.map((subject) => (
                      <Pressable
                        key={subject.id}
                        onPress={() => {
                          onSubjectChange?.(day, slot.id, subject.id);
                          setActiveCell(null);
                        }}
                        style={[
                          styles.subjectChoice,
                          { backgroundColor: subjectColours[subject.colour] },
                        ]}
                      >
                        <Text style={styles.subjectChoiceText}>{subject.name}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                ) : null}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  activeLesson: {
    borderColor: C.navy,
    borderWidth: 2,
  },
  breakMarker: {
    alignItems: 'center',
    height: 34,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 78,
  },
  breakRow: {
    alignItems: 'center',
    backgroundColor: '#FFF9F3',
    borderColor: '#E9D5C1',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 54,
    paddingHorizontal: 12,
  },
  breakText: {
    color: '#171A20',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    transform: [{ rotate: '-90deg' }],
    width: 82,
  },
  dayCard: {
    backgroundColor: C.surface,
    borderColor: C.border,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
    padding: 12,
  },
  dayTitle: {
    color: C.navy,
    fontSize: 16,
    fontWeight: '900',
  },
  days: {
    gap: 12,
  },
  lessonGroup: {
    gap: 7,
  },
  lessonMeta: {
    gap: 2,
  },
  lessonRow: {
    alignItems: 'center',
    borderColor: C.border,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 58,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  slotLabel: {
    color: '#171A20',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  subjectChoice: {
    backgroundColor: C.bg,
    borderColor: C.border,
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 34,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  subjectChoiceText: {
    color: '#171A20',
    fontSize: 11,
    fontWeight: '800',
  },
  subjectChoices: {
    gap: 7,
    paddingRight: 12,
  },
  subjectName: {
    color: '#171A20',
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'right',
    textTransform: 'uppercase',
  },
  timeLabel: {
    color: '#586174',
    fontSize: 10,
    fontWeight: '700',
  },
});

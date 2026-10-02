import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { RouterInputs, RouterOutputs } from '../../lib/trpc';
import { C } from '../core/mobile-theme';
import { ErrorText, Field, MobileButton, MutedText, SectionTitle } from '../core/mobile-ui';
import type { StaffManagedClub } from './staff-club-manager-utils';

type ClubYearGroupBand = RouterOutputs['club']['yearGroupBands'][number];
type ClubPayload = Omit<RouterInputs['club']['create'], 'schedule'> & {
  schedule: { startDate: Date; startMinute: number; endMinute: number; frequency: 'Weekly' };
};
type ClubAccentColor = NonNullable<ClubPayload['accentColor']>;
type ClubIconKey = NonNullable<ClubPayload['iconKey']>;

interface ClubDraft {
  accentColor: ClubPayload['accentColor'];
  capacity: string;
  description: string;
  endTime: string;
  firstDate: string;
  iconKey: ClubPayload['iconKey'];
  name: string;
  startTime: string;
  yearGroupBandIds: string[];
}

const iconKeys: readonly ClubIconKey[] = [
  'general',
  'achievement',
  'art',
  'book',
  'chess',
  'coding',
  'drama',
  'games',
  'music',
  'scripture',
  'sports',
  'stem',
];
const accentColours: readonly ClubAccentColor[] = [
  '#7D3C98',
  '#1B2B5E',
  '#B45309',
  '#0E7490',
  '#0E5C3A',
  '#BE185D',
  '#4338CA',
  '#7D1C2C',
  '#9A3412',
  '#0F766E',
  '#2563EB',
  '#64748B',
];
const accentColor: ClubAccentColor = '#1B2B5E';
const iconKey: ClubIconKey = 'general';

function isAccentColor(value: string | null | undefined): value is ClubAccentColor {
  return (
    value !== null && value !== undefined && accentColours.some((candidate) => candidate === value)
  );
}

function isIconKey(value: string | null | undefined): value is ClubIconKey {
  return value !== null && value !== undefined && iconKeys.some((candidate) => candidate === value);
}

function minuteToTimeInput(minutes: number | undefined, fallback: string): string {
  return minutes === undefined
    ? fallback
    : `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function draftFromClub(club: StaffManagedClub | null): ClubDraft {
  const date = club?.schedule?.startDate ?? new Date().toISOString().slice(0, 10);
  return {
    accentColor: isAccentColor(club?.accentColor) ? club.accentColor : accentColor,
    capacity: club?.capacity === null || club?.capacity === undefined ? '' : String(club.capacity),
    description: club?.description ?? '',
    endTime: minuteToTimeInput(club?.schedule?.endMinute, '16:30'),
    firstDate: date,
    iconKey: isIconKey(club?.iconKey) ? club.iconKey : iconKey,
    name: club?.name ?? '',
    startTime: minuteToTimeInput(club?.schedule?.startMinute, '15:30'),
    yearGroupBandIds: club?.yearGroupBands.map((band) => band.id) ?? [],
  };
}

function timeToMinute(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

function buildPayload(draft: ClubDraft): ClubPayload | string {
  const name = draft.name.trim();
  if (!name) return 'Club name is required.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.firstDate))
    return 'Use YYYY-MM-DD for the first club date.';
  const startMinute = timeToMinute(draft.startTime);
  const endMinute = timeToMinute(draft.endTime);
  if (startMinute === null || endMinute === null || startMinute >= endMinute)
    return 'Use valid times with the end after the start.';
  if (draft.yearGroupBandIds.length === 0) return 'Select at least one year group.';
  const capacity = draft.capacity.trim() ? Number(draft.capacity) : null;
  if (capacity !== null && (!Number.isSafeInteger(capacity) || capacity <= 0))
    return 'Capacity must be a positive whole number.';
  return {
    name,
    description: draft.description.trim() || null,
    schedule: {
      startDate: new Date(`${draft.firstDate}T00:00:00.000Z`),
      startMinute,
      endMinute,
      frequency: 'Weekly',
    },
    capacity,
    iconKey: draft.iconKey,
    accentColor: draft.accentColor,
    yearGroupBandIds: draft.yearGroupBandIds,
  };
}

export function StaffClubManagerFormModal({
  club,
  error,
  onClose,
  onSubmit,
  pending,
  visible,
  yearGroupBands,
}: {
  club: StaffManagedClub | null;
  error: string | null;
  onClose: () => void;
  onSubmit: (payload: ClubPayload) => void;
  pending: boolean;
  visible: boolean;
  yearGroupBands: readonly ClubYearGroupBand[];
}) {
  const [draft, setDraft] = useState<ClubDraft>(() => draftFromClub(club));
  const [validationError, setValidationError] = useState<string | null>(null);
  useEffect(() => {
    if (visible) {
      setDraft(draftFromClub(club));
      setValidationError(null);
    }
  }, [club, visible]);
  const submit = () => {
    const payload = buildPayload(draft);
    if (typeof payload === 'string') {
      setValidationError(payload);
      return;
    }
    onSubmit(payload);
  };
  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.header}>
              <View>
                <Text style={styles.eyebrow}>{club ? 'Edit club' : 'Create club'}</Text>
                <SectionTitle>{club ? club.name : 'New club'}</SectionTitle>
              </View>
              <MobileButton compact label="Close" onPress={onClose} variant="secondary" />
            </View>
            <Field
              label="Club name"
              onChangeText={(name) => {
                setDraft({ ...draft, name });
              }}
              value={draft.name}
            />
            <Field
              label="Description"
              multiline
              onChangeText={(description) => {
                setDraft({ ...draft, description });
              }}
              value={draft.description}
            />
            <Field
              label="First club date (YYYY-MM-DD)"
              onChangeText={(firstDate) => {
                setDraft({ ...draft, firstDate });
              }}
              value={draft.firstDate}
            />
            <View style={styles.row}>
              <View style={styles.half}>
                <Field
                  label="Start time (HH:MM)"
                  onChangeText={(startTime) => {
                    setDraft({ ...draft, startTime });
                  }}
                  value={draft.startTime}
                />
              </View>
              <View style={styles.half}>
                <Field
                  label="End time (HH:MM)"
                  onChangeText={(endTime) => {
                    setDraft({ ...draft, endTime });
                  }}
                  value={draft.endTime}
                />
              </View>
            </View>
            <Field
              keyboardType="numeric"
              label="Capacity (blank for no cap)"
              onChangeText={(capacity) => {
                setDraft({ ...draft, capacity });
              }}
              value={draft.capacity}
            />
            <View style={styles.visuals}>
              <Text style={styles.label}>Club icon</Text>
              <View style={styles.choiceRow}>
                {iconKeys.map((value) => (
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ selected: draft.iconKey === value }}
                    key={value}
                    onPress={() => {
                      setDraft({ ...draft, iconKey: value });
                    }}
                    style={[styles.choice, draft.iconKey === value ? styles.choiceSelected : null]}
                  >
                    <Text style={styles.choiceText}>{value}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.label}>Club colour</Text>
              <View style={styles.choiceRow}>
                {accentColours.map((value) => (
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ selected: draft.accentColor === value }}
                    key={value}
                    onPress={() => {
                      setDraft({ ...draft, accentColor: value });
                    }}
                    style={[
                      styles.colourChoice,
                      { backgroundColor: value },
                      draft.accentColor === value ? styles.colourChoiceSelected : null,
                    ]}
                  />
                ))}
              </View>
            </View>
            <View style={styles.bands}>
              <Text style={styles.label}>Year groups</Text>
              <MutedText>Only these groups can join newly.</MutedText>
              {yearGroupBands.map((band) => {
                const selected = draft.yearGroupBandIds.includes(band.id);
                return (
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    key={band.id}
                    onPress={() => {
                      setDraft({
                        ...draft,
                        yearGroupBandIds: selected
                          ? draft.yearGroupBandIds.filter((id) => id !== band.id)
                          : [...draft.yearGroupBandIds, band.id],
                      });
                    }}
                    style={[styles.band, selected ? styles.bandSelected : null]}
                  >
                    <Text style={styles.bandTitle}>{band.name}</Text>
                    <Text style={styles.bandYears}>{band.standardYears.join(', ')}</Text>
                  </Pressable>
                );
              })}
            </View>
            {validationError || error ? (
              <ErrorText>{validationError ?? error ?? ''}</ErrorText>
            ) : null}
            <MobileButton
              disabled={pending || yearGroupBands.length === 0}
              label={pending ? 'Saving…' : club ? 'Save club' : 'Create club'}
              onPress={submit}
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(16, 24, 40, 0.45)', flex: 1, justifyContent: 'flex-end' },
  band: { borderColor: C.border, borderRadius: 10, borderWidth: 1, gap: 3, padding: 12 },
  bandSelected: { backgroundColor: C.blueLight, borderColor: C.blueMid },
  bandTitle: { color: C.navy, fontSize: 14, fontWeight: '800' },
  bandYears: { color: C.textSecondary, fontSize: 11, fontWeight: '700' },
  bands: { gap: 8 },
  content: { gap: 14, padding: 18 },
  choice: {
    borderColor: C.border,
    borderRadius: 9,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  choiceSelected: { backgroundColor: C.blueLight, borderColor: C.blueMid },
  choiceText: { color: C.navy, fontSize: 11, fontWeight: '800' },
  colourChoice: { borderColor: C.surface, borderRadius: 14, borderWidth: 2, height: 28, width: 28 },
  colourChoiceSelected: { borderColor: C.navy, transform: [{ scale: 1.08 }] },
  eyebrow: { color: C.blue, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  half: { flex: 1 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  label: { color: C.navy, fontSize: 14, fontWeight: '800' },
  row: { flexDirection: 'row', gap: 10 },
  sheet: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '92%',
  },
  visuals: { gap: 8 },
});

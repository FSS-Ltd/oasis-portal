import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { C } from '../smoke/mobile-theme';
import { Badge, Card, Field, MutedText, SmokeButton } from '../smoke/smoke-ui';
import {
  behaviourCategories,
  clubBehaviourTypes,
  defaultBehaviourDraft,
  formatYearGroup,
  nextBehaviourDraftForType,
  validateBehaviourDraft,
  type StaffClubBehaviourDraft,
  type StaffClubBehaviourEntry,
  type StaffClubBehaviourType,
  type StaffClubRosterRow,
} from './staff-club-lead-utils';

export function StaffClubLeadBehaviour({
  entries,
  error,
  loading,
  onSubmit,
  roster,
  saving,
}: {
  entries: StaffClubBehaviourEntry[];
  error: string | null;
  loading: boolean;
  onSubmit: (draft: StaffClubBehaviourDraft) => Promise<boolean>;
  roster: StaffClubRosterRow[];
  saving: boolean;
}) {
  const [draft, setDraft] = useState<StaffClubBehaviourDraft>(() => defaultBehaviourDraft(roster));
  const [validation, setValidation] = useState<string | null>(null);

  useEffect(() => {
    setDraft((current) => {
      if (current.studentId && roster.some((student) => student.studentId === current.studentId)) {
        return current;
      }
      return { ...current, studentId: roster[0]?.studentId ?? '' };
    });
  }, [roster]);

  async function submit() {
    const nextValidation = validateBehaviourDraft(draft);
    setValidation(nextValidation);
    if (nextValidation) return;
    const saved = await onSubmit(draft);
    if (saved) {
      setDraft((current) => ({ ...current, note: '' }));
    }
  }

  return (
    <View style={styles.stack}>
      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Log club behaviour</Text>
        <View style={styles.segmentedRow}>
          {clubBehaviourTypes.map((type) => (
            <SegmentButton
              active={draft.type === type}
              key={type}
              label={type === 'General' ? 'General mark' : type}
              onPress={() => {
                setDraft((current) => nextBehaviourDraftForType(current, type));
                setValidation(null);
              }}
              tone={type}
            />
          ))}
        </View>

        <View style={styles.optionGroup}>
          <Text style={styles.fieldLabel}>Student</Text>
          <View style={styles.optionRow}>
            {roster.map((student) => (
              <OptionButton
                active={draft.studentId === student.studentId}
                key={student.studentId}
                label={`${student.studentName} · ${formatYearGroup(student.yearGroup)}`}
                onPress={() => {
                  setDraft((current) => ({ ...current, studentId: student.studentId }));
                }}
              />
            ))}
          </View>
          {roster.length === 0 ? (
            <MutedText>No roster available for behaviour logging.</MutedText>
          ) : null}
        </View>

        <View style={styles.optionGroup}>
          <Text style={styles.fieldLabel}>Category</Text>
          <View style={styles.optionRow}>
            {behaviourCategories(draft.type).map((category) => (
              <OptionButton
                active={draft.category === category}
                key={category}
                label={category}
                onPress={() => {
                  setDraft((current) => ({ ...current, category }));
                }}
              />
            ))}
          </View>
        </View>

        {draft.type === 'Merit' ? (
          <Field
            keyboardType="numeric"
            label="Merit amount"
            onChangeText={(amount) => {
              setDraft((current) => ({ ...current, amount }));
            }}
            value={draft.amount}
          />
        ) : null}
        <Field
          label="Note"
          multiline
          onChangeText={(note) => {
            setDraft((current) => ({ ...current, note }));
          }}
          placeholder="Describe the club activity"
          value={draft.note}
        />
        {validation ? <Text style={styles.validationText}>{validation}</Text> : null}
        <SmokeButton
          disabled={saving || roster.length === 0}
          label={saving ? 'Saving behaviour...' : 'Save behaviour'}
          onPress={() => {
            void submit();
          }}
          variant={draft.type === 'Merit' ? 'success' : 'blue'}
        />
      </Card>

      <Card style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.cardTitle}>Today's club entries</Text>
          <Badge variant="blue">{String(entries.length)}</Badge>
        </View>
        {loading ? <MutedText>Loading recent entries...</MutedText> : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {!loading && !error && entries.length === 0 ? (
          <MutedText>No behaviour entries have been logged for this club today.</MutedText>
        ) : null}
        {entries.slice(0, 6).map((entry) => (
          <View key={entry.id} style={styles.entryRow}>
            <View style={styles.entryHeader}>
              <Text style={styles.studentName}>{entry.studentName}</Text>
              <Badge variant={entry.type === 'Merit' ? 'success' : 'danger'}>
                {entry.meritDelta > 0 ? `+${String(entry.meritDelta)}` : String(entry.meritDelta)}
              </Badge>
            </View>
            <Text style={styles.entryMeta}>{entry.category}</Text>
            {entry.note ? <Text style={styles.note}>{entry.note}</Text> : null}
          </View>
        ))}
      </Card>
    </View>
  );
}

function SegmentButton({
  active,
  label,
  onPress,
  tone,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
  tone: StaffClubBehaviourType;
}) {
  const palette = {
    Demerit: { backgroundColor: C.dangerBg, borderColor: C.dangerMid, color: C.danger },
    General: { backgroundColor: C.blueLight, borderColor: C.blueMid, color: C.navy },
    Merit: { backgroundColor: C.successBg, borderColor: C.successMid, color: C.success },
  }[tone];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[
        styles.segmentButton,
        active
          ? { backgroundColor: palette.backgroundColor, borderColor: palette.borderColor }
          : styles.segmentButtonInactive,
      ]}
    >
      <Text style={[styles.segmentButtonText, active ? { color: palette.color } : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

function OptionButton({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.optionButton, active ? styles.optionButtonActive : null]}
    >
      <Text style={[styles.optionButtonText, active ? styles.optionButtonTextActive : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 12,
    padding: 16,
  },
  cardTitle: {
    color: C.navy,
    fontSize: 14,
    fontWeight: '900',
  },
  entryHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  entryMeta: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },
  entryRow: {
    borderTopColor: C.borderLight,
    borderTopWidth: 1,
    gap: 3,
    paddingTop: 10,
  },
  errorText: {
    color: C.danger,
    fontSize: 12,
    fontWeight: '700',
  },
  fieldLabel: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  note: {
    color: C.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  optionButton: {
    backgroundColor: C.surface,
    borderColor: C.border,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  optionButtonActive: {
    backgroundColor: C.blueLight,
    borderColor: C.blue,
  },
  optionButtonText: {
    color: C.textSecondary,
    fontSize: 11,
    fontWeight: '800',
  },
  optionButtonTextActive: {
    color: C.navy,
  },
  optionGroup: {
    gap: 8,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  segmentButton: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1.5,
    flex: 1,
    minHeight: 40,
    minWidth: 100,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  segmentButtonInactive: {
    backgroundColor: C.surface,
    borderColor: C.border,
  },
  segmentButtonText: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: '900',
  },
  segmentedRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  stack: {
    gap: 10,
  },
  studentName: {
    color: C.navy,
    fontSize: 13,
    fontWeight: '900',
  },
  validationText: {
    color: C.danger,
    fontSize: 12,
    fontWeight: '700',
  },
});

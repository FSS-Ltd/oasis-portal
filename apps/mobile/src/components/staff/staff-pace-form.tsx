import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { type RouterOutputs } from '../../lib/trpc';
import { C } from '../smoke/mobile-theme';
import { Card, Field, SmokeButton } from '../smoke/smoke-ui';
import {
  paceNumberValue,
  paceTestTypeLabel,
  paceTestTypes,
  scoreLabel,
  scoreTone,
  scoreValue,
  type PaceFormErrors,
  type PaceFormState,
} from './staff-pace-utils';

type PaceSubject = RouterOutputs['pace']['forStudent']['subjects'][number];
type PaceWarnings = RouterOutputs['pace']['forStudent']['warnings'];
type ScoreTone = 'danger' | 'success' | 'warning';

export function StaffPaceFormCard({
  blockedReason,
  errors,
  form,
  onChange,
  onSubmit,
  saving,
  selectedStudentName,
  subjects,
  submitted,
  warnings,
}: {
  blockedReason: string | null;
  errors: PaceFormErrors;
  form: PaceFormState;
  onChange: (next: PaceFormState) => void;
  onSubmit: () => void;
  saving: boolean;
  selectedStudentName: string;
  subjects: PaceSubject[];
  submitted: boolean;
  warnings: PaceWarnings | null;
}) {
  const parsedScore = scoreValue(form.score);
  const tone = scoreTone(parsedScore);
  const scorePercent = Math.max(Math.min(parsedScore ?? 0, 100), 0);

  return (
    <Card style={styles.formCard}>
      <View style={styles.selectedRow}>
        <Text style={styles.fieldLabel}>Selected student</Text>
        <Text style={styles.selectedStudent}>{selectedStudentName}</Text>
      </View>

      {warnings?.dailyLimitEnabled ? (
        <View style={[styles.policyNotice, warnings.atLimit ? styles.policyNoticeBlocked : null]}>
          <Text style={styles.policyNoticeTitle}>
            {warnings.atLimit ? 'Daily PACE limit reached' : 'Daily PACE limit'}
          </Text>
          <Text style={styles.policyNoticeText}>
            {String(warnings.count)} of {String(warnings.limit)} tests recorded today.
          </Text>
        </View>
      ) : null}

      <View style={styles.optionGroup}>
        <Text style={styles.fieldLabel}>Subject</Text>
        <View style={styles.optionRow}>
          {subjects.map((subject) => (
            <OptionButton
              active={form.subjectId === subject.subjectId}
              disabled={!subject.active}
              key={subject.subjectId}
              label={`${subject.code} · ${subject.name}`}
              onPress={() => {
                onChange({
                  ...form,
                  paceNumber: String(subject.currentPaceNumber),
                  subjectId: subject.subjectId,
                  testType: subject.latestSelfTest ? 'FinalTest' : 'SelfTest',
                });
              }}
            />
          ))}
        </View>
        {submitted && errors.subjectId ? (
          <Text style={styles.validationText}>{errors.subjectId}</Text>
        ) : null}
      </View>

      <View style={styles.segmentedRow}>
        {paceTestTypes.map((testType) => (
          <SegmentButton
            active={form.testType === testType}
            key={testType}
            label={paceTestTypeLabel(testType)}
            onPress={() => {
              onChange({ ...form, testType });
            }}
          />
        ))}
      </View>

      <Field
        keyboardType="numeric"
        label="PACE number"
        onChangeText={(paceNumber) => {
          onChange({ ...form, paceNumber });
        }}
        value={form.paceNumber}
      />
      {submitted && errors.paceNumber ? (
        <Text style={styles.validationText}>{errors.paceNumber}</Text>
      ) : null}

      <View style={styles.scoreRow}>
        <View style={[styles.scoreRing, scoreRingStyle(tone)]}>
          <View style={[styles.scoreFill, { height: Math.round(scorePercent * 0.68) }]} />
          <Text style={[styles.scoreValue, scoreTextStyle(tone)]}>
            {parsedScore === null ? '-' : String(parsedScore)}
          </Text>
          <Text style={styles.scoreMax}>/100</Text>
        </View>
        <View style={styles.scoreField}>
          <Field
            keyboardType="numeric"
            label="Score (%)"
            onChangeText={(score) => {
              onChange({ ...form, score });
            }}
            value={form.score}
          />
          <Text style={[styles.scoreHint, scoreTextStyle(tone)]}>{scoreLabel(parsedScore)}</Text>
        </View>
      </View>
      {submitted && errors.score ? <Text style={styles.validationText}>{errors.score}</Text> : null}

      {blockedReason ? (
        <View style={[styles.policyNotice, styles.policyNoticeBlocked]}>
          <Text style={styles.policyNoticeTitle}>Submission blocked</Text>
          <Text style={styles.policyNoticeText}>{blockedReason}</Text>
        </View>
      ) : null}

      <SmokeButton
        disabled={saving || blockedReason !== null || paceNumberValue(form.paceNumber) === null}
        label={saving ? 'Saving score...' : 'Save PACE score'}
        onPress={onSubmit}
        variant="navy"
      />
    </Card>
  );
}

function scoreRingStyle(tone: ScoreTone): StyleProp<ViewStyle> {
  if (tone === 'success') return styles.scoreRingSuccess;
  if (tone === 'warning') return styles.scoreRingWarning;
  return styles.scoreRingDanger;
}

function scoreTextStyle(tone: ScoreTone): StyleProp<TextStyle> {
  if (tone === 'success') return styles.scoreTextSuccess;
  if (tone === 'warning') return styles.scoreTextWarning;
  return styles.scoreTextDanger;
}

function SegmentButton({
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
      style={[styles.segmentButton, active ? styles.segmentButtonActive : null]}
    >
      <Text style={[styles.segmentButtonText, active ? styles.segmentButtonTextActive : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

function OptionButton({
  active,
  disabled,
  label,
  onPress,
}: {
  active: boolean;
  disabled: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, selected: active }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.optionButton,
        active ? styles.optionButtonActive : null,
        disabled ? styles.optionButtonDisabled : null,
      ]}
    >
      <Text style={[styles.optionButtonText, active ? styles.optionButtonTextActive : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fieldLabel: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },
  formCard: {
    gap: 12,
    padding: 16,
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
  optionButtonDisabled: {
    opacity: 0.45,
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
  policyNotice: {
    backgroundColor: C.warningBg,
    borderColor: C.warningBg,
    borderRadius: 10,
    borderWidth: 1,
    gap: 3,
    padding: 10,
  },
  policyNoticeBlocked: {
    backgroundColor: C.dangerBg,
    borderColor: C.dangerMid,
  },
  policyNoticeText: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  policyNoticeTitle: {
    color: C.navy,
    fontSize: 12,
    fontWeight: '900',
  },
  scoreField: {
    flex: 1,
    gap: 4,
    minWidth: 150,
  },
  scoreFill: {
    backgroundColor: C.blueLight,
    bottom: 0,
    left: 0,
    opacity: 0.65,
    position: 'absolute',
    right: 0,
  },
  scoreHint: {
    fontSize: 12,
    fontWeight: '800',
  },
  scoreMax: {
    color: C.textMuted,
    fontSize: 10,
    fontWeight: '800',
  },
  scoreRing: {
    alignItems: 'center',
    borderRadius: 34,
    borderWidth: 3,
    height: 68,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 68,
  },
  scoreRingDanger: {
    borderColor: C.dangerMid,
  },
  scoreRingSuccess: {
    borderColor: C.successMid,
  },
  scoreRingWarning: {
    borderColor: C.warning,
  },
  scoreRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  scoreTextDanger: {
    color: C.danger,
  },
  scoreTextSuccess: {
    color: C.success,
  },
  scoreTextWarning: {
    color: C.warning,
  },
  scoreValue: {
    fontSize: 18,
    fontWeight: '900',
  },
  segmentButton: {
    alignItems: 'center',
    backgroundColor: C.surface,
    borderColor: C.border,
    borderRadius: 10,
    borderWidth: 1.5,
    flex: 1,
    minHeight: 40,
    minWidth: 120,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  segmentButtonActive: {
    backgroundColor: C.blueLight,
    borderColor: C.blue,
  },
  segmentButtonText: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: '900',
  },
  segmentButtonTextActive: {
    color: C.navy,
  },
  segmentedRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectedRow: {
    gap: 3,
  },
  selectedStudent: {
    color: C.navy,
    fontSize: 16,
    fontWeight: '900',
  },
  validationText: {
    color: C.danger,
    fontSize: 12,
    fontWeight: '700',
  },
});

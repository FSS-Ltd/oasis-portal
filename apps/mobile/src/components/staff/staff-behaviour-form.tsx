import { Pressable, StyleSheet, Text, View } from 'react-native';
import { C } from '../core/mobile-theme';
import { Card, Field, MobileButton } from '../core/mobile-ui';
import {
  behaviourTypes,
  behaviourVisibilitiesForType,
  categoryOptions,
  formatDemeritStage,
  generalMarkPolicyText,
  type BehaviourFormErrors,
  type BehaviourFormState,
  type BehaviourType,
  type DemeritStagePreview,
} from './staff-behaviour-utils';

function saveButtonLabel(type: BehaviourType, saving: boolean): string {
  if (saving) return 'Saving behaviour...';
  if (type === 'Demerit') return 'Save demerit';
  if (type === 'General') return 'Save general mark';
  return 'Save behaviour';
}

export function BehaviourFormCard({
  demeritPreview,
  errors,
  form,
  onChange,
  onSubmit,
  onTypeChange,
  saving,
  selectedStudentName,
  submitted,
}: {
  demeritPreview: DemeritStagePreview | null;
  errors: BehaviourFormErrors;
  form: BehaviourFormState;
  onChange: (next: BehaviourFormState) => void;
  onSubmit: () => void;
  onTypeChange: (type: BehaviourType) => void;
  saving: boolean;
  selectedStudentName: string;
  submitted: boolean;
}) {
  return (
    <Card style={styles.formCard}>
      <View style={styles.selectedRow}>
        <Text style={styles.fieldLabel}>Selected student</Text>
        <Text style={styles.selectedStudent}>{selectedStudentName}</Text>
      </View>

      <View style={styles.segmentedRow}>
        {behaviourTypes.map((type) => (
          <SegmentButton
            active={form.type === type}
            key={type}
            label={type === 'General' ? 'General mark' : type}
            onPress={() => {
              onTypeChange(type);
            }}
            tone={type === 'Merit' ? 'success' : type === 'General' ? 'default' : 'danger'}
          />
        ))}
      </View>

      <View style={styles.optionGroup}>
        <Text style={styles.fieldLabel}>Category</Text>
        <View style={styles.optionRow}>
          {categoryOptions(form.type).map((category) => (
            <OptionButton
              active={form.category === category}
              key={category}
              label={category}
              onPress={() => {
                onChange({ ...form, category });
              }}
            />
          ))}
        </View>
        {submitted && errors.category ? (
          <Text style={styles.validationText}>{errors.category}</Text>
        ) : null}
      </View>

      {form.type === 'Merit' || form.type === 'Demerit' ? (
        <Field
          keyboardType="numeric"
          label={form.type === 'Merit' ? 'Merit amount' : 'Demerit value'}
          onChangeText={(amount) => {
            onChange({ ...form, amount });
          }}
          value={form.amount}
        />
      ) : null}
      {form.type === 'General' ? (
        <View style={styles.generalNotice}>
          <Text style={styles.generalNoticeTitle}>No merit value</Text>
          <Text style={styles.generalNoticeText}>{generalMarkPolicyText}</Text>
        </View>
      ) : null}
      {submitted && errors.amount ? (
        <Text style={styles.validationText}>{errors.amount}</Text>
      ) : null}
      {form.type === 'Demerit' ? <DemeritStagePreviewPanel preview={demeritPreview} /> : null}

      <Field
        label="Note"
        multiline
        onChangeText={(note) => {
          onChange({ ...form, note });
        }}
        placeholder="Describe the behaviour"
        value={form.note}
      />
      {submitted && errors.note ? <Text style={styles.validationText}>{errors.note}</Text> : null}

      <View style={styles.optionGroup}>
        <Text style={styles.fieldLabel}>Display</Text>
        <View style={styles.segmentedRow}>
          {behaviourVisibilitiesForType(form.type).map((visibility) => (
            <SegmentButton
              active={form.visibility === visibility}
              key={visibility}
              label={visibility}
              onPress={() => {
                onChange({ ...form, visibility });
              }}
              tone={visibility === 'Sensitive' ? 'warning' : 'default'}
            />
          ))}
        </View>
        {form.type === 'Merit' ? (
          <View style={styles.generalNotice}>
            <Text style={styles.generalNoticeText}>
              Merit entries are saved as General visibility.
            </Text>
          </View>
        ) : null}
        {form.visibility === 'Sensitive' ? (
          <View style={styles.sensitiveNotice}>
            <Text style={styles.sensitiveNoticeText}>
              Sensitive entries are restricted. Save will fail if your role is not permitted.
            </Text>
          </View>
        ) : null}
      </View>

      <MobileButton
        disabled={saving}
        label={saveButtonLabel(form.type, saving)}
        onPress={onSubmit}
        variant={form.type === 'Merit' ? 'navy' : 'primary'}
      />
    </Card>
  );
}

function DemeritStagePreviewPanel({ preview }: { preview: DemeritStagePreview | null }) {
  if (!preview) return null;

  return (
    <View style={[styles.stagePreview, preview.escalates ? styles.stagePreviewEscalates : null]}>
      <Text style={styles.stagePreviewLabel}>Demerit stage preview</Text>
      <Text style={styles.stagePreviewTitle}>
        {formatDemeritStage(preview.previousStage)} to {formatDemeritStage(preview.nextStage)}
      </Text>
      {preview.escalates ? <Text style={styles.stagePreviewFlag}>Stage change</Text> : null}
      {preview.noteRequired ? (
        <Text style={styles.stagePreviewHint}>Note required from Stage 3.</Text>
      ) : null}
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
  tone: 'danger' | 'default' | 'success' | 'warning';
}) {
  const palette = {
    danger: { backgroundColor: C.dangerBg, borderColor: C.dangerMid, color: C.danger },
    default: { backgroundColor: C.blueLight, borderColor: C.blueMid, color: C.navy },
    success: { backgroundColor: C.successBg, borderColor: C.successMid, color: C.success },
    warning: { backgroundColor: C.warningBg, borderColor: C.warningBg, color: C.warning },
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
  fieldLabel: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },
  formCard: {
    gap: 12,
    padding: 16,
  },
  generalNotice: {
    backgroundColor: C.blueLight,
    borderColor: C.blueMid,
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
  },
  generalNoticeText: {
    color: C.navy,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 17,
  },
  generalNoticeTitle: {
    color: C.navy,
    fontSize: 12,
    fontWeight: '900',
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
    minWidth: 120,
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
  selectedRow: {
    gap: 3,
  },
  selectedStudent: {
    color: C.navy,
    fontSize: 16,
    fontWeight: '900',
  },
  sensitiveNotice: {
    backgroundColor: C.warningBg,
    borderColor: C.warningBg,
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
  },
  sensitiveNoticeText: {
    color: C.warning,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 17,
  },
  stagePreview: {
    backgroundColor: C.blueLight,
    borderColor: C.blueMid,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
    padding: 10,
  },
  stagePreviewEscalates: {
    backgroundColor: C.warningBg,
    borderColor: C.warningBg,
  },
  stagePreviewFlag: {
    color: C.warning,
    fontSize: 12,
    fontWeight: '900',
  },
  stagePreviewHint: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  stagePreviewLabel: {
    color: C.textMuted,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  stagePreviewTitle: {
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

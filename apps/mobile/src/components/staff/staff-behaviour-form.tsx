import { Pressable, StyleSheet, Text, View } from 'react-native';
import { C } from '../core/mobile-theme';
import { Card, Field, MobileButton } from '../core/mobile-ui';
import {
  behaviourTypes,
  behaviourVisibilities,
  categoryOptions,
  type BehaviourFormErrors,
  type BehaviourFormState,
} from './staff-behaviour-utils';

export function BehaviourFormCard({
  errors,
  form,
  onChange,
  onSubmit,
  saving,
  selectedStudentName,
  submitted,
}: {
  errors: BehaviourFormErrors;
  form: BehaviourFormState;
  onChange: (next: BehaviourFormState) => void;
  onSubmit: () => void;
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
            label={type}
            onPress={() => {
              onChange({ ...form, category: categoryOptions(type)[0] ?? '', type });
            }}
            tone={type === 'Merit' ? 'success' : 'danger'}
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

      {form.type === 'Merit' ? (
        <Field
          keyboardType="numeric"
          label="Merit amount"
          onChangeText={(amount) => {
            onChange({ ...form, amount });
          }}
          value={form.amount}
        />
      ) : null}
      {submitted && errors.amount ? (
        <Text style={styles.validationText}>{errors.amount}</Text>
      ) : null}

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
          {behaviourVisibilities.map((visibility) => (
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
        label={saving ? 'Saving behaviour...' : 'Save behaviour'}
        onPress={onSubmit}
        variant={form.type === 'Merit' ? 'navy' : 'primary'}
      />
    </Card>
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
  validationText: {
    color: C.danger,
    fontSize: 12,
    fontWeight: '700',
  },
});

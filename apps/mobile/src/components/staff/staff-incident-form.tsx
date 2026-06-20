import { StyleSheet, Text, View } from 'react-native';
import { C } from '../core/mobile-theme';
import { Card, Field, MobileButton } from '../core/mobile-ui';
import {
  IncidentOptionButton,
  IncidentSeverityButton,
  IncidentToggleRow,
} from './staff-incident-form-controls';
import {
  incidentConfidentialities,
  incidentConfidentialityLabels,
  incidentSeverities,
  incidentSeverityLabels,
  incidentTypeLabels,
  incidentTypes,
  type IncidentFormErrors,
  type IncidentFormState,
} from './staff-incident-utils';

export function StaffIncidentFormCard({
  errors,
  form,
  onChange,
  onSaveDraft,
  saving,
  submitted,
}: {
  errors: IncidentFormErrors;
  form: IncidentFormState;
  onChange: (next: IncidentFormState) => void;
  onSaveDraft: () => void;
  saving: boolean;
  submitted: boolean;
}) {
  return (
    <Card style={styles.formCard}>
      <View style={styles.optionGroup}>
        <Text style={styles.fieldLabel}>Incident type</Text>
        <View style={styles.optionRow}>
          {incidentTypes.map((type) => (
            <IncidentOptionButton
              active={form.type === type}
              key={type}
              label={incidentTypeLabels[type]}
              onPress={() => {
                onChange({ ...form, type });
              }}
            />
          ))}
        </View>
      </View>

      <View style={styles.optionGroup}>
        <Text style={styles.fieldLabel}>Severity</Text>
        <View style={styles.segmentedRow}>
          {incidentSeverities.map((severity) => (
            <IncidentSeverityButton
              active={form.severity === severity}
              key={severity}
              label={incidentSeverityLabels[severity]}
              onPress={() => {
                onChange({ ...form, severity });
              }}
              severity={severity}
            />
          ))}
        </View>
      </View>

      <View style={styles.optionGroup}>
        <Text style={styles.fieldLabel}>Confidentiality</Text>
        <View style={styles.optionRow}>
          {incidentConfidentialities.map((confidentiality) => (
            <IncidentOptionButton
              active={form.confidentiality === confidentiality}
              key={confidentiality}
              label={incidentConfidentialityLabels[confidentiality]}
              onPress={() => {
                onChange({ ...form, confidentiality });
              }}
            />
          ))}
        </View>
        <View style={styles.policyNotice}>
          <Text style={styles.policyNoticeTitle}>Parent visibility stays off</Text>
          <Text style={styles.policyNoticeText}>
            Mobile can request parent visibility, but Head review and parent PDF release stay in the
            web workflow.
          </Text>
        </View>
      </View>

      <View style={styles.dateRow}>
        <View style={styles.dateField}>
          <Field
            label="Date"
            onChangeText={(occurredDate) => {
              onChange({ ...form, occurredDate });
            }}
            value={form.occurredDate}
          />
        </View>
        <View style={styles.timeField}>
          <Field
            label="Time"
            onChangeText={(occurredTime) => {
              onChange({ ...form, occurredTime });
            }}
            value={form.occurredTime}
          />
        </View>
      </View>
      {submitted && errors.occurredAt ? (
        <Text style={styles.validationText}>{errors.occurredAt}</Text>
      ) : null}

      <Field
        label="Location"
        onChangeText={(location) => {
          onChange({ ...form, location });
        }}
        placeholder="Where did this happen?"
        value={form.location}
      />
      {submitted && errors.location ? (
        <Text style={styles.validationText}>{errors.location}</Text>
      ) : null}

      <Field
        label="Context / activity"
        onChangeText={(activity) => {
          onChange({ ...form, activity });
        }}
        placeholder="Classroom, break, club, trip..."
        value={form.activity}
      />

      <Field
        label="Factual account"
        multiline
        onChangeText={(factualAccount) => {
          onChange({ ...form, factualAccount });
        }}
        placeholder="Record factual details only"
        value={form.factualAccount}
      />
      {submitted && errors.factualAccount ? (
        <Text style={styles.validationText}>{errors.factualAccount}</Text>
      ) : null}

      <Field
        label="Immediate actions"
        multiline
        onChangeText={(immediateActions) => {
          onChange({ ...form, immediateActions });
        }}
        placeholder="Actions taken to keep children safe"
        value={form.immediateActions}
      />
      {submitted && errors.immediateActions ? (
        <Text style={styles.validationText}>{errors.immediateActions}</Text>
      ) : null}

      <Field
        label="Direct disclosure"
        multiline
        onChangeText={(directDisclosure) => {
          onChange({ ...form, directDisclosure });
        }}
        placeholder="Record direct words in quotation marks"
        value={form.directDisclosure}
      />

      <Field
        label="Witnesses"
        onChangeText={(witnesses) => {
          onChange({ ...form, witnesses });
        }}
        placeholder="Names or context"
        value={form.witnesses}
      />

      <View style={styles.optionGroup}>
        <Text style={styles.fieldLabel}>Reportability checklist</Text>
        <IncidentToggleRow
          active={form.dslNotified}
          label="DSL notified"
          onPress={() => {
            onChange({ ...form, dslNotified: !form.dslNotified });
          }}
        />
        <IncidentToggleRow
          active={form.injurySustained}
          label="Injury sustained"
          onPress={() => {
            onChange({ ...form, injurySustained: !form.injurySustained });
          }}
        />
        <IncidentToggleRow
          active={form.firstAidGiven}
          label="First aid given"
          onPress={() => {
            onChange({ ...form, firstAidGiven: !form.firstAidGiven });
          }}
        />
        <IncidentToggleRow
          active={form.emergencyServicesContacted}
          label="Emergency services contacted"
          onPress={() => {
            onChange({ ...form, emergencyServicesContacted: !form.emergencyServicesContacted });
          }}
        />
        <IncidentToggleRow
          active={form.hospitalTreatment}
          label="Hospital treatment"
          onPress={() => {
            onChange({ ...form, hospitalTreatment: !form.hospitalTreatment });
          }}
        />
        <IncidentToggleRow
          active={form.parentCarerNotified}
          label="Parent / carer notified"
          onPress={() => {
            onChange({ ...form, parentCarerNotified: !form.parentCarerNotified });
          }}
        />
        <IncidentToggleRow
          active={form.parentVisibilityRequested}
          label="Request parent-safe copy after sign-off"
          onPress={() => {
            onChange({ ...form, parentVisibilityRequested: !form.parentVisibilityRequested });
          }}
        />
      </View>

      <View style={styles.policyNotice}>
        <Text style={styles.policyNoticeTitle}>Evidence attachments</Text>
        <Text style={styles.policyNoticeText}>
          Add attachment notes here. File upload and parent PDF attachment selection stay with the
          web review workflow until the API can bind uploads to drafts.
        </Text>
      </View>
      <Field
        label="Evidence notes"
        multiline
        onChangeText={(evidenceNotes) => {
          onChange({ ...form, evidenceNotes });
        }}
        placeholder="Photo names, document references, or upload reminders"
        value={form.evidenceNotes}
      />

      <MobileButton
        disabled={saving}
        label={saving ? 'Saving draft...' : 'Save incident draft'}
        onPress={onSaveDraft}
        variant="navy"
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  dateField: {
    flex: 1,
    minWidth: 160,
  },
  dateRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  fieldLabel: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },
  formCard: {
    gap: 12,
    padding: 16,
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
  segmentedRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timeField: {
    minWidth: 96,
    width: 112,
  },
  validationText: {
    color: C.danger,
    fontSize: 12,
    fontWeight: '700',
  },
});

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { type RouterOutputs } from '../../lib/trpc';
import { C } from '../core/mobile-theme';
import { Badge, Card, MutedText, MobileButton } from '../core/mobile-ui';
import {
  absenceReasons,
  attendanceStatuses,
  buildDraft,
  isDraftSaveable,
  reasonLabel,
  type AttendanceDraft,
  type AttendanceStatus,
} from './staff-attendance-utils';

export type AttendanceRowData = RouterOutputs['attendance']['forDate'][number];

export function AttendanceRoster({
  drafts,
  onChangeDraft,
  onSave,
  pendingStudentId,
  rows,
  saving,
}: {
  drafts: Record<string, AttendanceDraft | undefined>;
  onChangeDraft: (studentId: string, draft: AttendanceDraft) => void;
  onSave: (row: AttendanceRowData, draft: AttendanceDraft) => void;
  pendingStudentId: string | null;
  rows: AttendanceRowData[];
  saving: boolean;
}) {
  if (rows.length === 0) {
    return (
      <Card style={styles.emptyCard}>
        <Text style={styles.cardTitle}>No roster available</Text>
        <MutedText>No attendance register is available for your current scope.</MutedText>
      </Card>
    );
  }

  return (
    <View style={styles.list}>
      {rows.map((row) => (
        <AttendanceRosterRow
          draft={drafts[row.studentId]}
          key={row.studentId}
          onChangeDraft={(draft) => {
            onChangeDraft(row.studentId, draft);
          }}
          onSave={(draft) => {
            onSave(row, draft);
          }}
          pending={pendingStudentId === row.studentId}
          row={row}
          saving={saving}
        />
      ))}
    </View>
  );
}

function AttendanceRosterRow({
  draft,
  onChangeDraft,
  onSave,
  pending,
  row,
  saving,
}: {
  draft: AttendanceDraft | undefined;
  onChangeDraft: (draft: AttendanceDraft) => void;
  onSave: (draft: AttendanceDraft) => void;
  pending: boolean;
  row: AttendanceRowData;
  saving: boolean;
}) {
  const activeDraft = draft ?? (row.status ? buildDraft(row.status, row.absenceReason) : null);
  const activeStatus = activeDraft?.status ?? null;
  const canSave = isDraftSaveable(draft) && !pending && !saving;
  const statusVariant =
    row.status === 'Present'
      ? 'success'
      : row.status === 'Late'
        ? 'warning'
        : row.status === 'Absent'
          ? 'danger'
          : 'neutral';

  return (
    <Card style={[styles.rowCard, row.status === 'Absent' ? styles.absentCard : null]}>
      <View style={styles.rowHeader}>
        <View style={styles.rowBody}>
          <Text style={styles.studentName}>{row.studentName}</Text>
          <Text style={styles.studentMeta}>{row.yearGroup}</Text>
        </View>
        <Badge variant={statusVariant}>{row.status ? row.status : 'Unmarked'}</Badge>
      </View>

      <View style={styles.statusRow}>
        {attendanceStatuses.map((status) => (
          <StatusButton
            active={activeStatus === status}
            key={status}
            label={status}
            onPress={() => {
              onChangeDraft(buildDraft(status, activeDraft?.absenceReason));
            }}
            status={status}
          />
        ))}
      </View>

      {activeStatus === 'Absent' ? (
        <View style={styles.reasonGroup}>
          <Text style={styles.reasonLabel}>Absence reason</Text>
          <View style={styles.reasonRow}>
            {absenceReasons.map((reason) => (
              <ReasonButton
                active={activeDraft?.absenceReason === reason}
                key={reason}
                label={reasonLabel(reason)}
                onPress={() => {
                  onChangeDraft({ absenceReason: reason, status: 'Absent' });
                }}
              />
            ))}
          </View>
          {!activeDraft?.absenceReason ? (
            <Text style={styles.validationText}>Choose a reason before saving absent.</Text>
          ) : null}
        </View>
      ) : null}

      {row.absenceReasonLabel && row.status === 'Absent' ? (
        <MutedText>Saved reason: {row.absenceReasonLabel}</MutedText>
      ) : null}

      <View style={styles.footerRow}>
        <MutedText>{row.recordedAt ? 'Saved' : 'Not saved yet'}</MutedText>
        <MobileButton
          compact
          disabled={!canSave}
          label={pending ? 'Saving...' : 'Save'}
          onPress={() => {
            if (draft) onSave(draft);
          }}
          variant="blue"
        />
      </View>
    </Card>
  );
}

function StatusButton({
  active,
  label,
  onPress,
  status,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
  status: AttendanceStatus;
}) {
  const palette = {
    Absent: { activeBg: C.dangerBg, border: C.dangerMid, color: C.danger },
    Late: { activeBg: C.warningBg, border: C.warningBg, color: C.warning },
    Present: { activeBg: C.successBg, border: C.successMid, color: C.success },
  }[status];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[
        styles.statusButton,
        active
          ? { backgroundColor: palette.activeBg, borderColor: palette.border }
          : styles.inactiveButton,
      ]}
    >
      <Text style={[styles.statusText, active ? { color: palette.color } : null]}>{label}</Text>
    </Pressable>
  );
}

function ReasonButton({
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
      style={[styles.reasonButton, active ? styles.reasonButtonActive : null]}
    >
      <Text style={[styles.reasonButtonText, active ? styles.reasonButtonTextActive : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  absentCard: {
    borderLeftColor: C.danger,
    borderLeftWidth: 4,
  },
  cardTitle: {
    color: C.navy,
    fontSize: 14,
    fontWeight: '900',
  },
  emptyCard: {
    padding: 16,
  },
  footerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  inactiveButton: {
    backgroundColor: C.surface,
    borderColor: C.border,
  },
  list: {
    gap: 10,
  },
  reasonButton: {
    backgroundColor: C.surface,
    borderColor: C.border,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  reasonButtonActive: {
    backgroundColor: C.dangerBg,
    borderColor: C.dangerMid,
  },
  reasonButtonText: {
    color: C.textSecondary,
    fontSize: 11,
    fontWeight: '800',
  },
  reasonButtonTextActive: {
    color: C.danger,
  },
  reasonGroup: {
    gap: 8,
  },
  reasonLabel: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },
  reasonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  rowBody: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  rowCard: {
    gap: 12,
    padding: 14,
  },
  rowHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  statusButton: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1.5,
    flex: 1,
    minHeight: 38,
    minWidth: 82,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusText: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: '900',
  },
  studentMeta: {
    color: C.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  studentName: {
    color: C.navy,
    fontSize: 15,
    fontWeight: '900',
    lineHeight: 20,
  },
  validationText: {
    color: C.danger,
    fontSize: 12,
    fontWeight: '700',
  },
});

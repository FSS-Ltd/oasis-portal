import { Pressable, StyleSheet, Text, View } from 'react-native';
import { type RouterOutputs } from '../../lib/trpc';
import { C } from '../core/mobile-theme';
import { Badge, Card, Field, MobileButton, MutedText } from '../core/mobile-ui';
import {
  attendanceStatuses,
  isMinibusRegister,
  specialAttendanceRegisters,
  specialRegisterLabel,
  type AttendanceStatus,
  type SpecialAttendanceRegister,
} from './staff-attendance-utils';

export type SpecialAttendanceRowData =
  RouterOutputs['attendance']['specialForDate']['rows'][number];

export function StaffSpecialAttendanceRoster({
  available = true,
  destination,
  error,
  loading,
  onChangeDestination,
  onChangeRegister,
  onSaveDestination,
  onSaveRow,
  pendingStudentId,
  register,
  rows,
  saving,
  savingDestination,
  sessionDestination,
}: {
  available?: boolean;
  destination: string;
  error: string | null;
  loading: boolean;
  onChangeDestination: (destination: string) => void;
  onChangeRegister: (register: SpecialAttendanceRegister) => void;
  onSaveDestination: () => void;
  onSaveRow: (row: SpecialAttendanceRowData, status: AttendanceStatus) => void;
  pendingStudentId: string | null;
  register: SpecialAttendanceRegister;
  rows: SpecialAttendanceRowData[];
  saving: boolean;
  savingDestination: boolean;
  sessionDestination: string;
}) {
  const minibus = isMinibusRegister(register);
  const destinationSaved = sessionDestination.trim().length > 0;
  const markDisabled = !available || (minibus && !destinationSaved);

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.cardTitle}>Special attendance</Text>
          <MutedText>Choose a register for trips, minibus journeys, or The Cedars.</MutedText>
        </View>
        <Badge variant="blue">{specialRegisterLabel(register)}</Badge>
      </View>

      <View style={styles.registerGrid}>
        {specialAttendanceRegisters.map((option) => (
          <RegisterButton
            active={register === option.id}
            key={option.id}
            label={option.label}
            onPress={() => {
              onChangeRegister(option.id);
            }}
          />
        ))}
      </View>

      {minibus ? (
        <View style={styles.destinationCard}>
          <Field
            label="Minibus destination"
            onChangeText={onChangeDestination}
            placeholder="Enter journey location"
            value={destination}
          />
          <MobileButton
            compact
            disabled={!available || destination.trim().length === 0 || savingDestination}
            label={savingDestination ? 'Saving...' : 'Save destination'}
            onPress={onSaveDestination}
            variant="blue"
          />
          {!destinationSaved ? (
            <Text style={styles.validationText}>
              Save the minibus destination before marking journey attendance.
            </Text>
          ) : null}
        </View>
      ) : null}

      {loading ? <MutedText>Loading special attendance...</MutedText> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {rows.length === 0 && !loading && !error ? (
        <MutedText>No students are available for this special register scope.</MutedText>
      ) : null}

      <View style={styles.list}>
        {rows.map((row) => (
          <SpecialAttendanceRow
            disabled={markDisabled || saving}
            key={row.studentId}
            onSave={(status) => {
              onSaveRow(row, status);
            }}
            pending={pendingStudentId === row.studentId}
            row={row}
          />
        ))}
      </View>
    </Card>
  );
}

function RegisterButton({
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
      style={[styles.registerButton, active ? styles.registerButtonActive : null]}
    >
      <Text style={[styles.registerButtonText, active ? styles.registerButtonTextActive : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

function SpecialAttendanceRow({
  disabled,
  onSave,
  pending,
  row,
}: {
  disabled: boolean;
  onSave: (status: AttendanceStatus) => void;
  pending: boolean;
  row: SpecialAttendanceRowData;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowHeader}>
        <View style={styles.rowBody}>
          <Text style={styles.studentName}>{row.studentName}</Text>
          <Text style={styles.studentMeta}>{row.yearGroup}</Text>
        </View>
        <Badge variant={statusVariant(row.status)}>{row.status ?? 'Unmarked'}</Badge>
      </View>
      <View style={styles.statusRow}>
        {attendanceStatuses.map((status) => (
          <StatusButton
            active={row.status === status}
            disabled={disabled || pending}
            key={status}
            label={status}
            onPress={() => {
              onSave(status);
            }}
            status={status}
          />
        ))}
      </View>
      <MutedText>{row.recordedAt ? 'Saved' : pending ? 'Saving...' : 'Not saved yet'}</MutedText>
    </View>
  );
}

function statusVariant(
  status: SpecialAttendanceRowData['status'],
): 'danger' | 'neutral' | 'success' | 'warning' {
  if (status === 'Absent') return 'danger';
  if (status === 'Late') return 'warning';
  if (status === 'Present') return 'success';
  return 'neutral';
}

function StatusButton({
  active,
  disabled,
  label,
  onPress,
  status,
}: {
  active: boolean;
  disabled: boolean;
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
      accessibilityState={{ disabled, selected: active }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.statusButton,
        active
          ? { backgroundColor: palette.activeBg, borderColor: palette.border }
          : styles.inactiveButton,
        disabled ? styles.disabled : null,
      ]}
    >
      <Text style={[styles.statusText, active ? { color: palette.color } : null]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 14,
    padding: 14,
  },
  cardTitle: {
    color: C.navy,
    fontSize: 15,
    fontWeight: '900',
  },
  destinationCard: {
    backgroundColor: C.bg,
    borderColor: C.border,
    borderRadius: 10,
    borderWidth: 1,
    gap: 10,
    padding: 12,
  },
  disabled: {
    opacity: 0.5,
  },
  errorText: {
    color: C.danger,
    fontSize: 12,
    fontWeight: '800',
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  headerText: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  inactiveButton: {
    backgroundColor: C.surface,
    borderColor: C.border,
  },
  list: {
    gap: 10,
  },
  registerButton: {
    alignItems: 'center',
    backgroundColor: C.surface,
    borderColor: C.border,
    borderRadius: 8,
    borderWidth: 1.5,
    flexBasis: '48%',
    flexGrow: 1,
    minHeight: 38,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  registerButtonActive: {
    backgroundColor: C.blueLight,
    borderColor: C.blueMid,
  },
  registerButtonText: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  registerButtonTextActive: {
    color: C.navy,
  },
  registerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  row: {
    backgroundColor: C.surface,
    borderColor: C.border,
    borderRadius: 10,
    borderWidth: 1,
    gap: 10,
    padding: 12,
  },
  rowBody: {
    flex: 1,
    gap: 2,
    minWidth: 0,
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

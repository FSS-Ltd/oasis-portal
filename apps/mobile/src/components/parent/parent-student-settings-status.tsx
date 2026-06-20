import { Image, Pressable, Text, View } from 'react-native';
import { Badge, Card, MutedText } from '../smoke/smoke-ui';
import { displaySchoolYearLabel, initials } from './parent-home-utils';
import { parentStudentSettingsStyles as styles } from './parent-student-settings-styles';
import type { LinkedChildSettings } from './parent-student-settings-types';

function lockLabel(child: LinkedChildSettings): string {
  if (!child.effectiveLock.locked) return 'Open';
  return child.effectiveLock.primarySource === 'HeadAcademic' ? 'Academic lock' : 'Parent lock';
}

function boolVariant(active: boolean): 'danger' | 'success' {
  return active ? 'danger' : 'success';
}

export function ChildPicker({
  children,
  selectedChildId,
  onSelect,
}: {
  children: readonly LinkedChildSettings[];
  selectedChildId: string | null;
  onSelect: (studentId: string) => void;
}) {
  return (
    <View style={styles.childPicker}>
      {children.map((child) => {
        const active = child.studentId === selectedChildId;
        return (
          <Pressable
            accessibilityRole="button"
            key={child.studentId}
            onPress={() => {
              onSelect(child.studentId);
            }}
            style={[styles.childChip, active ? styles.childChipActive : null]}
          >
            <Text style={[styles.childChipText, active ? styles.childChipTextActive : null]}>
              {child.fullName}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function SettingsStatusCard({ child }: { child: LinkedChildSettings }) {
  const adult = !child.parentControlAllowed;

  return (
    <Card>
      <View style={styles.childHeader}>
        <ChildIcon child={child} />
        <View style={styles.childHeaderText}>
          <Text style={styles.cardTitle}>{child.fullName}</Text>
          <MutedText>{displaySchoolYearLabel(child.yearGroup)}</MutedText>
        </View>
      </View>
      <View style={styles.statusGrid}>
        <StatusTile
          label="Parent controls"
          value={adult ? 'Read-only at 18' : 'Available'}
          variant={adult ? 'neutral' : 'success'}
        />
        <StatusTile
          label="Portal account"
          value={child.accountLinked ? lockLabel(child) : 'Login needed'}
          variant={!child.accountLinked || child.effectiveLock.locked ? 'warning' : 'success'}
        />
        <StatusTile
          label="Password changes"
          value={adult ? 'Student owned' : child.studentCanManagePassword ? 'Allowed' : 'Parent only'}
          variant={child.studentCanManagePassword || adult ? 'blue' : 'warning'}
        />
        <StatusTile
          label="Merit shop"
          value={child.parentMeritShopBlocked ? 'Blocked' : 'Allowed'}
          variant={boolVariant(child.parentMeritShopBlocked)}
        />
      </View>
      {child.headAcademicLocked ? (
        <MutedText>
          Oasis has locked this portal for academic reasons.
          {child.headAcademicLockReason ? ` ${child.headAcademicLockReason}` : ''}
        </MutedText>
      ) : null}
      {adult ? (
        <MutedText>
          Adult child: account controls are read-only because this student is 18 or older.
        </MutedText>
      ) : null}
    </Card>
  );
}

function StatusTile({
  label,
  value,
  variant,
}: {
  label: string;
  value: string;
  variant: 'blue' | 'danger' | 'neutral' | 'success' | 'warning';
}) {
  return (
    <View style={styles.statusTile}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Badge variant={variant}>{value}</Badge>
    </View>
  );
}

export function ChildIcon({ child }: { child: LinkedChildSettings }) {
  if (child.childIconPhotoUrl) {
    return (
      <Image
        accessibilityLabel={`${child.fullName} child icon`}
        source={{ uri: child.childIconPhotoUrl }}
        style={styles.childPhoto}
      />
    );
  }

  return (
    <View style={styles.childInitials}>
      <Text style={styles.childInitialsText}>{initials(child.fullName)}</Text>
    </View>
  );
}

export function ToggleRow({
  checked,
  disabled,
  label,
  onToggle,
  sub,
}: {
  checked: boolean;
  disabled: boolean;
  label: string;
  onToggle: (checked: boolean) => void;
  sub: string;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={() => {
        onToggle(!checked);
      }}
      style={[styles.toggleRow, disabled ? styles.disabled : null]}
    >
      <View style={styles.toggleText}>
        <Text style={styles.smallStrong}>{label}</Text>
        <MutedText>{sub}</MutedText>
      </View>
      <View style={[styles.toggleTrack, checked ? styles.toggleTrackActive : null]}>
        <View style={[styles.toggleKnob, checked ? styles.toggleKnobActive : null]} />
      </View>
    </Pressable>
  );
}

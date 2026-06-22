import { StyleSheet, Text, View } from 'react-native';
import { C } from '../core/mobile-theme';
import { Badge, MutedText } from '../core/mobile-ui';
import type { StudentCommunityGroup } from './student-community-utils';

interface StudentCommunityContactsProps {
  currentStudentId: string | null;
  group: StudentCommunityGroup;
}

export function StudentCommunityContacts({
  currentStudentId,
  group,
}: StudentCommunityContactsProps) {
  return (
    <View style={styles.contacts}>
      <View style={styles.rowBetween}>
        <Text style={styles.contactsTitle}>Student contacts</Text>
        <Badge variant="blue">{String(group.members.length)}</Badge>
      </View>
      {group.members.length === 0 ? <MutedText>No contacts yet.</MutedText> : null}
      {group.members.map((member) => (
        <View key={member.studentId} style={styles.contactRow}>
          <View style={styles.contactAvatar}>
            <Text style={styles.contactAvatarText}>{initialsFor(member.student.fullName)}</Text>
          </View>
          <View style={styles.copy}>
            <Text style={styles.contactName}>
              {member.studentId === currentStudentId ? 'You' : member.student.fullName}
            </Text>
            <Text style={styles.contactMeta}>
              {member.student.yearGroup ? `Year ${member.student.yearGroup}` : 'Student'}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function initialsFor(name: string): string {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
  return initials || 'ST';
}

const styles = StyleSheet.create({
  contactAvatar: {
    alignItems: 'center',
    backgroundColor: C.blueLight,
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  contactAvatarText: {
    color: C.navy,
    fontSize: 11,
    fontWeight: '900',
  },
  contactMeta: {
    color: C.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  contactName: {
    color: C.navy,
    fontSize: 13,
    fontWeight: '900',
  },
  contactRow: {
    alignItems: 'center',
    borderColor: C.borderLight,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 10,
  },
  contacts: {
    gap: 8,
  },
  contactsTitle: {
    color: C.navy,
    fontSize: 12,
    fontWeight: '900',
  },
  copy: {
    flex: 1,
    gap: 3,
  },
  rowBetween: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
});

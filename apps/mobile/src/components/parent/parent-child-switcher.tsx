import { Pressable, StyleSheet, Text, View } from 'react-native';
import { C } from '../core/mobile-theme';
import { Card, MutedText } from '../core/mobile-ui';
import { displaySchoolYearLabel, initials, type ParentDashboardChild } from './parent-home-utils';

export interface ParentChildSwitcherOption {
  id: string;
  fullName: string;
  yearGroup: string;
}

type ParentChildSwitcherChild = ParentDashboardChild | ParentChildSwitcherOption;

function switcherOption(child: ParentChildSwitcherChild): ParentChildSwitcherOption {
  if ('student' in child) {
    return {
      id: child.student.id,
      fullName: child.student.fullName,
      yearGroup: child.student.yearGroup,
    };
  }
  return child;
}

export function ParentChildSwitcher({
  children,
  onSelect,
  selectedChildId,
}: {
  children: readonly ParentChildSwitcherChild[];
  onSelect: (studentId: string) => void;
  selectedChildId: string;
}) {
  if (children.length <= 1) return null;

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Switch child</Text>
        <MutedText>{String(children.length)} linked children</MutedText>
      </View>
      <View style={styles.row}>
        {children.map((child) => {
          const option = switcherOption(child);
          const selected = option.id === selectedChildId;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={option.id}
              onPress={() => {
                onSelect(option.id);
              }}
              style={[styles.childButton, selected ? styles.childButtonActive : null]}
            >
              <View style={[styles.avatar, selected ? styles.avatarActive : null]}>
                <Text style={[styles.avatarText, selected ? styles.avatarTextActive : null]}>
                  {initials(option.fullName)}
                </Text>
              </View>
              <View style={styles.childText}>
                <Text numberOfLines={1} style={styles.childName}>
                  {option.fullName}
                </Text>
                <Text style={styles.childYear}>{displaySchoolYearLabel(option.yearGroup)}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    backgroundColor: C.blueLight,
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  avatarActive: {
    backgroundColor: C.crimson,
  },
  avatarText: {
    color: C.navy,
    fontSize: 12,
    fontWeight: '900',
  },
  avatarTextActive: {
    color: C.surface,
  },
  card: {
    padding: 14,
  },
  childButton: {
    alignItems: 'center',
    backgroundColor: C.bg,
    borderColor: C.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 56,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  childButtonActive: {
    backgroundColor: C.crimsonLight,
    borderColor: C.crimson,
  },
  childName: {
    color: C.navy,
    fontSize: 13,
    fontWeight: '900',
  },
  childText: {
    flex: 1,
    minWidth: 0,
  },
  childYear: {
    color: C.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  header: {
    gap: 2,
  },
  row: {
    gap: 8,
  },
  title: {
    color: C.navy,
    fontSize: 15,
    fontWeight: '900',
  },
});

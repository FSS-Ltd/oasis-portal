import { StyleSheet, Text, View } from 'react-native';
import { C } from '../core/mobile-theme';
import { Badge, Card, MutedText, SectionTitle, MobileButton } from '../core/mobile-ui';
import {
  dueBadgeLabel,
  dueBadgeVariant,
  formatHomeworkDate,
  formatHomeworkMerits,
  formatHomeworkScore,
  submissionMethodLabel,
  type StudentHomeworkAssignment,
} from './student-homework-activity-utils';

interface StudentHomeworkActivityListProps {
  due: readonly StudentHomeworkAssignment[];
  graded: readonly StudentHomeworkAssignment[];
  selectedId: string | null;
  onSelect: (assignment: StudentHomeworkAssignment) => void;
}

export function StudentHomeworkActivityList({
  due,
  graded,
  selectedId,
  onSelect,
}: StudentHomeworkActivityListProps) {
  return (
    <View style={styles.stack}>
      <Card style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleGroup}>
            <Text style={styles.eyebrow}>Assigned work</Text>
            <SectionTitle>Current assignments</SectionTitle>
          </View>
          <Badge variant="blue">{String(due.length)}</Badge>
        </View>
        {due.length === 0 ? (
          <View style={styles.emptyBlock}>
            <Text style={styles.emptyTitle}>No assigned work</Text>
            <MutedText>Homework and activities assigned to you will appear here.</MutedText>
          </View>
        ) : (
          due.map((assignment) => (
            <AssignmentRow
              assignment={assignment}
              key={assignment.id}
              onSelect={onSelect}
              selected={assignment.id === selectedId}
            />
          ))
        )}
      </Card>

      <Card style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleGroup}>
            <Text style={styles.eyebrow}>Completed work</Text>
            <SectionTitle>Graded homework</SectionTitle>
          </View>
          <Badge variant="success">{String(graded.length)}</Badge>
        </View>
        {graded.length === 0 ? (
          <View style={styles.emptyBlock}>
            <Text style={styles.emptyTitle}>No graded homework</Text>
            <MutedText>Reviewed homework will appear here.</MutedText>
          </View>
        ) : (
          graded.slice(0, 4).map((assignment) => (
            <AssignmentRow
              assignment={assignment}
              key={assignment.id}
              onSelect={onSelect}
              selected={assignment.id === selectedId}
            />
          ))
        )}
      </Card>
    </View>
  );
}

function AssignmentRow({
  assignment,
  selected,
  onSelect,
}: {
  assignment: StudentHomeworkAssignment;
  selected: boolean;
  onSelect: (assignment: StudentHomeworkAssignment) => void;
}) {
  const reviewed = assignment.reviewedAt !== null;
  return (
    <View style={[styles.assignmentRow, selected ? styles.assignmentRowSelected : null]}>
      <View style={styles.assignmentCopy}>
        <View style={styles.assignmentTitleRow}>
          <Text style={styles.assignmentTitle}>{assignment.title}</Text>
          <Badge variant={reviewed ? 'success' : dueBadgeVariant(assignment)}>
            {reviewed ? 'Reviewed' : dueBadgeLabel(assignment)}
          </Badge>
        </View>
        <Text style={styles.assignmentMeta}>
          {submissionMethodLabel(assignment.submissionMethod)} · Due{' '}
          {formatHomeworkDate(assignment.dueDate)}
        </Text>
        {reviewed ? (
          <Text style={styles.assignmentMeta}>
            {formatHomeworkScore(assignment.scorePercent)} ·{' '}
            {formatHomeworkMerits(assignment.meritAmount)} awarded
          </Text>
        ) : null}
      </View>
      <MobileButton
        compact
        label={selected ? 'Open' : 'View'}
        onPress={() => {
          onSelect(assignment);
        }}
        variant={selected ? 'navy' : 'secondary'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  assignmentCopy: {
    flex: 1,
    gap: 5,
  },
  assignmentMeta: {
    color: C.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  assignmentRow: {
    alignItems: 'center',
    borderColor: C.borderLight,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 12,
  },
  assignmentRowSelected: {
    backgroundColor: C.blueLight,
    borderColor: C.blueMid,
  },
  assignmentTitle: {
    color: C.navy,
    flex: 1,
    fontSize: 13,
    fontWeight: '900',
  },
  assignmentTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  emptyBlock: {
    backgroundColor: C.bg,
    borderColor: C.borderLight,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
    padding: 12,
  },
  emptyTitle: {
    color: C.navy,
    fontSize: 13,
    fontWeight: '900',
  },
  eyebrow: {
    color: C.crimson,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  sectionCard: {
    gap: 12,
    padding: 16,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  sectionTitleGroup: {
    flex: 1,
    gap: 3,
  },
  stack: {
    gap: 14,
  },
});

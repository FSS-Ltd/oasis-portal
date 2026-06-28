import { StyleSheet, Text, View } from 'react-native';
import { C } from '../core/mobile-theme';
import { Badge, Card, MutedText, SectionTitle } from '../core/mobile-ui';
import { StudentHomeworkActivitySubmitPanel } from './student-homework-activity-submit-panel';
import {
  dueBadgeLabel,
  dueBadgeVariant,
  formatHomeworkDate,
  formatHomeworkMerits,
  formatHomeworkScore,
  submissionMethodLabel,
  type StudentHomeworkAssignment,
} from './student-homework-activity-utils';

interface StudentHomeworkActivityDetailProps {
  assignment: StudentHomeworkAssignment | null;
  onSubmitted: () => Promise<void>;
}

export function StudentHomeworkActivityDetail({
  assignment,
  onSubmitted,
}: StudentHomeworkActivityDetailProps) {
  if (!assignment) {
    return (
      <Card style={styles.detailCard}>
        <SectionTitle>Activity detail</SectionTitle>
        <MutedText>Select assigned work to inspect the detail and submission state.</MutedText>
      </Card>
    );
  }

  const reviewed = assignment.reviewedAt !== null;
  const submitted = assignment.submittedAt !== null;

  return (
    <Card style={styles.detailCard}>
      <View style={styles.detailHeader}>
        <View style={styles.detailTitleGroup}>
          <Text style={styles.eyebrow}>Activity detail</Text>
          <SectionTitle>{assignment.title}</SectionTitle>
        </View>
        <Badge variant={reviewed ? 'success' : dueBadgeVariant(assignment)}>
          {reviewed ? 'Reviewed' : dueBadgeLabel(assignment)}
        </Badge>
      </View>

      <Text style={styles.description}>{assignment.description}</Text>

      <View style={styles.metaGrid}>
        <DetailMeta label="Type" value="Homework" />
        <DetailMeta label="Due" value={formatHomeworkDate(assignment.dueDate)} />
        <DetailMeta label="Submit" value={submissionMethodLabel(assignment.submissionMethod)} />
        <DetailMeta
          label="Status"
          value={reviewed ? 'Reviewed' : submitted ? 'Submitted' : 'Assigned'}
        />
      </View>

      <ImageList images={assignment.questionImages} title="Question images" />
      <ImageList images={assignment.images} title="Submitted images" />

      {submitted && !reviewed ? (
        <View style={styles.statusPanel}>
          <Badge variant="success">Submitted</Badge>
          <MutedText>Your submission is waiting for review.</MutedText>
        </View>
      ) : null}

      {reviewed ? (
        <View style={styles.resultPanel}>
          <View style={styles.resultRow}>
            <Text style={styles.resultValue}>{formatHomeworkScore(assignment.scorePercent)}</Text>
            <Text style={styles.resultLabel}>
              {formatHomeworkMerits(assignment.meritAmount)} awarded
            </Text>
          </View>
          {assignment.comments ? (
            <Text style={styles.description}>{assignment.comments}</Text>
          ) : null}
        </View>
      ) : null}

      <StudentHomeworkActivitySubmitPanel assignment={assignment} onSubmitted={onSubmitted} />
    </Card>
  );
}

function DetailMeta({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaCard}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

function ImageList({
  images,
  title,
}: {
  images: readonly StudentHomeworkAssignment['images'][number][];
  title: 'Question images' | 'Submitted images';
}) {
  if (images.length === 0) return null;

  return (
    <View style={styles.imageList}>
      <Text style={styles.smallStrong}>{title}</Text>
      {images.map((image) => (
        <Text key={image.id} style={styles.imageName}>
          {image.fileName} · {formatHomeworkDate(image.createdAt)}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  description: {
    color: C.textPrimary,
    fontSize: 13,
    lineHeight: 19,
  },
  detailCard: {
    gap: 14,
    padding: 16,
  },
  detailHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  detailTitleGroup: {
    flex: 1,
    gap: 3,
  },
  eyebrow: {
    color: C.crimson,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  imageList: {
    backgroundColor: C.bg,
    borderColor: C.borderLight,
    borderRadius: 10,
    borderWidth: 1,
    gap: 5,
    padding: 10,
  },
  imageName: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  metaCard: {
    backgroundColor: C.blueLight,
    borderColor: C.borderLight,
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    gap: 3,
    minWidth: 96,
    padding: 10,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metaLabel: {
    color: C.textSecondary,
    fontSize: 11,
    fontWeight: '800',
  },
  metaValue: {
    color: C.navy,
    fontSize: 13,
    fontWeight: '900',
  },
  resultLabel: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },
  resultPanel: {
    backgroundColor: C.successBg,
    borderColor: C.successMid,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
    padding: 12,
  },
  resultRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  resultValue: {
    color: C.success,
    fontSize: 24,
    fontWeight: '900',
  },
  smallStrong: {
    color: C.navy,
    fontSize: 13,
    fontWeight: '900',
  },
  statusPanel: {
    backgroundColor: C.bg,
    borderColor: C.borderLight,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
    padding: 12,
  },
});

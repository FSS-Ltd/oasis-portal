import { StyleSheet, Text, View } from 'react-native';
import { C } from '../core/mobile-theme';
import { Badge, Card, ErrorText, InlineSpinner, MutedText, SectionTitle } from '../core/mobile-ui';
import {
  clubLeadLabel,
  clubSpacesLabel,
  clubStatusVariant,
  formatStudentDate,
  type StudentClub,
  type StudentClubDetail,
} from './student-clubs-faith-utils';

interface StudentClubDetailPanelProps {
  detail: StudentClubDetail | undefined;
  error: string | null;
  fallbackClub: StudentClub | null;
  loading: boolean;
}

export function StudentClubDetailPanel({
  detail,
  error,
  fallbackClub,
  loading,
}: StudentClubDetailPanelProps) {
  const club = detail?.club ?? fallbackClub;

  return (
    <Card style={styles.detailCard}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>Club detail</Text>
          <SectionTitle>{club?.name ?? 'Club Noticeboard'}</SectionTitle>
        </View>
        {club ? <Badge variant={clubStatusVariant(club.status)}>{club.status}</Badge> : null}
      </View>

      {loading ? <InlineSpinner label="Loading clubs" /> : null}
      {error ? <ErrorText>{error}</ErrorText> : null}

      {club ? (
        <>
          <Text style={styles.description}>
            {club.description ?? 'More details will be added by the Learning Centre.'}
          </Text>
          <View style={styles.factGrid}>
            <Fact label="Schedule" value={club.scheduleLabel ?? 'Schedule to be confirmed'} />
            <Fact label="Places" value={clubSpacesLabel(club)} />
            <Fact label="Supervisor" value={clubLeadLabel(club.supervisorNames)} />
            <Fact label="Interest" value={club.interestedAt ? formatStudentDate(club.interestedAt) : club.status} />
          </View>

          <View style={styles.noticesPanel}>
            <View style={styles.noticeHead}>
              <View>
                <Text style={styles.eyebrow}>Noticeboard</Text>
                <SectionTitle>Club notices</SectionTitle>
              </View>
              <Badge variant="blue">{String(detail?.notices.length ?? 0)}</Badge>
            </View>
            {club.status !== 'Member' ? (
              <View style={styles.emptyBlock}>
                <Text style={styles.emptyTitle}>Member notices locked</Text>
                <MutedText>Join this club to see member notices.</MutedText>
              </View>
            ) : detail && detail.notices.length === 0 ? (
              <View style={styles.emptyBlock}>
                <Text style={styles.emptyTitle}>No club notices</Text>
                <MutedText>No notices have been posted yet.</MutedText>
              </View>
            ) : (
              detail?.notices.map((notice) => (
                <View key={notice.id} style={styles.noticeCard}>
                  <Text style={styles.noticeTitle}>{notice.title}</Text>
                  <Text style={styles.description}>{notice.body}</Text>
                  <Text style={styles.noticeDate}>{formatStudentDate(notice.sentAt)}</Text>
                </View>
              ))
            )}
          </View>
        </>
      ) : (
        <MutedText>Select a club to inspect schedule, status, and member notices.</MutedText>
      )}
    </Card>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.factCard}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
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
  factCard: {
    backgroundColor: C.blueLight,
    borderColor: C.borderLight,
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    gap: 3,
    minWidth: 118,
    padding: 10,
  },
  factGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  factLabel: {
    color: C.textSecondary,
    fontSize: 11,
    fontWeight: '800',
  },
  factValue: {
    color: C.navy,
    fontSize: 12,
    fontWeight: '900',
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  headerCopy: {
    flex: 1,
    gap: 3,
  },
  noticeCard: {
    backgroundColor: C.surface,
    borderColor: C.borderLight,
    borderRadius: 10,
    borderWidth: 1,
    gap: 5,
    padding: 10,
  },
  noticeDate: {
    color: C.textMuted,
    fontSize: 11,
    fontWeight: '800',
  },
  noticeHead: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  noticeTitle: {
    color: C.navy,
    fontSize: 13,
    fontWeight: '900',
  },
  noticesPanel: {
    borderColor: C.borderLight,
    borderRadius: 10,
    borderWidth: 1,
    gap: 10,
    padding: 12,
  },
});

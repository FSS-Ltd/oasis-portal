import { StyleSheet, Text, View } from 'react-native';
import { C } from '../core/mobile-theme';
import { Card, InlineSpinner, MutedText, SectionTitle } from '../core/mobile-ui';
import { StudentAttendancePanel } from './student-learning-attendance-panel';
import { StudentPacePanel } from './student-learning-pace-panel';
import { StudentRanksPanel } from './student-learning-ranks-panel';
import {
  formatAttendanceRate,
  type PublicLeaderboardKind,
  type StudentAttendance,
  type StudentDashboard,
  type StudentLeaderboard,
  type StudentPace,
} from './student-learning-utils';

interface StudentLearningScreenProps {
  attendance: StudentAttendance | undefined;
  attendanceError: string | null;
  dashboard: StudentDashboard | undefined;
  leaderboard: StudentLeaderboard | undefined;
  leaderboardError: string | null;
  leaderboardKind: PublicLeaderboardKind;
  loading: boolean;
  onSelectLeaderboardKind: (kind: PublicLeaderboardKind) => void;
  pace: StudentPace | undefined;
  paceError: string | null;
}

export function StudentLearningScreen({
  attendance,
  attendanceError,
  dashboard,
  leaderboard,
  leaderboardError,
  leaderboardKind,
  loading,
  onSelectLeaderboardKind,
  pace,
  paceError,
}: StudentLearningScreenProps) {
  if (loading && !dashboard) {
    return (
      <Card style={styles.stateCard}>
        <InlineSpinner label="Loading learning status" />
      </Card>
    );
  }

  if (!dashboard) {
    return (
      <Card style={styles.stateCard}>
        <SectionTitle>Learning unavailable</SectionTitle>
        <MutedText>No active student profile is linked to this account.</MutedText>
      </Card>
    );
  }

  if (!dashboard.profile.academicScreensEnabled) {
    return (
      <Card style={styles.stateCard}>
        <SectionTitle>Learning unavailable</SectionTitle>
        <MutedText>Academic screens will open when this year group is ready.</MutedText>
      </Card>
    );
  }

  return (
    <View style={styles.stack}>
      {loading ? (
        <Card style={styles.stateCard}>
          <InlineSpinner label="Loading learning status" />
        </Card>
      ) : null}

      <Card style={styles.heroCard}>
        <Text style={styles.eyebrow}>Learning</Text>
        <SectionTitle>PACE, attendance, and ranks</SectionTitle>
        <View style={styles.heroStats}>
          <HeroStat label="PACE completed" value={String(dashboard.pace.completedPaceCount)} />
          <HeroStat
            label="Attendance"
            value={formatAttendanceRate(dashboard.attendance.attendanceRate)}
          />
        </View>
      </Card>

      <StudentPacePanel error={paceError} loading={loading} pace={pace} />
      <StudentAttendancePanel attendance={attendance} error={attendanceError} loading={loading} />
      <StudentRanksPanel
        error={leaderboardError}
        leaderboard={leaderboard}
        leaderboardKind={leaderboardKind}
        onSelectLeaderboardKind={onSelectLeaderboardKind}
      />
    </View>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.heroStat}>
      <Text style={styles.heroStatValue}>{value}</Text>
      <Text style={styles.heroStatLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    color: C.crimson,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  heroCard: {
    gap: 14,
    padding: 16,
  },
  heroStat: {
    backgroundColor: C.blueLight,
    borderColor: C.borderLight,
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    gap: 3,
    minWidth: 96,
    padding: 10,
  },
  heroStatLabel: {
    color: C.textSecondary,
    fontSize: 11,
    fontWeight: '800',
  },
  heroStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  heroStatValue: {
    color: C.navy,
    fontSize: 14,
    fontWeight: '900',
  },
  stack: {
    gap: 14,
  },
  stateCard: {
    gap: 10,
    padding: 16,
  },
});

import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { C } from '../smoke/mobile-theme';
import { Badge, MutedText } from '../smoke/smoke-ui';
import { capacityLabel, leadLabel, type StaffManagedClub } from './staff-club-manager-utils';

export function StaffClubManagerClubList({
  clubs,
  onSelect,
  selectedClubId,
}: {
  clubs: StaffManagedClub[];
  onSelect: (clubId: string) => void;
  selectedClubId: string;
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.label}>All clubs</Text>
        <Badge variant="blue">{String(clubs.length)}</Badge>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.row}>
          {clubs.map((club) => {
            const active = club.id === selectedClubId;
            const accent = club.accentColor ?? C.blue;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                key={club.id}
                onPress={() => {
                  onSelect(club.id);
                }}
                style={[
                  styles.clubButton,
                  active ? { backgroundColor: C.navy, borderColor: C.navy } : null,
                ]}
              >
                <View style={[styles.accent, { backgroundColor: accent }]} />
                <Text style={[styles.clubName, active ? styles.clubNameActive : null]}>
                  {club.name}
                </Text>
                <MutedText>{capacityLabel(club)}</MutedText>
                <Text style={[styles.leadText, active ? styles.leadTextActive : null]}>
                  {leadLabel(club)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  accent: {
    borderRadius: 3,
    height: 6,
    width: 42,
  },
  clubButton: {
    backgroundColor: C.surface,
    borderColor: C.border,
    borderRadius: 10,
    borderWidth: 1,
    gap: 5,
    minHeight: 114,
    padding: 12,
    width: 180,
  },
  clubName: {
    color: C.navy,
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 18,
  },
  clubNameActive: {
    color: C.surface,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  leadText: {
    color: C.textSecondary,
    fontSize: 11,
    fontWeight: '800',
  },
  leadTextActive: {
    color: C.blueLight,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    paddingRight: 8,
  },
  wrap: {
    gap: 8,
  },
});

import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { C } from '../core/mobile-theme';
import { type StaffLeadClub } from './staff-club-lead-utils';

export function StaffClubLeadSwitcher({
  clubs,
  onSelect,
  selectedClubId,
}: {
  clubs: StaffLeadClub[];
  onSelect: (clubId: string) => void;
  selectedClubId: string;
}) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Assigned clubs</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.row}>
          {clubs.map((club) => {
            const active = club.id === selectedClubId;
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
                  active
                    ? {
                        backgroundColor: club.accentColor ?? C.success,
                        borderColor: club.accentColor ?? C.success,
                      }
                    : null,
                ]}
              >
                <Text style={[styles.clubButtonText, active ? styles.clubButtonTextActive : null]}>
                  {club.name}
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
  clubButton: {
    backgroundColor: C.surface,
    borderColor: C.border,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  clubButtonText: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: '900',
  },
  clubButtonTextActive: {
    color: C.surface,
  },
  label: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 8,
  },
  wrap: {
    gap: 8,
  },
});

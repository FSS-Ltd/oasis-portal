import { Pressable, StyleSheet, Text, View } from 'react-native';
import { C } from '../core/mobile-theme';
import { Badge, Card, InlineSpinner, MutedText, SectionTitle } from '../core/mobile-ui';
import {
  eventDayLabel,
  formatEventSchedule,
  parentCalendarAudienceLabels,
  parentCalendarCategoryLabels,
  type ParentCalendarEvent,
} from './parent-calendar-utils';

interface ParentCalendarListProps {
  events: readonly ParentCalendarEvent[];
  loading: boolean;
  onOpen: (event: ParentCalendarEvent) => void;
}

export function ParentCalendarList({ events, loading, onOpen }: ParentCalendarListProps) {
  return (
    <View style={styles.stack}>
      {loading ? <InlineSpinner label="Loading parent dates" /> : null}
      {!loading && events.length === 0 ? (
        <Card style={styles.emptyCard}>
          <SectionTitle>No parent dates are published.</SectionTitle>
          <MutedText>No upcoming events are visible for your family calendar.</MutedText>
        </Card>
      ) : null}
      {events.map((event) => (
        <Pressable
          accessibilityRole="button"
          key={event.id}
          onPress={() => {
            onOpen(event);
          }}
        >
          <Card style={styles.eventCard}>
            <View style={styles.cardRow}>
              <View style={styles.dateBox}>
                <Text style={styles.dateLabel}>{eventDayLabel(event)}</Text>
              </View>
              <View style={styles.eventBody}>
                <View style={styles.badges}>
                  <Badge variant="blue">{parentCalendarAudienceLabels[event.audience]}</Badge>
                  <Badge variant="crimson">{parentCalendarCategoryLabels[event.category]}</Badge>
                </View>
                <Text style={styles.title}>{event.title}</Text>
                <Text style={styles.schedule}>{formatEventSchedule(event)}</Text>
                {event.description ? (
                  <Text numberOfLines={2} style={styles.description}>
                    {event.description}
                  </Text>
                ) : null}
              </View>
            </View>
          </Card>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  cardRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
  },
  dateBox: {
    alignItems: 'center',
    backgroundColor: C.crimsonLight,
    borderColor: C.crimsonLight,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 54,
    width: 58,
  },
  dateLabel: {
    color: C.crimson,
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
  },
  description: {
    color: C.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  emptyCard: {
    gap: 8,
    padding: 16,
  },
  eventBody: {
    flex: 1,
    gap: 7,
    minWidth: 0,
  },
  eventCard: {
    padding: 16,
  },
  schedule: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  stack: {
    gap: 12,
  },
  title: {
    color: C.navy,
    fontSize: 17,
    fontWeight: '900',
  },
});

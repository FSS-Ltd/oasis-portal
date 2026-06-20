import { StyleSheet, Text, View } from 'react-native';
import { C } from '../core/mobile-theme';
import { Badge, Card, MutedText, SectionTitle, MobileButton } from '../core/mobile-ui';
import {
  formatEventSchedule,
  parentCalendarAudienceLabels,
  parentCalendarCategoryLabels,
  type ParentCalendarEvent,
} from './parent-calendar-utils';

interface ParentCalendarDetailProps {
  event: ParentCalendarEvent;
  onBack: () => void;
}

export function ParentCalendarDetail({ event, onBack }: ParentCalendarDetailProps) {
  return (
    <View style={styles.stack}>
      <MobileButton compact label="Back to calendar" onPress={onBack} variant="secondary" />
      <Card style={styles.heroCard}>
        <Text style={styles.eyebrow}>Event details</Text>
        <SectionTitle>{event.title}</SectionTitle>
        <View style={styles.badges}>
          <Badge variant="blue">{parentCalendarAudienceLabels[event.audience]}</Badge>
          <Badge variant="crimson">{parentCalendarCategoryLabels[event.category]}</Badge>
        </View>
      </Card>

      <Card style={styles.metaCard}>
        <SectionTitle>Schedule</SectionTitle>
        <MutedText>{formatEventSchedule(event)}</MutedText>
        <View style={styles.metaGrid}>
          <Meta label="Audience" value={parentCalendarAudienceLabels[event.audience]} />
          <Meta label="Category" value={parentCalendarCategoryLabels[event.category]} />
        </View>
      </Card>

      <Card style={styles.metaCard}>
        <SectionTitle>Description</SectionTitle>
        <MutedText>{event.description ?? 'No further details have been published.'}</MutedText>
      </Card>
    </View>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaItem}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  eyebrow: {
    color: C.crimson,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  heroCard: {
    gap: 10,
    padding: 16,
  },
  metaCard: {
    gap: 12,
    padding: 16,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metaItem: {
    backgroundColor: C.bg,
    borderColor: C.borderLight,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: 3,
    minWidth: 130,
    padding: 10,
  },
  metaLabel: {
    color: C.textSecondary,
    fontSize: 11,
    fontWeight: '800',
  },
  metaValue: {
    color: C.navy,
    fontSize: 12,
    fontWeight: '900',
  },
  stack: {
    gap: 14,
  },
});

import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { C } from '../core/mobile-theme';
import { Card, ErrorText, MutedText, SectionTitle } from '../core/mobile-ui';
import { ParentCalendarDetail } from './parent-calendar-detail';
import { ParentCalendarList } from './parent-calendar-list';
import {
  currentMonthKey,
  formatMonthLabel,
  monthCalendarEvents,
  upcomingCalendarEvents,
  type ParentCalendarEvent,
} from './parent-calendar-utils';

interface ParentCalendarScreenProps {
  error: string | null;
  events: readonly ParentCalendarEvent[];
  eyebrow?: string | undefined;
  detail?: string | undefined;
  loading: boolean;
  title?: string | undefined;
}

export function ParentCalendarScreen({
  detail = 'Dates visible to parents and all portals.',
  error,
  events,
  eyebrow = 'Parent Calendar',
  loading,
  title = 'Key Dates',
}: ParentCalendarScreenProps) {
  const [selected, setSelected] = useState<ParentCalendarEvent | null>(null);
  const monthKey = useMemo(() => currentMonthKey(), []);
  const upcomingEvents = useMemo(() => upcomingCalendarEvents(events), [events]);
  const thisMonthEvents = useMemo(() => monthCalendarEvents(events, monthKey), [events, monthKey]);

  if (selected) {
    return (
      <ParentCalendarDetail
        event={selected}
        onBack={() => {
          setSelected(null);
        }}
      />
    );
  }

  return (
    <View style={styles.stack}>
      <Card style={styles.heroCard}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <SectionTitle>{title}</SectionTitle>
        <MutedText>{detail}</MutedText>
        <View style={styles.summaryGrid}>
          <SummaryPill label="Upcoming events" value={String(upcomingEvents.length)} />
          <SummaryPill label="This month" value={String(thisMonthEvents.length)} />
        </View>
      </Card>

      <Card style={styles.monthCard}>
        <SectionTitle>This month</SectionTitle>
        <Text style={styles.monthLabel}>{formatMonthLabel(monthKey)}</Text>
        {thisMonthEvents.length === 0 ? <MutedText>No upcoming events this month.</MutedText> : null}
      </Card>

      {error ? (
        <Card style={styles.errorCard}>
          <SectionTitle>Calendar unavailable</SectionTitle>
          <ErrorText>{error}</ErrorText>
        </Card>
      ) : null}

      <ParentCalendarList events={upcomingEvents} loading={loading} onOpen={setSelected} />
    </View>
  );
}

function SummaryPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryPill}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  errorCard: {
    gap: 8,
    padding: 16,
  },
  eyebrow: {
    color: C.crimson,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  heroCard: {
    gap: 8,
    padding: 16,
  },
  monthCard: {
    gap: 8,
    padding: 16,
  },
  monthLabel: {
    color: C.navy,
    fontSize: 15,
    fontWeight: '900',
  },
  stack: {
    gap: 14,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  summaryLabel: {
    color: C.textSecondary,
    fontSize: 11,
    fontWeight: '800',
  },
  summaryPill: {
    backgroundColor: C.bg,
    borderColor: C.borderLight,
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    gap: 2,
    minWidth: 118,
    padding: 10,
  },
  summaryValue: {
    color: C.navy,
    fontSize: 20,
    fontWeight: '900',
  },
});

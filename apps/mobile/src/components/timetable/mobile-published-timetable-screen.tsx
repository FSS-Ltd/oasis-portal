import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { TIMETABLE_DAYS } from '@oasis/domain';
import type { RouterOutputs } from '../../lib/trpc';
import { Badge, Card, ErrorText, InlineSpinner, MutedText, SectionTitle } from '../core/mobile-ui';
import { C } from '../core/mobile-theme';
import {
  MobileTimetableGrid,
  type MobileTimetableEntry,
  type MobileTimetableSlot,
} from './mobile-timetable-grid';

type Publication = NonNullable<RouterOutputs['timetable']['publishedForStudent']>;
type TeachingTerm = RouterOutputs['timetable']['terms'][number];

interface ChildOption {
  id: string;
  name: string;
}

interface MobilePublishedTimetableScreenProps {
  children?: readonly ChildOption[];
  error: string | null;
  loading: boolean;
  onSelectChild?: (studentId: string) => void;
  onSelectTerm: (termKey: string) => void;
  publication: Publication | null | undefined;
  selectedChildId?: string | undefined;
  selectedTermKey: string;
  terms: readonly TeachingTerm[];
}

function termDate(value: Date | string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value));
}

function publicationSlots(publication: Publication): MobileTimetableSlot[] {
  const firstDay = publication.entries.filter((entry) => entry.day === TIMETABLE_DAYS[0]);
  const source = firstDay.length > 0 ? firstDay : publication.entries;
  const positions = new Set<number>();
  return source.flatMap((entry) => {
    if (positions.has(entry.slotPosition)) return [];
    positions.add(entry.slotPosition);
    return [
      {
        id: `slot-${String(entry.slotPosition)}`,
        position: entry.slotPosition,
        kind: entry.slotKind,
        label: entry.slotLabel,
        startMinutes: entry.startMinutes,
        endMinutes: entry.endMinutes,
      },
    ];
  });
}

export function MobilePublishedTimetableScreen({
  children = [],
  error,
  loading,
  onSelectChild,
  onSelectTerm,
  publication,
  selectedChildId,
  selectedTermKey,
  terms,
}: MobilePublishedTimetableScreenProps) {
  const entries: MobileTimetableEntry[] =
    publication?.entries.map((entry) => ({
      day: entry.day,
      slotId: `slot-${String(entry.slotPosition)}`,
      subjectId: entry.subjectId,
      subjectName: entry.subjectName,
      subjectColour: entry.subjectColour,
    })) ?? [];

  return (
    <View style={styles.stack}>
      <Card style={styles.hero}>
        <View style={styles.heroHeading}>
          <View style={styles.heroCopy}>
            <Text style={styles.eyebrow}>Oasis Learning Centre</Text>
            <SectionTitle>Timetable</SectionTitle>
            <MutedText>Published Tuesday–Friday lessons and breaks.</MutedText>
          </View>
          <Badge variant="blue">View only</Badge>
        </View>

        {children.length > 1 ? (
          <ScrollView
            contentContainerStyle={styles.selectorRow}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {children.map((child) => (
              <Pressable
                accessibilityRole="button"
                key={child.id}
                onPress={() => {
                  onSelectChild?.(child.id);
                }}
              >
                <Badge
                  style={child.id === selectedChildId ? styles.selectedBadge : undefined}
                  variant={child.id === selectedChildId ? 'crimson' : 'neutral'}
                >
                  {child.name}
                </Badge>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        <ScrollView
          contentContainerStyle={styles.selectorRow}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {terms.map((term) => (
            <Pressable
              accessibilityRole="button"
              key={term.key}
              onPress={() => {
                onSelectTerm(term.key);
              }}
            >
              <Badge
                style={term.key === selectedTermKey ? styles.selectedBadge : undefined}
                variant={term.key === selectedTermKey ? 'blue' : 'neutral'}
              >
                {term.label}
              </Badge>
            </Pressable>
          ))}
        </ScrollView>
      </Card>

      {loading ? <InlineSpinner label="Loading timetable" /> : null}
      {error ? (
        <Card>
          <SectionTitle>Timetable unavailable</SectionTitle>
          <ErrorText>{error}</ErrorText>
        </Card>
      ) : null}
      {!loading && !error && !publication ? (
        <Card>
          <SectionTitle>No published timetable</SectionTitle>
          <MutedText>The Head has not published a timetable for this child and term yet.</MutedText>
        </Card>
      ) : null}
      {publication ? (
        <>
          <Card style={styles.identityCard}>
            <View style={styles.identityHeading}>
              <View>
                <Text style={styles.studentName}>{publication.studentFirstName}</Text>
                <MutedText>
                  {publication.termLabel} · {publication.ageBandName}
                </MutedText>
              </View>
              <Badge variant="success">Published</Badge>
            </View>
            <Text style={styles.dateLine}>
              {termDate(publication.termStartsOn)} – {termDate(publication.termEndsOn)}
            </Text>
          </Card>
          <MobileTimetableGrid entries={entries} slots={publicationSlots(publication)} />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  dateLine: {
    color: C.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  eyebrow: {
    color: C.crimson,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  hero: {
    backgroundColor: '#F9FBFF',
    gap: 14,
    padding: 16,
  },
  heroCopy: {
    flex: 1,
    gap: 4,
  },
  heroHeading: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  identityCard: {
    gap: 8,
    padding: 16,
  },
  identityHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  selectedBadge: {
    borderWidth: 2,
  },
  selectorRow: {
    gap: 7,
    paddingRight: 12,
  },
  stack: {
    gap: 14,
  },
  studentName: {
    color: '#B36F4C',
    fontSize: 22,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
});

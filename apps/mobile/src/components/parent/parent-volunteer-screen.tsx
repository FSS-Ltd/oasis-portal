import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { type RouterOutputs, api } from '../../lib/trpc';
import { C } from '../core/mobile-theme';
import {
  Badge,
  Card,
  ErrorText,
  InlineSpinner,
  MobileButton,
  MutedText,
  SectionTitle,
} from '../core/mobile-ui';

type ParentVolunteerSlots = RouterOutputs['rota']['parentVolunteerSlots'];

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
  weekday: 'short',
});

function formatDate(date: string): string {
  return dateFormatter.format(new Date(`${date}T00:00:00.000Z`));
}

function availabilityLabel(slot: ParentVolunteerSlots['days'][number]): string {
  if (slot.selected) return 'Selected';
  if (slot.status === 'Full') return 'Full';
  return `${String(slot.spacesRemaining)} ${slot.spacesRemaining === 1 ? 'space' : 'spaces'} left`;
}

export function ParentVolunteerScreen({
  error,
  loading,
  slots,
}: {
  error: string | null;
  loading: boolean;
  slots: ParentVolunteerSlots | undefined;
}) {
  const utils = api.useUtils();
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!slots) return;
    setSelectedDates(new Set(slots.days.filter((slot) => slot.selected).map((slot) => slot.date)));
  }, [slots]);

  const weeks = useMemo(() => {
    const days = slots?.days ?? [];
    return [days.slice(0, 7), days.slice(7)];
  }, [slots?.days]);
  const saveVolunteerDays = api.rota.setMyParentVolunteerDays.useMutation({
    onError: async () => {
      setSuccessMessage(null);
      await utils.rota.parentVolunteerSlots.invalidate();
    },
    onSuccess: async () => {
      setSuccessMessage('Your volunteer days have been saved.');
      await utils.rota.parentVolunteerSlots.invalidate();
    },
  });

  function toggleDate(date: string): void {
    setSelectedDates((current) => {
      const next = new Set(current);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  }

  return (
    <View style={styles.stack}>
      <Card style={styles.heroCard}>
        <Text style={styles.eyebrow}>Oasis parent team</Text>
        <SectionTitle>Volunteer at Oasis</SectionTitle>
        <MutedText>
          Choose full days you can serve. There are two volunteer spaces per day, and other
          parents&apos; choices stay private.
        </MutedText>
        <Badge variant="blue">Rolling two weeks</Badge>
      </Card>

      {loading ? <InlineSpinner label="Loading volunteer days" /> : null}
      {error ? <ErrorText>{error}</ErrorText> : null}
      {saveVolunteerDays.error ? <ErrorText>{saveVolunteerDays.error.message}</ErrorText> : null}
      {successMessage ? <Text style={styles.successText}>{successMessage}</Text> : null}

      {slots ? (
        <Card style={styles.daysCard}>
          <View style={styles.cardHeader}>
            <View style={styles.headerText}>
              <SectionTitle>Choose your days</SectionTitle>
              <MutedText>
                {formatDate(slots.from)} - {formatDate(slots.to)}
              </MutedText>
            </View>
            <Badge variant="neutral">{String(selectedDates.size)} selected</Badge>
          </View>
          <MutedText>Week three opens when this period reaches its second week.</MutedText>

          {weeks.map((week, index) => (
            <View key={index} style={styles.weekSection}>
              <Text style={styles.weekTitle}>Week {String(index + 1)}</Text>
              {week.map((slot) => {
                const selected = selectedDates.has(slot.date);
                const disabled = slot.status === 'Full' && !selected;
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ disabled, selected }}
                    disabled={disabled || saveVolunteerDays.isPending}
                    key={slot.date}
                    onPress={() => {
                      toggleDate(slot.date);
                    }}
                    style={[
                      styles.dayButton,
                      selected ? styles.dayButtonSelected : null,
                      disabled ? styles.dayButtonDisabled : null,
                    ]}
                  >
                    <Text style={styles.dayDate}>{formatDate(slot.date)}</Text>
                    <Text style={[styles.dayStatus, selected ? styles.dayStatusSelected : null]}>
                      {selected ? 'Selected' : availabilityLabel(slot)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ))}

          <MobileButton
            disabled={saveVolunteerDays.isPending}
            label={saveVolunteerDays.isPending ? 'Saving volunteer days...' : 'Save volunteer days'}
            onPress={() => {
              setSuccessMessage(null);
              saveVolunteerDays.mutate({ dates: [...selectedDates].sort() });
            }}
          />
        </Card>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  cardHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  dayButton: {
    backgroundColor: C.surface,
    borderColor: C.border,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
    padding: 12,
  },
  dayButtonDisabled: {
    opacity: 0.5,
  },
  dayButtonSelected: {
    backgroundColor: C.successBg,
    borderColor: C.successMid,
  },
  dayDate: {
    color: C.navy,
    fontSize: 14,
    fontWeight: '900',
  },
  dayStatus: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  dayStatusSelected: {
    color: C.success,
  },
  daysCard: {
    gap: 14,
    padding: 16,
  },
  eyebrow: {
    color: C.crimson,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  headerText: {
    flex: 1,
    gap: 3,
  },
  heroCard: {
    gap: 8,
    padding: 16,
  },
  stack: {
    gap: 14,
  },
  successText: {
    color: C.success,
    fontSize: 12,
    fontWeight: '700',
  },
  weekSection: {
    gap: 8,
  },
  weekTitle: {
    color: C.navy,
    fontSize: 13,
    fontWeight: '900',
  },
});

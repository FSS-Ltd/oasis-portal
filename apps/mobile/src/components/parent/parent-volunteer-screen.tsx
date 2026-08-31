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
type VolunteerDay = ParentVolunteerSlots['centreVolunteer']['days'][number];

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
  weekday: 'short',
});

function formatDate(date: string): string {
  return dateFormatter.format(new Date(`${date}T00:00:00.000Z`));
}

function availabilityLabel(slot: VolunteerDay): string {
  if (slot.selected) return 'Selected';
  if (slot.status === 'Full') return 'Full';
  return `${String(slot.spacesRemaining)} ${slot.spacesRemaining === 1 ? 'space' : 'spaces'} left`;
}

function selectedDates(days: readonly VolunteerDay[]): Set<string> {
  return new Set(days.filter((day) => day.selected).map((day) => day.date));
}

function VolunteerDayButton({
  label,
  onToggle,
  pending,
  selected,
  showDate = true,
  slot,
}: {
  label?: string;
  onToggle: (date: string) => void;
  pending: boolean;
  selected: boolean;
  showDate?: boolean;
  slot: VolunteerDay;
}) {
  const disabled = slot.status === 'Full' && !selected;
  return (
    <Pressable
      accessibilityLabel={`${label ? `${label} ` : ''}${formatDate(slot.date)} volunteer slot`}
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
      disabled={disabled || pending}
      onPress={() => {
        onToggle(slot.date);
      }}
      style={[
        styles.dayButton,
        selected ? styles.dayButtonSelected : null,
        disabled ? styles.dayButtonDisabled : null,
      ]}
    >
      {showDate ? <Text style={styles.dayDate}>{formatDate(slot.date)}</Text> : null}
      <Text style={styles.dayStatus}>{selected ? 'Selected' : availabilityLabel(slot)}</Text>
    </Pressable>
  );
}

function CentreVolunteerCard({
  days,
  pending,
  selected,
  onToggle,
}: {
  days: readonly VolunteerDay[];
  pending: boolean;
  selected: ReadonlySet<string>;
  onToggle: (date: string) => void;
}) {
  const weeks = useMemo(() => [days.slice(0, 7), days.slice(7)], [days]);
  return (
    <Card style={styles.daysCard}>
      <View style={styles.cardHeader}>
        <View style={styles.headerText}>
          <Text style={styles.cardEyebrow}>Learning time</Text>
          <SectionTitle>Centre Volunteer</SectionTitle>
          <MutedText>Support learning time. Two parent spaces are available each day.</MutedText>
        </View>
        <Badge variant="neutral">{String(selected.size)} selected</Badge>
      </View>
      {weeks.map((week, index) => (
        <View key={index} style={styles.weekSection}>
          <Text style={styles.weekTitle}>Week {String(index + 1)}</Text>
          {week.map((slot) => (
            <VolunteerDayButton
              key={slot.date}
              onToggle={onToggle}
              pending={pending}
              selected={selected.has(slot.date)}
              slot={slot}
            />
          ))}
        </View>
      ))}
    </Card>
  );
}

function LunchAndClubsCard({
  primaryDays,
  primarySelected,
  secondaryDays,
  secondarySelected,
  pending,
  onTogglePrimary,
  onToggleSecondary,
}: {
  primaryDays: readonly VolunteerDay[];
  primarySelected: ReadonlySet<string>;
  secondaryDays: readonly VolunteerDay[];
  secondarySelected: ReadonlySet<string>;
  pending: boolean;
  onTogglePrimary: (date: string) => void;
  onToggleSecondary: (date: string) => void;
}) {
  const weeks = useMemo(
    () => [
      { primary: primaryDays.slice(0, 7), secondary: secondaryDays.slice(0, 7) },
      { primary: primaryDays.slice(7), secondary: secondaryDays.slice(7) },
    ],
    [primaryDays, secondaryDays],
  );
  const selectedCount = primarySelected.size + secondarySelected.size;

  return (
    <Card style={styles.daysCard}>
      <View style={styles.cardHeader}>
        <View style={styles.headerText}>
          <Text style={styles.cardEyebrow}>Daily cover</Text>
          <SectionTitle>Lunch + Clubs</SectionTitle>
          <MutedText>Choose either Primary or Secondary for each day.</MutedText>
        </View>
        <Badge variant="neutral">{String(selectedCount)} selected</Badge>
      </View>
      <View style={styles.capacityRow}>
        <Text style={styles.capacityText}>Primary · 3 spaces daily</Text>
        <Text style={styles.capacityText}>Secondary · 2 spaces daily</Text>
      </View>
      {weeks.map((week, index) => (
        <View key={index} style={styles.weekSection}>
          <Text style={styles.weekTitle}>Week {String(index + 1)}</Text>
          {week.primary.map((primarySlot, dayIndex) => {
            const secondarySlot = week.secondary[dayIndex];
            if (!secondarySlot) return null;
            return (
              <View key={primarySlot.date} style={styles.lunchDay}>
                <Text style={styles.dayDate}>{formatDate(primarySlot.date)}</Text>
                <View style={styles.lunchOptions}>
                  <View style={styles.lunchOption}>
                    <Text style={styles.optionLabel}>Primary</Text>
                    <VolunteerDayButton
                      label="Primary"
                      onToggle={onTogglePrimary}
                      pending={pending}
                      selected={primarySelected.has(primarySlot.date)}
                      showDate={false}
                      slot={primarySlot}
                    />
                  </View>
                  <View style={styles.lunchOption}>
                    <Text style={styles.optionLabel}>Secondary</Text>
                    <VolunteerDayButton
                      label="Secondary"
                      onToggle={onToggleSecondary}
                      pending={pending}
                      selected={secondarySelected.has(secondarySlot.date)}
                      showDate={false}
                      slot={secondarySlot}
                    />
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      ))}
    </Card>
  );
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
  const [centreDates, setCentreDates] = useState<Set<string>>(new Set());
  const [primaryLunchAndClubsDates, setPrimaryLunchAndClubsDates] = useState<Set<string>>(
    new Set(),
  );
  const [secondaryLunchAndClubsDates, setSecondaryLunchAndClubsDates] = useState<Set<string>>(
    new Set(),
  );
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!slots) return;
    setCentreDates(selectedDates(slots.centreVolunteer.days));
    setPrimaryLunchAndClubsDates(selectedDates(slots.lunchAndClubs.primary.days));
    setSecondaryLunchAndClubsDates(selectedDates(slots.lunchAndClubs.secondary.days));
  }, [slots]);

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

  function toggleCentreDate(date: string): void {
    setCentreDates((current) => {
      const next = new Set(current);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  }

  function toggleLunchAndClubsDate(date: string, placement: 'primary' | 'secondary'): void {
    const updateSelection =
      placement === 'primary' ? setPrimaryLunchAndClubsDates : setSecondaryLunchAndClubsDates;
    const clearOtherSelection =
      placement === 'primary' ? setSecondaryLunchAndClubsDates : setPrimaryLunchAndClubsDates;
    updateSelection((current) => {
      const next = new Set(current);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
    clearOtherSelection((current) => {
      const next = new Set(current);
      next.delete(date);
      return next;
    });
  }

  return (
    <View style={styles.stack}>
      <Card style={styles.heroCard}>
        <Text style={styles.eyebrow}>Oasis parent team</Text>
        <SectionTitle>Volunteer at Oasis</SectionTitle>
        <MutedText>Choose where you can help. Other parents&apos; choices stay private.</MutedText>
        <Badge variant="blue">Rolling two weeks</Badge>
      </Card>

      {loading ? <InlineSpinner label="Loading volunteer days" /> : null}
      {error ? <ErrorText>{error}</ErrorText> : null}
      {saveVolunteerDays.error ? <ErrorText>{saveVolunteerDays.error.message}</ErrorText> : null}
      {successMessage ? <Text style={styles.successText}>{successMessage}</Text> : null}

      {slots ? (
        <>
          <MutedText>
            {formatDate(slots.from)} - {formatDate(slots.to)} · Week three opens when this period
            reaches its second week.
          </MutedText>
          <CentreVolunteerCard
            days={slots.centreVolunteer.days}
            onToggle={toggleCentreDate}
            pending={saveVolunteerDays.isPending}
            selected={centreDates}
          />
          <LunchAndClubsCard
            onTogglePrimary={(date) => {
              toggleLunchAndClubsDate(date, 'primary');
            }}
            onToggleSecondary={(date) => {
              toggleLunchAndClubsDate(date, 'secondary');
            }}
            pending={saveVolunteerDays.isPending}
            primaryDays={slots.lunchAndClubs.primary.days}
            primarySelected={primaryLunchAndClubsDates}
            secondaryDays={slots.lunchAndClubs.secondary.days}
            secondarySelected={secondaryLunchAndClubsDates}
          />
          <MobileButton
            disabled={saveVolunteerDays.isPending}
            label={saveVolunteerDays.isPending ? 'Saving volunteer days...' : 'Save volunteer days'}
            onPress={() => {
              setSuccessMessage(null);
              saveVolunteerDays.mutate({
                centreDates: [...centreDates].sort(),
                primaryLunchAndClubsDates: [...primaryLunchAndClubsDates].sort(),
                secondaryLunchAndClubsDates: [...secondaryLunchAndClubsDates].sort(),
              });
            }}
          />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  capacityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  capacityText: {
    backgroundColor: C.bg,
    borderColor: C.borderLight,
    borderRadius: 999,
    borderWidth: 1,
    color: C.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  cardEyebrow: {
    color: C.crimson,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
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
  lunchDay: {
    backgroundColor: C.bg,
    borderColor: C.border,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
    padding: 12,
  },
  lunchOption: {
    flex: 1,
    gap: 4,
  },
  lunchOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  optionLabel: {
    color: C.textSecondary,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
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

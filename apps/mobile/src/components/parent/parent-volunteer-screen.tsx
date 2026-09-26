import { type Dispatch, type SetStateAction, useEffect, useMemo, useState } from 'react';
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
type ParentVolunteerScheduleSlots = Extract<ParentVolunteerSlots, { scope: 'parent' }>;
type StaffVolunteerScheduleSlots = Extract<ParentVolunteerSlots, { scope: 'staff' }>;
type ParentVolunteerSharedTerm = StaffVolunteerScheduleSlots['terms'][number];
type VolunteerDay = ParentVolunteerSharedTerm['lunchAndClubs']['primary']['days'][number];

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

function splitIntoWeeks(days: readonly VolunteerDay[]): VolunteerDay[][] {
  return Array.from({ length: Math.ceil(days.length / 7) }, (_, index) =>
    days.slice(index * 7, (index + 1) * 7),
  );
}

function toggleExclusiveDate(
  date: string,
  updateSelection: Dispatch<SetStateAction<Set<string>>>,
  clearOtherSelection: Dispatch<SetStateAction<Set<string>>>,
): void {
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
  const weeks = useMemo(() => splitIntoWeeks(days), [days]);
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
  const weeks = useMemo(() => {
    const primaryWeeks = splitIntoWeeks(primaryDays);
    const secondaryWeeks = splitIntoWeeks(secondaryDays);
    return primaryWeeks.map((primary, index) => ({
      primary,
      secondary: secondaryWeeks[index] ?? [],
    }));
  }, [primaryDays, secondaryDays]);
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

function VolunteerTermPicker({
  selectedTerm,
  setSelectedTermId,
  terms,
}: {
  selectedTerm: ParentVolunteerSharedTerm | null;
  setSelectedTermId: (termId: string) => void;
  terms: readonly ParentVolunteerSharedTerm[];
}) {
  return (
    <Card style={styles.daysCard}>
      <Text style={styles.cardEyebrow}>Available terms</Text>
      <SectionTitle>Choose a term</SectionTitle>
      <View style={styles.termSelector}>
        {terms.map((term) => {
          const selected = selectedTerm?.id === term.id;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={term.id}
              onPress={() => {
                setSelectedTermId(term.id);
              }}
              style={[styles.termButton, selected ? styles.termButtonSelected : null]}
            >
              <Text
                style={[styles.termButtonText, selected ? styles.termButtonTextSelected : null]}
              >
                {term.label} {term.id.slice(0, 4)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <MutedText>The next term becomes available one week before it starts.</MutedText>
    </Card>
  );
}

function ParentVolunteerSchedule({ slots }: { slots: ParentVolunteerScheduleSlots }) {
  const utils = api.useUtils();
  const terms = slots.terms;
  const [selectedTermId, setSelectedTermId] = useState<string | null>(null);
  const [centreDates, setCentreDates] = useState<Set<string>>(new Set());
  const [primaryLunchAndClubsDates, setPrimaryLunchAndClubsDates] = useState<Set<string>>(
    new Set(),
  );
  const [secondaryLunchAndClubsDates, setSecondaryLunchAndClubsDates] = useState<Set<string>>(
    new Set(),
  );
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const selectedTerm = terms.find((term) => term.id === selectedTermId) ?? terms[0] ?? null;

  useEffect(() => {
    if (selectedTerm && selectedTerm.id !== selectedTermId) setSelectedTermId(selectedTerm.id);
  }, [selectedTerm, selectedTermId]);

  useEffect(() => {
    if (!selectedTerm) return;
    setCentreDates(selectedDates(selectedTerm.centreVolunteer.days));
    setPrimaryLunchAndClubsDates(selectedDates(selectedTerm.lunchAndClubs.primary.days));
    setSecondaryLunchAndClubsDates(selectedDates(selectedTerm.lunchAndClubs.secondary.days));
  }, [selectedTerm]);

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
    toggleExclusiveDate(
      date,
      placement === 'primary' ? setPrimaryLunchAndClubsDates : setSecondaryLunchAndClubsDates,
      placement === 'primary' ? setSecondaryLunchAndClubsDates : setPrimaryLunchAndClubsDates,
    );
  }

  return (
    <>
      <VolunteerTermPicker
        selectedTerm={selectedTerm}
        setSelectedTermId={setSelectedTermId}
        terms={terms}
      />
      {saveVolunteerDays.error ? <ErrorText>{saveVolunteerDays.error.message}</ErrorText> : null}
      {successMessage ? <Text style={styles.successText}>{successMessage}</Text> : null}
      {selectedTerm ? (
        <>
          <MutedText>
            {formatDate(selectedTerm.from)} - {formatDate(selectedTerm.to)}
          </MutedText>
          <CentreVolunteerCard
            days={selectedTerm.centreVolunteer.days}
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
            primaryDays={selectedTerm.lunchAndClubs.primary.days}
            primarySelected={primaryLunchAndClubsDates}
            secondaryDays={selectedTerm.lunchAndClubs.secondary.days}
            secondarySelected={secondaryLunchAndClubsDates}
          />
          <MobileButton
            disabled={saveVolunteerDays.isPending}
            label={saveVolunteerDays.isPending ? 'Saving volunteer days...' : 'Save volunteer days'}
            onPress={() => {
              setSuccessMessage(null);
              saveVolunteerDays.mutate({
                termId: selectedTerm.id,
                centreDates: [...centreDates].sort(),
                primaryLunchAndClubsDates: [...primaryLunchAndClubsDates].sort(),
                secondaryLunchAndClubsDates: [...secondaryLunchAndClubsDates].sort(),
              });
            }}
          />
        </>
      ) : (
        <MutedText>No volunteer terms are available.</MutedText>
      )}
    </>
  );
}

function StaffVolunteerSchedule({ slots }: { slots: StaffVolunteerScheduleSlots }) {
  const utils = api.useUtils();
  const terms = slots.terms;
  const [selectedTermId, setSelectedTermId] = useState<string | null>(null);
  const [primaryLunchAndClubsDates, setPrimaryLunchAndClubsDates] = useState<Set<string>>(
    new Set(),
  );
  const [secondaryLunchAndClubsDates, setSecondaryLunchAndClubsDates] = useState<Set<string>>(
    new Set(),
  );
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const selectedTerm = terms.find((term) => term.id === selectedTermId) ?? terms[0] ?? null;

  useEffect(() => {
    if (selectedTerm && selectedTerm.id !== selectedTermId) setSelectedTermId(selectedTerm.id);
  }, [selectedTerm, selectedTermId]);

  useEffect(() => {
    if (!selectedTerm) return;
    setPrimaryLunchAndClubsDates(selectedDates(selectedTerm.lunchAndClubs.primary.days));
    setSecondaryLunchAndClubsDates(selectedDates(selectedTerm.lunchAndClubs.secondary.days));
  }, [selectedTerm]);

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

  function toggleLunchAndClubsDate(date: string, placement: 'primary' | 'secondary'): void {
    toggleExclusiveDate(
      date,
      placement === 'primary' ? setPrimaryLunchAndClubsDates : setSecondaryLunchAndClubsDates,
      placement === 'primary' ? setSecondaryLunchAndClubsDates : setPrimaryLunchAndClubsDates,
    );
  }

  return (
    <>
      <VolunteerTermPicker
        selectedTerm={selectedTerm}
        setSelectedTermId={setSelectedTermId}
        terms={terms}
      />
      {saveVolunteerDays.error ? <ErrorText>{saveVolunteerDays.error.message}</ErrorText> : null}
      {successMessage ? <Text style={styles.successText}>{successMessage}</Text> : null}
      {selectedTerm ? (
        <>
          <MutedText>
            {formatDate(selectedTerm.from)} - {formatDate(selectedTerm.to)}
          </MutedText>
          <Card style={styles.daysCard}>
            <MutedText>Lunch + Clubs-only access for staff volunteers.</MutedText>
          </Card>
          <LunchAndClubsCard
            onTogglePrimary={(date) => {
              toggleLunchAndClubsDate(date, 'primary');
            }}
            onToggleSecondary={(date) => {
              toggleLunchAndClubsDate(date, 'secondary');
            }}
            pending={saveVolunteerDays.isPending}
            primaryDays={selectedTerm.lunchAndClubs.primary.days}
            primarySelected={primaryLunchAndClubsDates}
            secondaryDays={selectedTerm.lunchAndClubs.secondary.days}
            secondarySelected={secondaryLunchAndClubsDates}
          />
          <MobileButton
            disabled={saveVolunteerDays.isPending}
            label={saveVolunteerDays.isPending ? 'Saving volunteer days...' : 'Save volunteer days'}
            onPress={() => {
              setSuccessMessage(null);
              saveVolunteerDays.mutate({
                termId: selectedTerm.id,
                primaryLunchAndClubsDates: [...primaryLunchAndClubsDates].sort(),
                secondaryLunchAndClubsDates: [...secondaryLunchAndClubsDates].sort(),
              });
            }}
          />
        </>
      ) : (
        <MutedText>No volunteer terms are available.</MutedText>
      )}
    </>
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
  return (
    <View style={styles.stack}>
      <Card style={styles.heroCard}>
        <Text style={styles.eyebrow}>Oasis parent team</Text>
        <SectionTitle>Volunteer at Oasis</SectionTitle>
        <MutedText>Choose where you can help. Other parents&apos; choices stay private.</MutedText>
        <Badge variant="blue">Full term</Badge>
      </Card>

      {loading ? <InlineSpinner label="Loading volunteer days" /> : null}
      {error ? <ErrorText>{error}</ErrorText> : null}
      {slots?.scope === 'parent' ? <ParentVolunteerSchedule slots={slots} /> : null}
      {slots?.scope === 'staff' ? <StaffVolunteerSchedule slots={slots} /> : null}
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
  termButton: {
    backgroundColor: C.surface,
    borderColor: C.border,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  termButtonSelected: {
    backgroundColor: C.navy,
    borderColor: C.navy,
  },
  termButtonText: {
    color: C.navy,
    fontSize: 12,
    fontWeight: '900',
  },
  termButtonTextSelected: {
    color: C.surface,
  },
  termSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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

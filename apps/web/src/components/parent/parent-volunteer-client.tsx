'use client';

import {
  type Dispatch,
  type KeyboardEvent,
  type SetStateAction,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { CalendarDays, Save } from 'lucide-react';
import type { ParentVolunteerAccess } from '@oasis/domain';
import { Button } from '@/components/ui/button';
import { friendlyErrorMessage, showErrorToast, showSuccessToast } from '@/lib/notifications';
import { api, type RouterOutputs } from '@/lib/trpc';

type ParentVolunteerSlots = RouterOutputs['rota']['parentVolunteerSlots'];
type ParentVolunteerTerm = Extract<ParentVolunteerSlots, { scope: 'parent' }>['terms'][number];
type ParentVolunteerSharedTerm = Omit<ParentVolunteerTerm, 'centreVolunteer'>;
type VolunteerDay = ParentVolunteerSharedTerm['lunchAndClubs']['primary']['days'][number];
type VolunteerTab = 'centre' | 'lunchAndClubs';

const volunteerTabs = [
  { id: 'centre', label: 'Centre Volunteer' },
  { id: 'lunchAndClubs', label: 'Lunch + Clubs' },
] as const satisfies readonly { id: VolunteerTab; label: string }[];

function initialVolunteerTab(scope: ParentVolunteerSlots['scope']): VolunteerTab {
  return scope === 'parent' ? 'centre' : 'lunchAndClubs';
}

export function lunchAndClubsVolunteerSaveInput(input: {
  primaryLunchAndClubsDates: readonly string[];
  secondaryLunchAndClubsDates: readonly string[];
  termId: string;
}) {
  return {
    termId: input.termId,
    primaryLunchAndClubsDates: [...input.primaryLunchAndClubsDates],
    secondaryLunchAndClubsDates: [...input.secondaryLunchAndClubsDates],
  };
}

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
  if (slot.selected) return 'Your day';
  if (slot.status === 'Full') return 'Full';
  return `${String(slot.spacesRemaining)} ${slot.spacesRemaining === 1 ? 'space' : 'spaces'} left`;
}

function selectedDates(days: readonly VolunteerDay[]): Set<string> {
  return new Set(days.filter((day) => day.selected).map((day) => day.date));
}

function splitIntoWeeks<T>(items: readonly T[]): T[][] {
  return Array.from({ length: Math.ceil(items.length / 7) }, (_, index) =>
    items.slice(index * 7, (index + 1) * 7),
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
  onToggle,
  pending,
  selected,
  showDate = true,
  slot,
}: {
  onToggle: (date: string) => void;
  pending: boolean;
  selected: boolean;
  showDate?: boolean;
  slot: VolunteerDay;
}) {
  const disabled = slot.status === 'Full' && !selected;
  return (
    <button
      aria-pressed={selected}
      className={`parent-volunteer-day${selected ? ' is-selected' : ''}${disabled ? ' is-full' : ''}`}
      disabled={disabled || pending}
      onClick={() => {
        onToggle(slot.date);
      }}
      type="button"
    >
      {showDate ? <strong>{formatDate(slot.date)}</strong> : null}
      <span>{selected ? 'Selected' : availabilityLabel(slot)}</span>
    </button>
  );
}

function VolunteerWeeks({
  days,
  onToggle,
  pending,
  selected,
}: {
  days: readonly VolunteerDay[];
  onToggle: (date: string) => void;
  pending: boolean;
  selected: ReadonlySet<string>;
}) {
  const weeks = useMemo(() => splitIntoWeeks(days), [days]);

  return (
    <div className="parent-volunteer-weeks">
      {weeks.map((week, index) => (
        <section aria-label={`Volunteer week ${String(index + 1)}`} key={index}>
          <h3>Week {String(index + 1)}</h3>
          <div className="parent-volunteer-grid">
            {week.map((slot) => (
              <VolunteerDayButton
                key={slot.date}
                onToggle={onToggle}
                pending={pending}
                selected={selected.has(slot.date)}
                slot={slot}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function LunchAndClubsWeeks({
  primaryDays,
  primarySelectedDates,
  secondaryDays,
  secondarySelectedDates,
  onTogglePrimary,
  onToggleSecondary,
  pending,
}: {
  primaryDays: readonly VolunteerDay[];
  primarySelectedDates: ReadonlySet<string>;
  secondaryDays: readonly VolunteerDay[];
  secondarySelectedDates: ReadonlySet<string>;
  onTogglePrimary: (date: string) => void;
  onToggleSecondary: (date: string) => void;
  pending: boolean;
}) {
  const weeks = useMemo(() => {
    const primaryWeeks = splitIntoWeeks(primaryDays);
    const secondaryWeeks = splitIntoWeeks(secondaryDays);
    return primaryWeeks.map((primary, index) => ({
      primary,
      secondary: secondaryWeeks[index] ?? [],
    }));
  }, [primaryDays, secondaryDays]);

  return (
    <div className="parent-volunteer-weeks">
      {weeks.map((week, index) => (
        <section aria-label={`Lunch and clubs volunteer week ${String(index + 1)}`} key={index}>
          <h3>Week {String(index + 1)}</h3>
          <div className="parent-volunteer-lunch-grid">
            {week.primary.map((primarySlot, dayIndex) => {
              const secondarySlot = week.secondary[dayIndex];
              if (!secondarySlot) return null;
              const primarySelected = primarySelectedDates.has(primarySlot.date);
              const secondarySelected = secondarySelectedDates.has(secondarySlot.date);
              return (
                <article className="parent-volunteer-lunch-day" key={primarySlot.date}>
                  <strong>{formatDate(primarySlot.date)}</strong>
                  <div>
                    <span>Primary</span>
                    <VolunteerDayButton
                      onToggle={onTogglePrimary}
                      pending={pending}
                      selected={primarySelected}
                      showDate={false}
                      slot={primarySlot}
                    />
                  </div>
                  <div>
                    <span>Secondary</span>
                    <VolunteerDayButton
                      onToggle={onToggleSecondary}
                      pending={pending}
                      selected={secondarySelected}
                      showDate={false}
                      slot={secondarySlot}
                    />
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function VolunteerTermPicker({
  selectedTermId,
  setSelectedTermId,
  terms,
}: {
  selectedTermId: string;
  setSelectedTermId: (termId: string) => void;
  terms: readonly ParentVolunteerSharedTerm[];
}) {
  return (
    <section className="panel panel__body parent-volunteer-panel">
      <div className="section-title">
        <div>
          <p className="muted">Available terms</p>
          <h2>Choose a term</h2>
        </div>
      </div>
      <div aria-label="Volunteer term" className="row-actions" role="group">
        {terms.map((term) => (
          <Button
            aria-pressed={selectedTermId === term.id}
            key={term.id}
            onClick={() => {
              setSelectedTermId(term.id);
            }}
            size="sm"
            type="button"
            variant={selectedTermId === term.id ? 'primary' : 'secondary'}
          >
            {term.label} {term.id.slice(0, 4)}
          </Button>
        ))}
      </div>
      <p className="muted">The next term becomes available one week before it starts.</p>
    </section>
  );
}

function LunchAndClubsPanel({
  primaryDates,
  scope,
  secondaryDates,
  setPrimaryDates,
  setSecondaryDates,
  slots,
}: {
  primaryDates: ReadonlySet<string>;
  scope: Exclude<ParentVolunteerAccess, null>;
  secondaryDates: ReadonlySet<string>;
  setPrimaryDates: React.Dispatch<React.SetStateAction<Set<string>>>;
  setSecondaryDates: React.Dispatch<React.SetStateAction<Set<string>>>;
  slots: ParentVolunteerSharedTerm;
}) {
  const utils = api.useUtils();
  const saveLunchAndClubsDays = api.rota.setMyParentVolunteerDays.useMutation({
    onError: (error) => {
      showErrorToast(error, 'Lunch and clubs volunteer days could not be saved.');
    },
    onSuccess: async () => {
      showSuccessToast('Lunch and clubs volunteer days have been saved.');
      await utils.rota.parentVolunteerSlots.invalidate();
    },
  });
  const selectedDayCount = primaryDates.size + secondaryDates.size;

  function toggleDate(date: string, placement: 'primary' | 'secondary'): void {
    toggleExclusiveDate(
      date,
      placement === 'primary' ? setPrimaryDates : setSecondaryDates,
      placement === 'primary' ? setSecondaryDates : setPrimaryDates,
    );
  }

  return (
    <section
      className={`panel panel__body parent-volunteer-panel${scope === 'staff' ? ' parent-volunteer-panel--staff' : ''}`}
    >
      <div className="parent-volunteer-panel__header">
        <div>
          <p className="muted">Daily cover</p>
          <h2>Lunch + Clubs</h2>
          {scope === 'staff' ? (
            <p className="muted">Lunch + Clubs-only access for staff volunteers.</p>
          ) : null}
          <p className="muted">
            Help during lunch and clubs. Choose either Primary or Secondary for each day.
          </p>
        </div>
        <div className="parent-volunteer-panel__actions">
          <span className="badge">{String(selectedDayCount)} selected</span>
          <Button
            onClick={() => {
              saveLunchAndClubsDays.mutate(
                lunchAndClubsVolunteerSaveInput({
                  termId: slots.id,
                  primaryLunchAndClubsDates: [...primaryDates].sort(),
                  secondaryLunchAndClubsDates: [...secondaryDates].sort(),
                }),
              );
            }}
            pending={saveLunchAndClubsDays.isPending}
            size="sm"
            type="button"
          >
            <Save aria-hidden="true" size={16} />
            Save Lunch + Clubs
          </Button>
        </div>
      </div>
      <div className="parent-volunteer-capacity-summary">
        <span>Primary · {String(slots.lunchAndClubs.primary.dailyCapacity)} spaces daily</span>
        <span>Secondary · {String(slots.lunchAndClubs.secondary.dailyCapacity)} spaces daily</span>
      </div>
      <LunchAndClubsWeeks
        onTogglePrimary={(date) => {
          toggleDate(date, 'primary');
        }}
        onToggleSecondary={(date) => {
          toggleDate(date, 'secondary');
        }}
        pending={saveLunchAndClubsDays.isPending}
        primaryDays={slots.lunchAndClubs.primary.days}
        primarySelectedDates={primaryDates}
        secondaryDays={slots.lunchAndClubs.secondary.days}
        secondarySelectedDates={secondaryDates}
      />
      {saveLunchAndClubsDays.error ? (
        <p className="status--error" role="alert">
          {friendlyErrorMessage(saveLunchAndClubsDays.error)}
        </p>
      ) : null}
    </section>
  );
}

function ParentVolunteerSchedule({
  slots,
}: {
  slots: Extract<ParentVolunteerSlots, { scope: 'parent' }>;
}) {
  const terms = slots.terms;
  const [activeTab, setActiveTab] = useState<VolunteerTab>(() => initialVolunteerTab(slots.scope));
  const [selectedTermId, setSelectedTermId] = useState(terms[0]?.id ?? '');
  const [centreDates, setCentreDates] = useState<Set<string>>(new Set());
  const [primaryDates, setPrimaryDates] = useState<Set<string>>(new Set());
  const [secondaryDates, setSecondaryDates] = useState<Set<string>>(new Set());
  const selectedDatesWindow = useRef<string | null>(null);
  const utils = api.useUtils();
  const selectedTerm = terms.find((term) => term.id === selectedTermId) ?? terms[0];

  useEffect(() => {
    if (!selectedTerm || selectedDatesWindow.current === selectedTerm.id) return;
    setCentreDates(selectedDates(selectedTerm.centreVolunteer.days));
    setPrimaryDates(selectedDates(selectedTerm.lunchAndClubs.primary.days));
    setSecondaryDates(selectedDates(selectedTerm.lunchAndClubs.secondary.days));
    selectedDatesWindow.current = selectedTerm.id;
  }, [selectedTerm]);

  const saveCentreDays = api.rota.setMyParentVolunteerDays.useMutation({
    onError: (error) => {
      showErrorToast(error, 'Centre volunteer days could not be saved.');
    },
    onSuccess: async () => {
      showSuccessToast('Centre volunteer days have been saved.');
      await utils.rota.parentVolunteerSlots.invalidate();
    },
  });

  function selectVolunteerTab(event: KeyboardEvent<HTMLButtonElement>): void {
    const currentIndex = volunteerTabs.findIndex((tab) => tab.id === activeTab);
    let nextIndex = currentIndex;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % volunteerTabs.length;
    if (event.key === 'ArrowLeft')
      nextIndex = (currentIndex - 1 + volunteerTabs.length) % volunteerTabs.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = volunteerTabs.length - 1;
    if (nextIndex === currentIndex) return;
    event.preventDefault();
    const nextTab = volunteerTabs[nextIndex];
    if (!nextTab) return;
    setActiveTab(nextTab.id);
    document.getElementById(`parent-volunteer-tab-${nextTab.id}`)?.focus();
  }

  if (!selectedTerm) return null;

  return (
    <>
      <VolunteerTermPicker
        selectedTermId={selectedTerm.id}
        setSelectedTermId={setSelectedTermId}
        terms={terms}
      />
      <div aria-label="Volunteer options" className="parent-volunteer-tabs" role="tablist">
        {volunteerTabs.map((tab) => (
          <button
            aria-controls={`parent-volunteer-panel-${tab.id}`}
            aria-selected={activeTab === tab.id}
            className={`parent-volunteer-tab${activeTab === tab.id ? ' is-active' : ''}`}
            id={`parent-volunteer-tab-${tab.id}`}
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
            }}
            onKeyDown={selectVolunteerTab}
            role="tab"
            tabIndex={activeTab === tab.id ? 0 : -1}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>
      {activeTab === 'centre' ? (
        <section
          aria-labelledby="parent-volunteer-tab-centre"
          className="panel panel__body parent-volunteer-panel"
          id="parent-volunteer-panel-centre"
          role="tabpanel"
        >
          <div className="parent-volunteer-panel__header">
            <div>
              <p className="muted">Learning time</p>
              <h2>Centre Volunteer</h2>
              <p className="muted">
                Support learning time. Two parent spaces are available each day.
              </p>
            </div>
            <div className="parent-volunteer-panel__actions">
              <span className="badge">{String(centreDates.size)} selected</span>
              <Button
                onClick={() => {
                  saveCentreDays.mutate({
                    termId: selectedTerm.id,
                    centreDates: [...centreDates].sort(),
                  });
                }}
                pending={saveCentreDays.isPending}
                size="sm"
                type="button"
              >
                <Save aria-hidden="true" size={16} />
                Save Centre days
              </Button>
            </div>
          </div>
          <p className="muted">
            {formatDate(selectedTerm.from)} - {formatDate(selectedTerm.to)}
          </p>
          <VolunteerWeeks
            days={selectedTerm.centreVolunteer.days}
            onToggle={(date) => {
              setCentreDates((current) => {
                const next = new Set(current);
                if (next.has(date)) next.delete(date);
                else next.add(date);
                return next;
              });
            }}
            pending={saveCentreDays.isPending}
            selected={centreDates}
          />
          {saveCentreDays.error ? (
            <p className="status--error" role="alert">
              {friendlyErrorMessage(saveCentreDays.error)}
            </p>
          ) : null}
        </section>
      ) : (
        <section
          aria-labelledby="parent-volunteer-tab-lunchAndClubs"
          id="parent-volunteer-panel-lunchAndClubs"
          role="tabpanel"
        >
          <LunchAndClubsPanel
            primaryDates={primaryDates}
            scope="parent"
            secondaryDates={secondaryDates}
            setPrimaryDates={setPrimaryDates}
            setSecondaryDates={setSecondaryDates}
            slots={selectedTerm}
          />
        </section>
      )}
    </>
  );
}

function StaffVolunteerSchedule({
  slots,
}: {
  slots: Extract<ParentVolunteerSlots, { scope: 'staff' }>;
}) {
  const terms = slots.terms;
  const [selectedTermId, setSelectedTermId] = useState(terms[0]?.id ?? '');
  const [primaryDates, setPrimaryDates] = useState<Set<string>>(new Set());
  const [secondaryDates, setSecondaryDates] = useState<Set<string>>(new Set());
  const selectedDatesWindow = useRef<string | null>(null);
  const selectedTerm = terms.find((term) => term.id === selectedTermId) ?? terms[0];

  useEffect(() => {
    if (!selectedTerm || selectedDatesWindow.current === selectedTerm.id) return;
    setPrimaryDates(selectedDates(selectedTerm.lunchAndClubs.primary.days));
    setSecondaryDates(selectedDates(selectedTerm.lunchAndClubs.secondary.days));
    selectedDatesWindow.current = selectedTerm.id;
  }, [selectedTerm]);

  if (!selectedTerm) return null;

  return (
    <>
      <VolunteerTermPicker
        selectedTermId={selectedTerm.id}
        setSelectedTermId={setSelectedTermId}
        terms={terms}
      />
      <LunchAndClubsPanel
        primaryDates={primaryDates}
        scope="staff"
        secondaryDates={secondaryDates}
        setPrimaryDates={setPrimaryDates}
        setSecondaryDates={setSecondaryDates}
        slots={selectedTerm}
      />
    </>
  );
}

export function ParentVolunteerClient() {
  const slotsQuery = api.rota.parentVolunteerSlots.useQuery(undefined, { retry: false });
  const slots = slotsQuery.data;

  return (
    <section aria-labelledby="parent-volunteer-title" className="parent-volunteer-page">
      <div className="page-header">
        <div>
          <p>Oasis parent team</p>
          <h1 id="parent-volunteer-title">Volunteer at Oasis</h1>
          <p>Choose where you can help. Other parents&apos; choices stay private.</p>
        </div>
        <span className="badge badge--blue">
          <CalendarDays aria-hidden="true" size={14} />
          Full term
        </span>
      </div>
      {slotsQuery.isLoading ? (
        <div aria-live="polite" className="empty-state" role="status">
          Loading volunteer days...
        </div>
      ) : null}
      {slotsQuery.error ? (
        <p className="status--error" role="alert">
          {friendlyErrorMessage(slotsQuery.error)}
        </p>
      ) : null}
      {slots && slots.scope === 'parent' ? <ParentVolunteerSchedule slots={slots} /> : null}
      {slots && slots.scope === 'staff' ? <StaffVolunteerSchedule slots={slots} /> : null}
    </section>
  );
}

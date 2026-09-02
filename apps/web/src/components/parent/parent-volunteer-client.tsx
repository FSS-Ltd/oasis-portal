'use client';

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { CalendarDays, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { friendlyErrorMessage, showErrorToast, showSuccessToast } from '@/lib/notifications';
import { api, type RouterOutputs } from '@/lib/trpc';

type ParentVolunteerSlots = RouterOutputs['rota']['parentVolunteerSlots'];
type ParentVolunteerTerm = ParentVolunteerSlots['terms'][number];
type VolunteerDay = ParentVolunteerTerm['centreVolunteer']['days'][number];
type VolunteerTab = 'centre' | 'lunchAndClubs';

const volunteerTabs = [
  { id: 'centre', label: 'Centre Volunteer' },
  { id: 'lunchAndClubs', label: 'Lunch + Clubs' },
] as const satisfies readonly { id: VolunteerTab; label: string }[];

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

export function ParentVolunteerClient() {
  const utils = api.useUtils();
  const slotsQuery = api.rota.parentVolunteerSlots.useQuery(undefined, { retry: false });
  const terms = slotsQuery.data?.terms ?? [];
  const [activeTab, setActiveTab] = useState<VolunteerTab>('centre');
  const [selectedTermId, setSelectedTermId] = useState<string | null>(null);
  const [centreDates, setCentreDates] = useState<Set<string>>(new Set());
  const [primaryLunchAndClubsDates, setPrimaryLunchAndClubsDates] = useState<Set<string>>(
    new Set(),
  );
  const [secondaryLunchAndClubsDates, setSecondaryLunchAndClubsDates] = useState<Set<string>>(
    new Set(),
  );
  const selectedDatesWindow = useRef<string | null>(null);
  const selectedTerm = terms.find((term) => term.id === selectedTermId) ?? terms[0] ?? null;

  useEffect(() => {
    if (selectedTerm && selectedTerm.id !== selectedTermId) setSelectedTermId(selectedTerm.id);
  }, [selectedTerm, selectedTermId]);

  useEffect(() => {
    if (!selectedTerm || selectedDatesWindow.current === selectedTerm.id) return;
    setCentreDates(selectedDates(selectedTerm.centreVolunteer.days));
    setPrimaryLunchAndClubsDates(selectedDates(selectedTerm.lunchAndClubs.primary.days));
    setSecondaryLunchAndClubsDates(selectedDates(selectedTerm.lunchAndClubs.secondary.days));
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

  const saveLunchAndClubsDays = api.rota.setMyParentVolunteerDays.useMutation({
    onError: (error) => {
      showErrorToast(error, 'Lunch and clubs volunteer days could not be saved.');
    },
    onSuccess: async () => {
      showSuccessToast('Lunch and clubs volunteer days have been saved.');
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

  const slots = selectedTerm;
  const centreSelectedDayCount = centreDates.size;
  const lunchAndClubsSelectedDayCount =
    primaryLunchAndClubsDates.size + secondaryLunchAndClubsDates.size;
  const activeSaveError =
    activeTab === 'centre' ? saveCentreDays.error : saveLunchAndClubsDays.error;

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

  return (
    <section className="parent-volunteer-page" aria-labelledby="parent-volunteer-title">
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

      {slotsQuery.isLoading ? <div className="empty-state">Loading volunteer days...</div> : null}
      {slotsQuery.error ? (
        <p className="status--error">{friendlyErrorMessage(slotsQuery.error)}</p>
      ) : null}
      {slots ? (
        <>
          <section className="panel panel__body parent-volunteer-panel">
            <div className="section-title">
              <div>
                <p className="muted">Available terms</p>
                <h2>Choose a term</h2>
              </div>
            </div>
            <div className="row-actions" role="group" aria-label="Volunteer term">
              {terms.map((term) => (
                <Button
                  aria-pressed={slots.id === term.id}
                  key={term.id}
                  onClick={() => {
                    setSelectedTermId(term.id);
                  }}
                  size="sm"
                  type="button"
                  variant={slots.id === term.id ? 'primary' : 'secondary'}
                >
                  {term.label} {term.id.slice(0, 4)}
                </Button>
              ))}
            </div>
            <p className="muted">The next term becomes available one week before it starts.</p>
          </section>

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
                  <span className="badge">{String(centreSelectedDayCount)} selected</span>
                  <Button
                    onClick={() => {
                      saveCentreDays.mutate({
                        termId: slots.id,
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
                {formatDate(slots.from)} - {formatDate(slots.to)}
              </p>
              <VolunteerWeeks
                days={slots.centreVolunteer.days}
                onToggle={toggleCentreDate}
                pending={saveCentreDays.isPending}
                selected={centreDates}
              />
            </section>
          ) : (
            <section
              aria-labelledby="parent-volunteer-tab-lunchAndClubs"
              className="panel panel__body parent-volunteer-panel"
              id="parent-volunteer-panel-lunchAndClubs"
              role="tabpanel"
            >
              <div className="parent-volunteer-panel__header">
                <div>
                  <p className="muted">Daily cover</p>
                  <h2>Lunch + Clubs</h2>
                  <p className="muted">
                    Help during lunch and clubs. Choose either Primary or Secondary for each day.
                  </p>
                </div>
                <div className="parent-volunteer-panel__actions">
                  <span className="badge">{String(lunchAndClubsSelectedDayCount)} selected</span>
                  <Button
                    onClick={() => {
                      saveLunchAndClubsDays.mutate({
                        termId: slots.id,
                        primaryLunchAndClubsDates: [...primaryLunchAndClubsDates].sort(),
                        secondaryLunchAndClubsDates: [...secondaryLunchAndClubsDates].sort(),
                      });
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
                <span>
                  Primary · {String(slots.lunchAndClubs.primary.dailyCapacity)} spaces daily
                </span>
                <span>
                  Secondary · {String(slots.lunchAndClubs.secondary.dailyCapacity)} spaces daily
                </span>
              </div>
              <LunchAndClubsWeeks
                onTogglePrimary={(date) => {
                  toggleLunchAndClubsDate(date, 'primary');
                }}
                onToggleSecondary={(date) => {
                  toggleLunchAndClubsDate(date, 'secondary');
                }}
                pending={saveLunchAndClubsDays.isPending}
                primaryDays={slots.lunchAndClubs.primary.days}
                primarySelectedDates={primaryLunchAndClubsDates}
                secondaryDays={slots.lunchAndClubs.secondary.days}
                secondarySelectedDates={secondaryLunchAndClubsDates}
              />
            </section>
          )}

          {activeSaveError ? (
            <p className="status--error">{friendlyErrorMessage(activeSaveError)}</p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

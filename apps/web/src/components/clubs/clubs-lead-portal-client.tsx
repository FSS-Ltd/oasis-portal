'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { displaySchoolYearLabel } from '@oasis/domain';
import { ArrowRight, Bell, ClipboardList, Send, Star, UsersRound } from 'lucide-react';
import { clubCategoriesFor, type BehaviourType } from '@/components/behaviour/behaviour-categories';
import {
  DailyDemeritBadge,
  type DailyDemeritStatus,
  useDailyDemeritStatusMap,
} from '@/components/behaviour/daily-demerit-badge';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Field, SelectInput, TextInput } from '@/components/ui/field';
import { friendlyErrorMessage, showErrorToast, showSuccessToast } from '@/lib/notifications';
import { api, type RouterOutputs } from '@/lib/trpc';
import { ClubAttendancePanel } from './club-attendance-panel';
import { nextScheduledDate } from './club-schedule-utils';
import {
  CLUBS_LEAD_TAB_LABELS,
  clubVisual,
  entryLabel,
  entryTone,
  formatDateTime,
  parseTab,
  todayDate,
  type ClubsLeadTab,
} from './clubs-lead-portal-utils';

type LeadClub = RouterOutputs['club']['leadClubs'][number];
type RosterStudent = RouterOutputs['club']['roster']['signups'][number];
type BehaviourEntry = RouterOutputs['behaviour']['recentEntries']['entries'][number];

function ClubSwitcher({
  clubs,
  onSelect,
  selectedClubId,
}: {
  clubs: readonly LeadClub[];
  onSelect: (clubId: string) => void;
  selectedClubId: string | null;
}) {
  return (
    <div className="clubs-lead-switcher" aria-label="Assigned clubs">
      {clubs.map((club, index) => {
        const selected = club.id === selectedClubId;
        const visual = clubVisual(club, index);
        return (
          <button
            aria-pressed={selected}
            className={selected ? 'clubs-lead-club-chip is-selected' : 'clubs-lead-club-chip'}
            key={club.id}
            onClick={() => {
              onSelect(club.id);
            }}
            style={{ '--club-accent': visual.accent } as CSSProperties}
            type="button"
          >
            <span className="clubs-lead-club-chip__icon">{visual.icon}</span>
            <span>
              <strong>{club.name}</strong>
              <small>{String(club.activeSignupCount)} members</small>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function OverviewTab({
  club,
  clubIndex,
  entries,
  demeritStatuses,
  notificationsCount,
  onTabChange,
  roster,
}: {
  club: LeadClub;
  demeritStatuses: ReadonlyMap<string, DailyDemeritStatus>;
  clubIndex: number;
  entries: readonly BehaviourEntry[];
  notificationsCount: number;
  onTabChange: (tab: ClubsLeadTab) => void;
  roster: readonly RosterStudent[];
}) {
  const visual = clubVisual(club, clubIndex);
  const meritTotal = entries
    .filter((entry) => entry.type === 'Merit')
    .reduce((total, entry) => total + entry.meritDelta, 0);
  const demeritCount = entries.filter((entry) => entry.type === 'Demerit').length;
  const upcomingDate = nextScheduledDate(club);

  return (
    <div className="clubs-lead-panel-stack">
      <section
        className="clubs-lead-hero-card"
        style={{ '--club-accent': visual.accent } as CSSProperties}
      >
        <div className="clubs-lead-hero-card__icon">{visual.icon}</div>
        <div>
          <p>You are the Clubs Lead for</p>
          <h1>{club.name}</h1>
          <span>{club.scheduleLabel ?? 'No schedule set'}</span>
        </div>
        <div className="clubs-lead-hero-card__meta">
          <small>Next session</small>
          <strong>{upcomingDate}</strong>
        </div>
      </section>

      <section className="clubs-lead-stat-grid" aria-label="Club summary">
        <article className="clubs-lead-stat-card">
          <UsersRound aria-hidden="true" size={18} />
          <span>Members</span>
          <strong>{String(roster.length)}</strong>
          <small>
            {club.capacity === null
              ? 'No cap set'
              : `${String(Math.max(club.capacity - roster.length, 0))} spaces left`}
          </small>
        </article>
        <article className="clubs-lead-stat-card">
          <ClipboardList aria-hidden="true" size={18} />
          <span>Register</span>
          <strong>{upcomingDate}</strong>
          <small>Club attendance only</small>
        </article>
        <article className="clubs-lead-stat-card">
          <Star aria-hidden="true" size={18} />
          <span>Merits</span>
          <strong>+{String(meritTotal)}</strong>
          <small>{String(demeritCount)} demerits logged</small>
        </article>
        <article className="clubs-lead-stat-card">
          <Bell aria-hidden="true" size={18} />
          <span>Notices</span>
          <strong>{String(notificationsCount)}</strong>
          <small>Visible to linked guardians</small>
        </article>
      </section>

      <div className="clubs-lead-overview-grid">
        <section className="panel panel__body">
          <div className="section-title">
            <div>
              <p className="muted">Members</p>
              <h2>{club.name}</h2>
            </div>
            <Badge tone="blue">{String(roster.length)}</Badge>
          </div>
          <div className="club-assignment-list">
            {roster.length === 0 ? (
              <EmptyState
                detail="Children assigned to this club will appear here."
                title="No members yet"
              />
            ) : (
              roster.map((student) => (
                <article className="club-assignment-row" key={student.studentId}>
                  <div className="student-row">
                    <Avatar className="student-row__avatar" name={student.studentName} />
                    <span className="student-row__text">
                      <strong>{student.studentName}</strong>
                      <span>{displaySchoolYearLabel(student.yearGroup)}</span>
                    </span>
                    <DailyDemeritBadge status={demeritStatuses.get(student.studentId)} />
                  </div>
                  <Badge tone="green">In club</Badge>
                </article>
              ))
            )}
          </div>
        </section>

        <aside className="clubs-lead-action-stack">
          <section className="panel panel__body">
            <div className="section-title">
              <h2>Quick Actions</h2>
            </div>
            <div className="clubs-lead-action-list">
              <button
                onClick={() => {
                  onTabChange('behaviour');
                }}
                type="button"
              >
                <span>
                  <b className="clubs-lead-dot clubs-lead-dot--green" />
                  Log a merit
                </span>
                <ArrowRight aria-hidden="true" size={16} />
              </button>
              <button
                onClick={() => {
                  onTabChange('behaviour');
                }}
                type="button"
              >
                <span>
                  <b className="clubs-lead-dot clubs-lead-dot--red" />
                  Log a demerit
                </span>
                <ArrowRight aria-hidden="true" size={16} />
              </button>
              <button
                onClick={() => {
                  onTabChange('attendance');
                }}
                type="button"
              >
                <span>
                  <b className="clubs-lead-dot clubs-lead-dot--blue" />
                  Mark attendance
                </span>
                <ArrowRight aria-hidden="true" size={16} />
              </button>
              <button
                onClick={() => {
                  onTabChange('noticeboard');
                }}
                type="button"
              >
                <span>
                  <b className="clubs-lead-dot clubs-lead-dot--amber" />
                  Post a notice
                </span>
                <ArrowRight aria-hidden="true" size={16} />
              </button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function BehaviourTab({
  club,
  demeritStatuses,
  entries,
  roster,
}: {
  club: LeadClub;
  demeritStatuses: ReadonlyMap<string, DailyDemeritStatus>;
  entries: readonly BehaviourEntry[];
  roster: readonly RosterStudent[];
}) {
  const utils = api.useUtils();
  const [type, setType] = useState<BehaviourType>('Merit');
  const [studentId, setStudentId] = useState<string>('');
  const [category, setCategory] = useState('Leadership');
  const [note, setNote] = useState('');
  const [amount, setAmount] = useState('5');
  const logBehaviour = api.behaviour.log.useMutation();
  const categories = clubCategoriesFor(type);

  useEffect(() => {
    setStudentId((current) =>
      current && roster.some((student) => student.studentId === current)
        ? current
        : (roster[0]?.studentId ?? ''),
    );
  }, [roster]);

  useEffect(() => {
    const nextCategory = clubCategoriesFor(type)[0] ?? 'Misc';
    setCategory(nextCategory);
    if (type === 'General') setAmount('0');
    if (type === 'Demerit') setAmount('1');
    if (type === 'Merit') {
      setAmount((current) => (current === '0' ? '5' : current));
    }
  }, [type]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!studentId) return;
    try {
      await logBehaviour.mutateAsync({
        clubId: club.id,
        studentId,
        type,
        category,
        note: note.trim() ? note.trim() : undefined,
        visibility: 'General',
        ...(type === 'Merit' ? { amount: Number(amount) } : {}),
      });
      setNote('');
      showSuccessToast('Entry recorded.');
      await Promise.all([
        utils.behaviour.recentEntries.invalidate(),
        utils.behaviour.dailyDemeritStatuses.invalidate(),
      ]);
    } catch (error) {
      showErrorToast(error, 'Behaviour entry could not be saved.');
    }
  }

  return (
    <div className="clubs-lead-work-grid">
      <section className="panel panel__body">
        <div className="section-title">
          <div>
            <p className="muted">{club.name}</p>
            <h2>Log New Entry</h2>
          </div>
        </div>
        <form
          className="clubs-form"
          onSubmit={(event) => {
            void submit(event);
          }}
        >
          <div aria-label="Behaviour type" className="behaviour-toggle" role="group">
            {(['Merit', 'Demerit', 'General'] as const).map((item) => (
              <button
                className={item === type ? `is-selected is-${item.toLowerCase()}` : undefined}
                key={item}
                onClick={() => {
                  setType(item);
                }}
                type="button"
              >
                {item === 'General' ? 'General mark' : item}
              </button>
            ))}
          </div>

          <Field label="Student" required>
            <SelectInput
              disabled={roster.length === 0 || logBehaviour.isPending}
              onChange={(event) => {
                setStudentId(event.target.value);
              }}
              required
              value={studentId}
            >
              {roster.map((student) => (
                <option key={student.studentId} value={student.studentId}>
                  {student.studentName}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Category" required>
            <SelectInput
              disabled={logBehaviour.isPending}
              onChange={(event) => {
                setCategory(event.target.value);
              }}
              required
              value={category}
            >
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </SelectInput>
          </Field>
          {type === 'Merit' ? (
            <Field label="Merit amount" required>
              <TextInput
                disabled={logBehaviour.isPending}
                min={1}
                onChange={(event) => {
                  setAmount(event.target.value);
                }}
                required
                type="number"
                value={amount}
              />
            </Field>
          ) : null}
          <Field label="Notes" required={type === 'General'}>
            <textarea
              className="input textarea"
              disabled={logBehaviour.isPending}
              maxLength={2000}
              onChange={(event) => {
                setNote(event.target.value);
              }}
              placeholder="What happened? Parents can see General-visible entries."
              required={type === 'General'}
              rows={4}
              value={note}
            />
          </Field>
          <Button disabled={!studentId} pending={logBehaviour.isPending} type="submit">
            <Star aria-hidden="true" size={16} />
            {type === 'Merit'
              ? `Record +${amount || '0'} Merit`
              : type === 'Demerit'
                ? 'Record Demerit'
                : 'Record General Mark'}
          </Button>
          {logBehaviour.error ? (
            <p className="status--error">{friendlyErrorMessage(logBehaviour.error)}</p>
          ) : null}
        </form>
      </section>

      <section className="panel panel__body">
        <div className="section-title">
          <div>
            <p className="muted">Recent entries</p>
            <h2>{club.name}</h2>
          </div>
          <Badge tone="blue">{String(entries.length)}</Badge>
        </div>
        <div className="behaviour-entry-list">
          {entries.length === 0 ? (
            <EmptyState
              detail="Entries for this club will appear here."
              title="No behaviour entries"
            />
          ) : (
            entries.map((entry) => (
              <article className="behaviour-entry-card" key={entry.id}>
                <span className="behaviour-avatar">
                  {entry.studentName.slice(0, 2).toUpperCase()}
                </span>
                <div>
                  <div className="behaviour-entry-card__head">
                    <strong>{entry.studentName}</strong>
                    <DailyDemeritBadge status={demeritStatuses.get(entry.studentId)} />
                    <Badge tone={entryTone(entry)}>{entryLabel(entry)}</Badge>
                  </div>
                  <span className="behaviour-category-pill">{entry.category}</span>
                  {entry.note ? <p>{entry.note}</p> : null}
                  <span>
                    {formatDateTime(entry.createdAt)} by {entry.recordedByName}
                  </span>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function NoticeboardTab({
  club,
  notifications,
}: {
  club: LeadClub;
  notifications: RouterOutputs['club']['notifications'];
}) {
  const utils = api.useUtils();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const notify = api.club.notify.useMutation();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const result = await notify.mutateAsync({
        clubId: club.id,
        title: title.trim(),
        body: body.trim(),
      });
      setTitle('');
      setBody('');
      showSuccessToast(
        result.recipientCount === 0
          ? 'Notice posted. No active signup guardians were found.'
          : `Notice posted to ${String(result.sentCount)} guardian${result.sentCount === 1 ? '' : 's'}.${
              result.skippedOptOutCount > 0
                ? ` ${String(result.skippedOptOutCount)} opted out of email notifications.`
                : ''
            }`,
      );
      await utils.club.notifications.invalidate({ clubId: club.id });
    } catch (error) {
      showErrorToast(error, 'Notice could not be posted.');
    }
  }

  return (
    <div className="clubs-lead-work-grid">
      <section className="panel panel__body">
        <div className="section-title">
          <div>
            <p className="muted">{club.name}</p>
            <h2>Post a Notice</h2>
          </div>
          <Badge tone="green">{String(club.activeSignupCount)} active signups</Badge>
        </div>
        <form
          className="clubs-form"
          onSubmit={(event) => {
            void submit(event);
          }}
        >
          <Field label="Title" required>
            <TextInput
              disabled={notify.isPending}
              maxLength={160}
              onChange={(event) => {
                setTitle(event.target.value);
              }}
              placeholder="Practice update"
              required
              value={title}
            />
          </Field>
          <Field label="Message" required>
            <textarea
              className="input textarea"
              disabled={notify.isPending}
              maxLength={2000}
              onChange={(event) => {
                setBody(event.target.value);
              }}
              placeholder="What do linked guardians need to know?"
              required
              rows={5}
              value={body}
            />
          </Field>
          <div className="club-roster-summary club-roster-summary--green">
            <UsersRound aria-hidden="true" size={18} />
            <span>
              <strong>{club.activeSignupCount} active signups</strong>
              <small>Saved notices appear in linked guardians' My Clubs tab</small>
            </span>
          </div>
          <Button disabled={!title.trim() || !body.trim()} pending={notify.isPending} type="submit">
            <Send aria-hidden="true" size={16} />
            Post Notice
          </Button>
          {notify.error ? (
            <p className="status--error">{friendlyErrorMessage(notify.error)}</p>
          ) : null}
        </form>
      </section>

      <section className="panel panel__body">
        <div className="section-title">
          <div>
            <p className="muted">Posted notices</p>
            <h2>{club.name}</h2>
          </div>
          <Badge tone="blue">{String(notifications.length)}</Badge>
        </div>
        <div className="club-notification-history">
          {notifications.length === 0 ? (
            <EmptyState
              detail="Notices posted for this club will appear here."
              title="No notices"
            />
          ) : (
            notifications.map((notification) => (
              <article className="club-notification-history__item" key={notification.id}>
                <span>
                  <strong>{notification.title}</strong>
                  <small>
                    {formatDateTime(notification.sentAt)} by {notification.sentByName}
                  </small>
                </span>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

export function ClubsLeadPortalClient() {
  const searchParams = useSearchParams();
  const clubsQuery = api.club.leadClubs.useQuery(undefined, { retry: false });
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ClubsLeadTab>(() =>
    parseTab(searchParams?.get('tab') ?? null),
  );
  const [today] = useState(todayDate);
  const clubs = useMemo(() => clubsQuery.data ?? [], [clubsQuery.data]);
  const selectedClub = clubs.find((club) => club.id === selectedClubId) ?? clubs[0] ?? null;
  const demeritStatusQuery = useDailyDemeritStatusMap(
    today,
    selectedClub !== null,
    selectedClub?.id,
  );
  const selectedClubIndex = Math.max(
    clubs.findIndex((club) => club.id === selectedClub?.id),
    0,
  );
  const rosterQuery = api.club.roster.useQuery(
    { clubId: selectedClub?.id ?? '' },
    { enabled: selectedClub !== null, retry: false },
  );
  const recentQuery = api.behaviour.recentEntries.useQuery(
    { date: today, clubId: selectedClub?.id },
    { enabled: selectedClub !== null, retry: false },
  );
  const notificationsQuery = api.club.notifications.useQuery(
    { clubId: selectedClub?.id ?? '' },
    { enabled: selectedClub !== null, retry: false },
  );
  const roster = rosterQuery.data?.signups ?? [];
  const rosterStudentIds = new Set(roster.map((student) => student.studentId));
  const clubEntries = (recentQuery.data?.entries ?? []).filter((entry) =>
    rosterStudentIds.has(entry.studentId),
  );
  const notifications = notificationsQuery.data ?? [];

  useEffect(() => {
    setActiveTab(parseTab(searchParams?.get('tab') ?? null));
  }, [searchParams]);

  useEffect(() => {
    if (!selectedClubId && clubs[0]) {
      setSelectedClubId(clubs[0].id);
    }
    if (selectedClubId && clubs.length > 0 && !clubs.some((club) => club.id === selectedClubId)) {
      setSelectedClubId(clubs[0]?.id ?? null);
    }
  }, [clubs, selectedClubId]);

  if (clubsQuery.isLoading) {
    return <div className="empty-state">Loading assigned clubs...</div>;
  }
  if (clubsQuery.error) {
    return (
      <EmptyState
        detail={friendlyErrorMessage(clubsQuery.error)}
        title="Assigned clubs unavailable"
      />
    );
  }
  if (!selectedClub) {
    return (
      <div className="clubs-lead-page">
        <div className="dashboard-hero dashboard-hero--clubs-lead">
          <p>Clubs Lead Portal</p>
          <h1>No Assigned Clubs</h1>
          <span>Assigned active clubs will appear here.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="clubs-lead-page">
      <ClubSwitcher clubs={clubs} onSelect={setSelectedClubId} selectedClubId={selectedClub.id} />
      <div className="clubs-lead-tabs" role="tablist" aria-label="Clubs Lead sections">
        {CLUBS_LEAD_TAB_LABELS.map(([tab, label]) => (
          <button
            aria-selected={activeTab === tab}
            className={activeTab === tab ? 'is-selected' : ''}
            key={tab}
            onClick={() => {
              setActiveTab(tab);
            }}
            role="tab"
            type="button"
          >
            {label}
          </button>
        ))}
      </div>

      {rosterQuery.error ? (
        <p className="status--error">{friendlyErrorMessage(rosterQuery.error)}</p>
      ) : null}
      {recentQuery.error ? (
        <p className="status--error">{friendlyErrorMessage(recentQuery.error)}</p>
      ) : null}
      {notificationsQuery.error ? (
        <p className="status--error">{friendlyErrorMessage(notificationsQuery.error)}</p>
      ) : null}

      {activeTab === 'overview' ? (
        <OverviewTab
          club={selectedClub}
          clubIndex={selectedClubIndex}
          demeritStatuses={demeritStatusQuery.statusByStudentId}
          entries={clubEntries}
          notificationsCount={notifications.length}
          onTabChange={setActiveTab}
          roster={roster}
        />
      ) : null}
      {activeTab === 'behaviour' ? (
        <BehaviourTab
          club={selectedClub}
          demeritStatuses={demeritStatusQuery.statusByStudentId}
          entries={clubEntries}
          roster={roster}
        />
      ) : null}
      {activeTab === 'attendance' ? <ClubAttendancePanel club={selectedClub} /> : null}
      {activeTab === 'noticeboard' ? (
        <NoticeboardTab club={selectedClub} notifications={notifications} />
      ) : null}
    </div>
  );
}

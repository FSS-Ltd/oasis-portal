'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Goal, Medal, ShieldAlert } from 'lucide-react';
import { displaySchoolYearLabel } from '@oasis/domain';
import { api, type RouterOutputs } from '@/lib/trpc';
import { showErrorToast, showSuccessToast } from '@/lib/notifications';

type PublicLeaderboardKind = 'TopInvestors' | 'TopSavers' | 'TopTithers';
type LeaderboardRow = RouterOutputs['leaderboard']['get']['rows'][number];

interface LeaderboardClientProps {
  canManageCharityGoal?: boolean;
  canViewFullLeaderboard?: boolean;
  includeAdminDemerits?: boolean;
  portal: 'admin' | 'parent' | 'student' | 'supervisor';
}

interface LeaderboardOption {
  kind: PublicLeaderboardKind;
  label: string;
  scoreLabel: string;
}

const leaderboardOptions: LeaderboardOption[] = [
  { kind: 'TopTithers', label: 'Top Tithers', scoreLabel: 'tithed' },
  { kind: 'TopInvestors', label: 'Top Investors', scoreLabel: 'invested' },
  { kind: 'TopSavers', label: 'Top Savers', scoreLabel: 'saved' },
];
const defaultLeaderboardOption: LeaderboardOption = leaderboardOptions[0] ?? {
  kind: 'TopTithers',
  label: 'Top Tithers',
  scoreLabel: 'tithed',
};

const numberFormatter = new Intl.NumberFormat('en-GB');

function formatMerits(value: number): string {
  return `${numberFormatter.format(Math.round(value))} merits`;
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function rankLabel(rank: number): string {
  if (rank === 1) return '1st';
  if (rank === 2) return '2nd';
  if (rank === 3) return '3rd';
  return `#${String(rank)}`;
}

function formatScore(value: number, label: string): string {
  return `${numberFormatter.format(Math.round(value))} ${label}`;
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

function rankNoticeText(
  portal: LeaderboardClientProps['portal'],
  viewerRows: readonly LeaderboardRow[],
): string | null {
  if (viewerRows.length === 0) return null;
  if (portal === 'student') {
    return `You are ranked #${String(viewerRows[0]?.rank)} on this board`;
  }
  if (portal === 'parent' && viewerRows.length === 1 && viewerRows[0]) {
    return `${firstName(viewerRows[0].displayName)} is ranked #${String(
      viewerRows[0].rank,
    )} on this board`;
  }
  if (portal === 'parent') {
    return `Linked children are ranked ${viewerRows
      .map((row) => `#${String(row.rank)}`)
      .join(', ')} on this board`;
  }
  return null;
}

function medalTone(rank: number): 'gold' | 'silver' | 'bronze' | null {
  if (rank === 1) return 'gold';
  if (rank === 2) return 'silver';
  if (rank === 3) return 'bronze';
  return null;
}

function optionFor(kind: PublicLeaderboardKind): LeaderboardOption {
  return leaderboardOptions.find((option) => option.kind === kind) ?? defaultLeaderboardOption;
}

function viewerTitle(portal: LeaderboardClientProps['portal'], count: number): string {
  if (portal === 'student') return 'Your rank';
  if (portal === 'parent') return count === 1 ? 'Linked child rank' : 'Linked child ranks';
  return 'Viewer rank';
}

function pageSummary(page: number, pageSize: number, totalRows: number): string {
  if (totalRows === 0) return 'No students ranked';
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(totalRows, page * pageSize);
  return `Showing ${numberFormatter.format(start)}-${numberFormatter.format(end)} of ${numberFormatter.format(
    totalRows,
  )}`;
}

function LeaderboardRowItem({
  row,
  scoreLabel,
  viewer,
}: {
  row: LeaderboardRow;
  scoreLabel: string;
  viewer?: boolean;
}) {
  const tone = medalTone(row.rank);
  const rowClassName = ['leaderboard-row', viewer ? 'leaderboard-row--viewer' : undefined]
    .filter(Boolean)
    .join(' ');

  return (
    <li className={rowClassName}>
      <span
        className={
          tone
            ? `leaderboard-row__rank leaderboard-row__rank--medal leaderboard-row__rank--${tone}`
            : 'leaderboard-row__rank'
        }
        aria-label={rankLabel(row.rank)}
      >
        {tone ? (
          <>
            <Medal aria-hidden="true" size={20} />
            <span>{String(row.rank)}</span>
          </>
        ) : (
          rankLabel(row.rank)
        )}
      </span>
      <span className="leaderboard-row__avatar" aria-hidden="true">
        {initials(row.displayName)}
      </span>
      <span className="leaderboard-row__student">
        <strong>{row.displayName}</strong>
        <small>{displaySchoolYearLabel(row.yearGroup)}</small>
      </span>
      <strong className="leaderboard-row__score">{formatScore(row.score, scoreLabel)}</strong>
    </li>
  );
}

function CharityPotCard({ canManageGoal }: { canManageGoal: boolean }) {
  const charityPot = api.leaderboard.charityPot.get.useQuery(undefined, { retry: false });
  const utils = api.useUtils();
  const [goalInput, setGoalInput] = useState('');
  const updateGoal = api.leaderboard.charityPot.updateGoal.useMutation({
    onError(error) {
      showErrorToast(error.message);
    },
    onSuccess(result) {
      setGoalInput(String(result.goalMerits));
      showSuccessToast('Charity pot goal updated.');
      void utils.leaderboard.charityPot.get.invalidate();
    },
  });

  const pot = charityPot.data;
  const goalMerits = pot?.goalMerits ?? 0;
  const currentMerits = pot?.currentMerits ?? 0;
  const progressPct = pot?.progressPct ?? 0;
  const goalReached = pot?.goalReached ?? false;

  useEffect(() => {
    if (pot) setGoalInput(String(pot.goalMerits));
  }, [pot]);

  function submitGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const goalMeritsInput = Number(goalInput);
    if (!Number.isInteger(goalMeritsInput) || goalMeritsInput < 0) {
      showErrorToast('Enter a whole merit goal.');
      return;
    }
    updateGoal.mutate({ goalMerits: goalMeritsInput });
  }

  return (
    <aside className="panel panel__body charity-pot-card" aria-labelledby="charity-pot-title">
      <div className="leaderboard-side-heading">
        <span aria-hidden="true">
          <Goal size={18} />
        </span>
        <div>
          <p>Centre giving</p>
          <h2 id="charity-pot-title">Charity pot</h2>
        </div>
      </div>

      {charityPot.isLoading ? <div className="empty-state">Loading charity pot...</div> : null}
      {charityPot.error ? (
        <div className="empty-state status--error">{charityPot.error.message}</div>
      ) : null}

      {!charityPot.isLoading && !charityPot.error ? (
        <>
          <div className="charity-pot-meter" aria-label="Charity pot progress">
            <span style={{ width: `${String(progressPct)}%` }} />
          </div>
          <div className="charity-pot-stats">
            <span>
              <strong>{formatMerits(currentMerits)}</strong>
              <small>raised</small>
            </span>
            <span>
              <strong>{formatMerits(goalMerits)}</strong>
              <small>goal</small>
            </span>
          </div>
          <p
            className={
              goalReached ? 'charity-pot-note charity-pot-note--ready' : 'charity-pot-note'
            }
          >
            {goalReached
              ? 'Goal reached. The centre can plan the charitable event.'
              : 'When the goal is reached, the centre will arrange a charitable event or donation.'}
          </p>
        </>
      ) : null}

      {canManageGoal ? (
        <form className="charity-pot-form" onSubmit={submitGoal}>
          <label htmlFor="charity-pot-goal">Goal amount</label>
          <div>
            <input
              className="input"
              id="charity-pot-goal"
              inputMode="numeric"
              min={0}
              onChange={(event) => {
                setGoalInput(event.target.value);
              }}
              placeholder={String(goalMerits)}
              type="number"
              value={goalInput}
            />
            <button
              className="button button--primary"
              disabled={updateGoal.isPending}
              type="submit"
            >
              {updateGoal.isPending ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      ) : null}
    </aside>
  );
}

export function LeaderboardClient({
  canManageCharityGoal = false,
  canViewFullLeaderboard = false,
  includeAdminDemerits = false,
  portal,
}: LeaderboardClientProps) {
  const [kind, setKind] = useState<PublicLeaderboardKind>('TopTithers');
  const [page, setPage] = useState(1);
  const option = optionFor(kind);
  const includeViewerRows = portal === 'parent' || portal === 'student';
  const fullLeaderboard = canViewFullLeaderboard;
  const pageSize = fullLeaderboard ? 20 : 10;
  const leaderboard = api.leaderboard.get.useQuery(
    {
      includeViewerRows,
      kind,
      limit: 10,
      page,
      pageSize,
      scope: fullLeaderboard ? 'full' : 'public',
    },
    { retry: false },
  );
  const rows = leaderboard.data?.rows ?? [];
  const viewerRows = leaderboard.data?.viewerRows ?? [];
  const totalRows = leaderboard.data?.totalRows ?? rows.length;
  const totalPages = fullLeaderboard ? Math.max(1, Math.ceil(totalRows / pageSize)) : 1;
  const topStudentIds = useMemo(() => new Set(rows.map((row) => row.studentId)), [rows]);
  const outsideTopViewerRows = useMemo(
    () => viewerRows.filter((row) => !topStudentIds.has(row.studentId)),
    [topStudentIds, viewerRows],
  );
  const hasRows = rows.length > 0;
  const viewerHeading = useMemo(
    () => viewerTitle(portal, outsideTopViewerRows.length),
    [outsideTopViewerRows.length, portal],
  );
  const rankNotice = useMemo(() => rankNoticeText(portal, viewerRows), [portal, viewerRows]);

  useEffect(() => {
    setPage(1);
  }, [kind]);

  return (
    <section className="leaderboard-page" aria-labelledby="leaderboard-title">
      <div className="leaderboard-page__header">
        <div>
          <p>Merit economy</p>
          <h1 id="leaderboard-title">Leaderboard</h1>
        </div>
      </div>

      <div className="leaderboard-layout">
        <section className="panel panel__body leaderboard-panel" aria-label="Student rankings">
          <div className="leaderboard-tabs" role="tablist" aria-label="Leaderboard categories">
            {leaderboardOptions.map((item) => (
              <button
                aria-selected={kind === item.kind}
                className={kind === item.kind ? 'is-active' : undefined}
                key={item.kind}
                onClick={() => {
                  setKind(item.kind);
                }}
                role="tab"
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>

          {includeAdminDemerits ? (
            <div className="leaderboard-admin-note">
              <ShieldAlert aria-hidden="true" size={16} />
              <span>Demerit boards remain restricted to authorised staff.</span>
            </div>
          ) : null}

          {fullLeaderboard ? (
            <div className="leaderboard-full-note">
              <span>Full centre list</span>
              <strong>{pageSummary(page, pageSize, totalRows)}</strong>
            </div>
          ) : null}

          {!fullLeaderboard && rankNotice ? (
            <div className="leaderboard-rank-notice">{rankNotice}</div>
          ) : null}

          {leaderboard.isLoading ? <div className="empty-state">Loading leaderboard...</div> : null}
          {leaderboard.error ? (
            <div className="empty-state status--error">{leaderboard.error.message}</div>
          ) : null}
          {!leaderboard.isLoading && !leaderboard.error && !hasRows ? (
            <div className="empty-state">No rankings are available for this category yet.</div>
          ) : null}

          {hasRows ? (
            <ol className="leaderboard-list">
              {rows.map((row) => (
                <LeaderboardRowItem key={row.studentId} row={row} scoreLabel={option.scoreLabel} />
              ))}
            </ol>
          ) : null}

          {fullLeaderboard && totalRows > pageSize ? (
            <div className="leaderboard-pagination" aria-label="Leaderboard pagination">
              <button
                className="button button--ghost"
                disabled={page <= 1 || leaderboard.isLoading}
                onClick={() => {
                  setPage((current) => Math.max(1, current - 1));
                }}
                type="button"
              >
                Previous
              </button>
              <span>
                Page {numberFormatter.format(page)} of {numberFormatter.format(totalPages)}
              </span>
              <button
                className="button button--ghost"
                disabled={page >= totalPages || leaderboard.isLoading}
                onClick={() => {
                  setPage((current) => Math.min(totalPages, current + 1));
                }}
                type="button"
              >
                Next
              </button>
            </div>
          ) : null}

          {!fullLeaderboard && outsideTopViewerRows.length > 0 ? (
            <div className="leaderboard-viewer-section">
              <div className="leaderboard-viewer-section__title">
                <Medal aria-hidden="true" size={16} />
                <span>{viewerHeading}</span>
              </div>
              <ol className="leaderboard-list leaderboard-list--viewer">
                {outsideTopViewerRows.map((row) => (
                  <LeaderboardRowItem
                    key={row.studentId}
                    row={row}
                    scoreLabel={option.scoreLabel}
                    viewer
                  />
                ))}
              </ol>
            </div>
          ) : null}
        </section>

        <CharityPotCard canManageGoal={canManageCharityGoal} />
      </div>
    </section>
  );
}

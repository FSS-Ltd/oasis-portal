'use client';

import { formatPaceIdentifier, resolveReportPeriod } from '@oasis/domain';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { friendlyErrorMessage } from '@/lib/notifications';
import { api } from '@/lib/trpc';
import { EmptyState } from '@/components/ui/empty-state';
import { Field, SelectInput } from '@/components/ui/field';
import { ParentChildSelector } from './parent-child-selector';
import { ParentPaceHistoryTable } from './parent-pace-history-table';

const PAGE_SIZE = 20;
const TERM_SEASONS = ['Autumn', 'Spring', 'Summer'] as const;

type PaceView = 'current' | 'history';
type HistoryPeriodKind = 'AcademicYear' | 'Term';
type TermSeason = (typeof TERM_SEASONS)[number];

function currentAcademicYearStart(referenceDate = new Date()): number {
  return referenceDate.getUTCMonth() >= 8
    ? referenceDate.getUTCFullYear()
    : referenceDate.getUTCFullYear() - 1;
}

function currentTermSeason(referenceDate = new Date()): TermSeason {
  const month = referenceDate.getUTCMonth();
  if (month < 3) return 'Spring';
  if (month < 8) return 'Summer';
  return 'Autumn';
}

function academicYearLabel(startYear: number): string {
  return `${String(startYear)}/${String(startYear + 1).slice(-2)} Academic Year`;
}

function TwoOptionSegmentedControl<T extends string>({
  ariaLabel,
  items,
  onChange,
  value,
}: {
  ariaLabel: string;
  items: readonly { label: string; value: T }[];
  onChange: (value: T) => void;
  value: T;
}) {
  return (
    <div aria-label={ariaLabel} className="parent-pace-segmented" role="tablist">
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <button
            aria-selected={selected}
            className={selected ? 'is-active' : undefined}
            key={item.value}
            onClick={() => {
              onChange(item.value);
            }}
            role="tab"
            type="button"
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export function ParentPaceClient() {
  const searchParams = useSearchParams();
  const profileQuery = api.profile.me.useQuery(undefined, { retry: false });
  const children = profileQuery.data?.children ?? [];
  const requestedStudentId = searchParams?.get('studentId') ?? null;
  const appliedRequestedStudentId = useRef<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [view, setView] = useState<PaceView>('current');
  const [periodKind, setPeriodKind] = useState<HistoryPeriodKind>('AcademicYear');
  const [academicYear, setAcademicYear] = useState(() => currentAcademicYearStart());
  const [termSeason, setTermSeason] = useState<TermSeason>(() => currentTermSeason());
  const [page, setPage] = useState(1);
  const academicYears = useMemo(
    () => Array.from({ length: 7 }, (_, index) => currentAcademicYearStart() - index),
    [],
  );

  useEffect(() => {
    const requestedChild = requestedStudentId
      ? children.find((child) => child.id === requestedStudentId)
      : undefined;
    if (requestedChild && appliedRequestedStudentId.current !== requestedStudentId) {
      appliedRequestedStudentId.current = requestedStudentId;
      setSelectedStudentId(requestedChild.id);
      return;
    }
    if (!selectedStudentId || !children.some((child) => child.id === selectedStudentId)) {
      setSelectedStudentId(children[0]?.id ?? null);
    }
  }, [children, requestedStudentId, selectedStudentId]);

  const period = useMemo(
    () =>
      periodKind === 'AcademicYear'
        ? { type: 'AcademicYear' as const, startYear: academicYear }
        : { type: 'Term' as const, term: `${String(academicYear)}-${termSeason}` },
    [academicYear, periodKind, termSeason],
  );
  const resolvedPeriod = useMemo(() => resolveReportPeriod(period), [period]);
  const currentQuery = api.pace.parentCurrent.useQuery(
    { studentId: selectedStudentId ?? '' },
    { enabled: Boolean(selectedStudentId), retry: false },
  );
  const historyQuery = api.pace.parentHistory.useQuery(
    { studentId: selectedStudentId ?? '', period, page, pageSize: PAGE_SIZE },
    { enabled: Boolean(selectedStudentId) && view === 'history', retry: false },
  );

  useEffect(() => {
    setPage(1);
  }, [academicYear, periodKind, selectedStudentId, termSeason, view]);

  if (profileQuery.isLoading) {
    return <EmptyState title="Loading linked children" />;
  }
  if (profileQuery.error) {
    return (
      <EmptyState detail={friendlyErrorMessage(profileQuery.error)} title="PACE is unavailable" />
    );
  }
  if (children.length === 0 || !selectedStudentId) {
    return (
      <EmptyState
        detail="Ask the Head of Centre to link your child records to this account."
        title="No linked children found"
      />
    );
  }

  const childOptions = children.map((child) => ({
    fullName: child.fullName,
    id: child.id,
    yearGroup: child.yearGroup,
  }));
  const selectedChild = children.find((child) => child.id === selectedStudentId) ?? null;
  const current = currentQuery.data;

  return (
    <div className="parent-pace-page">
      <header className="parent-pace-hero">
        <div className="parent-pace-hero__copy">
          <p className="parent-pace-hero__eyebrow">Academic progress</p>
          <h1>PACE</h1>
          <p className="parent-pace-hero__description">
            {selectedChild
              ? `A clear view of ${selectedChild.fullName}'s current PACE work and assessments.`
              : 'A clear view of current PACE work and assessments.'}
          </p>
        </div>
        <div className="parent-pace-hero__selector">
          <span>Viewing progress for</span>
          {childOptions.length > 1 ? (
            <ParentChildSelector
              children={childOptions}
              onSelect={setSelectedStudentId}
              selectedChildId={selectedStudentId}
            />
          ) : (
            <strong>{selectedChild?.fullName ?? 'Linked child'}</strong>
          )}
        </div>
      </header>

      <div className="parent-pace-view-switcher">
        <TwoOptionSegmentedControl
          ariaLabel="PACE view"
          items={[
            { label: 'Current', value: 'current' },
            { label: 'History', value: 'history' },
          ]}
          onChange={setView}
          value={view}
        />
      </div>

      {view === 'current' ? (
        <section aria-label="Current PACE subjects" className="parent-pace-current" role="tabpanel">
          {currentQuery.isLoading ? <EmptyState title="Loading current PACE subjects…" /> : null}
          {currentQuery.error ? (
            <EmptyState
              detail={friendlyErrorMessage(
                currentQuery.error,
                'Current PACE subjects could not be loaded.',
              )}
              title="PACE is unavailable"
            />
          ) : null}
          {current && current.subjects.length === 0 ? (
            <EmptyState
              detail="Current PACE subjects will appear here when they are assigned."
              title="No active PACE subjects"
            />
          ) : null}
          {current ? (
            <div className="parent-pace-current__list">
              {current.subjects.map((subject) => (
                <article className="parent-pace-current__subject" key={subject.subjectCode}>
                  <span>{subject.subjectCode}</span>
                  <h2>{subject.subjectName}</h2>
                  <strong
                    aria-label={`${subject.subjectName}, PACE ${formatPaceIdentifier(subject.currentPaceNumber)}`}
                  >
                    PACE {formatPaceIdentifier(subject.currentPaceNumber)}
                  </strong>
                </article>
              ))}
            </div>
          ) : null}
        </section>
      ) : (
        <section
          aria-label="PACE history controls"
          className="parent-pace-history-panel"
          role="tabpanel"
        >
          <div className="parent-pace-history-panel__controls">
            <TwoOptionSegmentedControl
              ariaLabel="PACE history period"
              items={[
                { label: 'Academic Year', value: 'AcademicYear' },
                { label: 'Term', value: 'Term' },
              ]}
              onChange={setPeriodKind}
              value={periodKind}
            />
            <div className="parent-pace-period-picker">
              <Field label={periodKind === 'AcademicYear' ? 'Academic year' : 'Term year'}>
                <SelectInput
                  onChange={(event) => {
                    setAcademicYear(Number(event.target.value));
                  }}
                  value={academicYear}
                >
                  {academicYears.map((year) => (
                    <option key={year} value={year}>
                      {academicYearLabel(year)}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              {periodKind === 'Term' ? (
                <Field label="Term">
                  <SelectInput
                    onChange={(event) => {
                      setTermSeason(event.target.value as TermSeason);
                    }}
                    value={termSeason}
                  >
                    {TERM_SEASONS.map((season) => (
                      <option key={season} value={season}>
                        {season}
                      </option>
                    ))}
                  </SelectInput>
                </Field>
              ) : null}
            </div>
            <p className="parent-pace-history-panel__period">
              Showing {resolvedPeriod.snapshot.label}
            </p>
          </div>
          <ParentPaceHistoryTable
            error={historyQuery.error}
            history={historyQuery.data}
            isLoading={historyQuery.isLoading}
            onNextPage={() => {
              setPage((currentPage) => currentPage + 1);
            }}
            onPreviousPage={() => {
              setPage((currentPage) => Math.max(1, currentPage - 1));
            }}
          />
        </section>
      )}
    </div>
  );
}

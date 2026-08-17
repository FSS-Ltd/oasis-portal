'use client';

import { reportAcademicYearOptions, resolveReportPeriod } from '@oasis/domain';
import type { RouterInputs } from '@/lib/trpc';
import { Field, SelectInput, TextInput } from '@/components/ui/field';

type DraftPeriod = RouterInputs['report']['draft']['period'];
type ReportType = DraftPeriod['type'];
type TermSeason = 'Spring' | 'Summer' | 'Autumn';

interface ReportPeriodControlsProps {
  disabled: boolean;
  error?: string;
  onChange: (period: DraftPeriod) => void;
  value: DraftPeriod;
}

const TERM_SEASONS: readonly TermSeason[] = ['Autumn', 'Spring', 'Summer'];

function currentAcademicYearStart(referenceDate = new Date()): number {
  const year = referenceDate.getUTCFullYear();
  return referenceDate.getUTCMonth() >= 8 ? year : year - 1;
}

function currentTerm(referenceDate = new Date()): { season: TermSeason; year: number } {
  const month = referenceDate.getUTCMonth();
  return {
    season: month < 3 ? 'Spring' : month < 8 ? 'Summer' : 'Autumn',
    year: referenceDate.getUTCFullYear(),
  };
}

function currentDateKey(referenceDate = new Date()): string {
  return [
    String(referenceDate.getUTCFullYear()).padStart(4, '0'),
    String(referenceDate.getUTCMonth() + 1).padStart(2, '0'),
    String(referenceDate.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

function periodForType(type: ReportType): DraftPeriod {
  if (type === 'AcademicYear') {
    return { type, startYear: currentAcademicYearStart() };
  }
  if (type === 'Term') {
    const term = currentTerm();
    return { type, term: `${String(term.year)}-${term.season}` };
  }
  const today = currentDateKey();
  return { type, from: today, to: today };
}

function termParts(value: DraftPeriod): { season: TermSeason; year: number } {
  if (value.type !== 'Term') return currentTerm();
  const match = /^(\d{4})-(Spring|Summer|Autumn)$/u.exec(value.term);
  if (!match?.[1] || !match[2]) return currentTerm();
  return { year: Number(match[1]), season: match[2] as TermSeason };
}

function academicYearLabel(startYear: number): string {
  return `${String(startYear)}/${String(startYear + 1).slice(-2)}`;
}

function periodHelp(value: DraftPeriod): string {
  try {
    const period = resolveReportPeriod(value).snapshot;
    return `${period.label} · ${period.from} to ${period.to}, inclusive`;
  } catch {
    return 'Choose a valid inclusive report period.';
  }
}

export function ReportPeriodControls({
  disabled,
  error,
  onChange,
  value,
}: ReportPeriodControlsProps) {
  const academicYears = reportAcademicYearOptions();
  const term = termParts(value);

  return (
    <fieldset className="report-period-controls" disabled={disabled}>
      <legend>Report Period</legend>
      <div className="report-period-grid">
        <Field error={error} label="Report Type">
          <SelectInput
            onChange={(event) => {
              const type = event.target.value;
              if (type === 'AcademicYear' || type === 'Term' || type === 'Custom') {
                onChange(periodForType(type));
              }
            }}
            value={value.type}
          >
            <option value="AcademicYear">Academic Year</option>
            <option value="Term">Term</option>
            <option value="Custom">Custom Date Range</option>
          </SelectInput>
        </Field>

        {value.type === 'AcademicYear' ? (
          <Field label="Academic Year">
            <SelectInput
              onChange={(event) => {
                onChange({ type: 'AcademicYear', startYear: Number(event.target.value) });
              }}
              value={value.startYear}
            >
              {academicYears.map((startYear) => (
                <option key={startYear} value={startYear}>
                  {academicYearLabel(startYear)}
                </option>
              ))}
            </SelectInput>
          </Field>
        ) : null}

        {value.type === 'Term' ? (
          <>
            <Field label="Term Year">
              <SelectInput
                onChange={(event) => {
                  onChange({
                    type: 'Term',
                    term: `${event.target.value}-${term.season}`,
                  });
                }}
                value={term.year}
              >
                {academicYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Term">
              <SelectInput
                onChange={(event) => {
                  const season = event.target.value;
                  if (season === 'Spring' || season === 'Summer' || season === 'Autumn') {
                    onChange({ type: 'Term', term: `${String(term.year)}-${season}` });
                  }
                }}
                value={term.season}
              >
                {TERM_SEASONS.map((season) => (
                  <option key={season} value={season}>
                    {season}
                  </option>
                ))}
              </SelectInput>
            </Field>
          </>
        ) : null}

        {value.type === 'Custom' ? (
          <>
            <Field label="From">
              <TextInput
                onChange={(event) => {
                  onChange({ ...value, from: event.target.value });
                }}
                type="date"
                value={value.from}
              />
            </Field>
            <Field label="To">
              <TextInput
                onChange={(event) => {
                  onChange({ ...value, to: event.target.value });
                }}
                type="date"
                value={value.to}
              />
            </Field>
          </>
        ) : null}
      </div>
      <p className="muted report-period-help">{periodHelp(value)}</p>
    </fieldset>
  );
}

export type { DraftPeriod };

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_REPORT_SECTIONS,
  formatPaceIdentifier,
  reportAcademicYearOptions,
  reportSectionsSchema,
  resolveReportPeriod,
} from '../report.js';

describe('resolveReportPeriod', () => {
  it('resolves academic year, term, and inclusive custom ranges', () => {
    expect(resolveReportPeriod({ type: 'AcademicYear', startYear: 2025 })).toMatchObject({
      snapshot: {
        type: 'AcademicYear',
        key: '2025-AcademicYear',
        label: '2025/26 Academic Year',
        from: '2025-09-01',
        to: '2026-08-31',
      },
      queryFrom: new Date('2025-09-01T00:00:00.000Z'),
      queryToExclusive: new Date('2026-09-01T00:00:00.000Z'),
    });
    expect(resolveReportPeriod({ type: 'Term', term: '2026-Summer' }).snapshot).toEqual({
      type: 'Term',
      key: '2026-Summer',
      label: 'Summer 2026',
      from: '2026-04-01',
      to: '2026-08-31',
    });
    expect(
      resolveReportPeriod({ type: 'Custom', from: '2026-05-01', to: '2026-05-31' }),
    ).toMatchObject({
      snapshot: {
        type: 'Custom',
        key: '2026-05-01_to_2026-05-31',
        label: '1 May 2026 - 31 May 2026',
      },
      queryToExclusive: new Date('2026-06-01T00:00:00.000Z'),
    });
  });

  it('rejects invalid dates and reversed custom ranges', () => {
    expect(() =>
      resolveReportPeriod({ type: 'Custom', from: '2026-02-30', to: '2026-03-01' }),
    ).toThrow('from must be a valid ISO date');
    expect(() =>
      resolveReportPeriod({ type: 'Custom', from: '2026-06-01', to: '2026-05-31' }),
    ).toThrow('from must not be after to');
  });
});

describe('reportSectionsSchema', () => {
  it('defaults every section to visible', () => {
    expect(reportSectionsSchema.parse(undefined)).toEqual(DEFAULT_REPORT_SECTIONS);
  });

  it('requires one section and rejects PACE status without PACE progress', () => {
    const none = Object.fromEntries(
      Object.keys(DEFAULT_REPORT_SECTIONS).map((key) => [key, false]),
    );
    expect(reportSectionsSchema.safeParse(none).success).toBe(false);
    expect(
      reportSectionsSchema.safeParse({
        ...DEFAULT_REPORT_SECTIONS,
        paceProgress: false,
        paceStatus: true,
      }).success,
    ).toBe(false);
  });
});

describe('report display helpers', () => {
  it('keeps PACE identifiers ungrouped and provides current report years', () => {
    expect(formatPaceIdentifier(1025)).toBe('1025');
    expect(reportAcademicYearOptions(new Date('2026-08-17T12:00:00.000Z'))).toEqual([
      2026, 2025, 2024, 2023, 2022, 2021, 2020,
    ]);
  });
});

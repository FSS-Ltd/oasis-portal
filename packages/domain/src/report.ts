/**
 * End-of-term report compilation.
 *
 * Head selects a student + term. This module turns a pre-fetched bundle of
 * per-term data into a structured report object. The route handler then:
 *   1. Encrypts the JSON (ADR-005) and writes `TermReport.compiledJsonEnc`.
 *   2. Status starts Draft; Head reviews; transitions to Sent.
 *   3. Snapshot is frozen at send-time — later behaviour edits do not change
 *      an already-sent report.
 */
import { applyRows, type LedgerRow, type Balances } from './meritLedger.js';
import { attendanceRate } from './attendance.js';
import type { PaceProgressStatusResult } from './subjects.js';
import type { ReportPeriodSnapshot } from './reportPeriod.js';
import { z } from 'zod';

export * from './reportPeriod.js';

export const DEFAULT_REPORT_SECTIONS = {
  attendance: true,
  paceProgress: true,
  paceStatus: true,
  behaviourSummary: true,
  behaviourNotes: true,
  generalNotes: true,
  meritActivity: true,
  balances: true,
  progressComment: true,
} as const;

export type ReportSections = { [K in keyof typeof DEFAULT_REPORT_SECTIONS]: boolean };

export const reportSectionsSchema = z
  .object({
    attendance: z.boolean(),
    paceProgress: z.boolean(),
    paceStatus: z.boolean(),
    behaviourSummary: z.boolean(),
    behaviourNotes: z.boolean(),
    generalNotes: z.boolean(),
    meritActivity: z.boolean(),
    balances: z.boolean(),
    progressComment: z.boolean(),
  })
  .default(DEFAULT_REPORT_SECTIONS)
  .superRefine((sections, ctx) => {
    if (!Object.values(sections).some(Boolean)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'select at least one report section',
      });
    }
    if (sections.paceStatus && !sections.paceProgress) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'PACE Status requires PACE Progress',
        path: ['paceStatus'],
      });
    }
  });

export function formatPaceIdentifier(value: number): string {
  return String(value);
}

export function reportAcademicYearOptions(referenceDate: Date = new Date()): number[] {
  const year = referenceDate.getUTCFullYear();
  const currentStart = referenceDate.getUTCMonth() >= 8 ? year : year - 1;
  return Array.from({ length: 7 }, (_, index) => currentStart + 1 - index);
}

export interface PaceSnapshot {
  subjectCode: string;
  subjectName: string;
  currentPace: number;
  pacesCompletedThisTerm: number;
  averageTestScore: number | null;
  status: PaceProgressStatusResult;
}

export type ReportEntryOrigin = 'Source' | 'Report';

export interface ReportTextEntryInput {
  id: string;
  origin: ReportEntryOrigin;
  createdAt: Date;
  category?: string | undefined;
  note: string | null;
}

export interface CompileStudentReportInput {
  studentId: string;
  studentDisplayName: string;
  period: ReportPeriodSnapshot;
  sections: ReportSections;
  attendance: { total: number; present: number; absent: number; late: number };
  paces: readonly PaceSnapshot[];
  behaviour: {
    meritsEarned: number;
    demeritsCount: number;
    demeritsMerits: number;
    generalEntries: readonly ReportTextEntryInput[];
  };
  notes: readonly ReportTextEntryInput[];
  ledgerRows: readonly (Pick<LedgerRow, 'account' | 'delta' | 'reason'> & {
    createdAt: Date;
  })[];
  headSummary?: string | undefined;
}

export interface ReportTextEntrySnapshot {
  id: string;
  origin: ReportEntryOrigin;
  createdAt: string;
  category?: string | undefined;
  note: string | null;
}

export interface MeritActivitySnapshot {
  createdAt: string;
  account: LedgerRow['account'];
  delta: number;
  reason: string;
}

export interface ReportAuthor {
  name: string;
  role: string;
}

export interface CompiledReport {
  studentId: string;
  studentDisplayName: string;
  author?: ReportAuthor;
  period: ReportPeriodSnapshot;
  sections: ReportSections;
  attendance: CompileStudentReportInput['attendance'] & { attendancePct: number };
  paces: readonly PaceSnapshot[];
  behaviour: Omit<CompileStudentReportInput['behaviour'], 'generalEntries'> & {
    generalEntries: readonly ReportTextEntrySnapshot[];
  };
  notes: readonly ReportTextEntrySnapshot[];
  meritActivity: readonly MeritActivitySnapshot[];
  balances: Balances;
  headSummary: string;
  compiledAt: string; // ISO
}

export function compileStudentReport(input: CompileStudentReportInput): CompiledReport {
  if (input.attendance.total < 0) throw new Error('attendance.total must be >= 0');
  const attendancePct = attendanceRate(input.attendance) ?? 0;

  return {
    studentId: input.studentId,
    studentDisplayName: input.studentDisplayName,
    period: { ...input.period },
    sections: { ...input.sections },
    attendance: { ...input.attendance, attendancePct },
    paces: input.paces.map((pace) => ({ ...pace, status: { ...pace.status } })),
    behaviour: {
      ...input.behaviour,
      generalEntries: input.behaviour.generalEntries.map((entry) => ({
        id: entry.id,
        origin: entry.origin,
        createdAt: entry.createdAt.toISOString(),
        ...(entry.category ? { category: entry.category } : {}),
        note: entry.note,
      })),
    },
    notes: input.notes.map((note) => ({
      id: note.id,
      origin: note.origin,
      createdAt: note.createdAt.toISOString(),
      ...(note.category ? { category: note.category } : {}),
      note: note.note,
    })),
    meritActivity: input.ledgerRows.map((row) => ({
      createdAt: row.createdAt.toISOString(),
      account: row.account,
      delta: row.delta,
      reason: row.reason,
    })),
    balances: applyRows(input.ledgerRows),
    headSummary: input.headSummary ?? '',
    compiledAt: new Date().toISOString(),
  };
}

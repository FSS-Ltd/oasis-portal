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

export interface PaceSnapshot {
  subjectCode: string;
  subjectName: string;
  currentPace: number;
  pacesCompletedThisTerm: number;
  averageTestScore: number | null;
}

export interface CompileReportInput {
  studentId: string;
  studentDisplayName: string;
  term: string;
  attendance: { total: number; present: number; absent: number; late: number };
  paces: readonly PaceSnapshot[];
  behaviour: {
    meritsEarned: number;
    demeritsCount: number;
    demeritsMerits: number;
    generalEntries: readonly { createdAt: Date; category: string; note: string | null }[];
  };
  notes: readonly { createdAt: Date; note: string }[];
  ledgerRows: readonly (Pick<LedgerRow, 'account' | 'delta' | 'reason'> & {
    createdAt: Date;
  })[];
  headSummary?: string | undefined;
}

export interface ReportTextEntrySnapshot {
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

export interface CompiledReport {
  studentId: string;
  studentDisplayName: string;
  term: string;
  attendance: CompileReportInput['attendance'] & { attendancePct: number };
  paces: readonly PaceSnapshot[];
  behaviour: Omit<CompileReportInput['behaviour'], 'generalEntries'> & {
    generalEntries: readonly ReportTextEntrySnapshot[];
  };
  notes: readonly ReportTextEntrySnapshot[];
  meritActivity: readonly MeritActivitySnapshot[];
  balances: Balances;
  headSummary: string;
  compiledAt: string; // ISO
}

export function compileTermReport(input: CompileReportInput): CompiledReport {
  if (input.attendance.total < 0) throw new Error('attendance.total must be >= 0');
  const attendancePct = attendanceRate(input.attendance) ?? 0;

  return {
    studentId: input.studentId,
    studentDisplayName: input.studentDisplayName,
    term: input.term,
    attendance: { ...input.attendance, attendancePct },
    paces: input.paces,
    behaviour: {
      ...input.behaviour,
      generalEntries: input.behaviour.generalEntries.map((entry) => ({
        createdAt: entry.createdAt.toISOString(),
        category: entry.category,
        note: entry.note,
      })),
    },
    notes: input.notes.map((note) => ({
      createdAt: note.createdAt.toISOString(),
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

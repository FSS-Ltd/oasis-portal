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
  ledgerRows: readonly Pick<LedgerRow, 'account' | 'delta'>[];
  headSummary?: string;
}

export interface CompiledReport {
  studentId: string;
  studentDisplayName: string;
  term: string;
  attendance: CompileReportInput['attendance'] & { attendancePct: number };
  paces: readonly PaceSnapshot[];
  behaviour: CompileReportInput['behaviour'];
  balances: Balances;
  headSummary: string;
  compiledAt: string; // ISO
}

export function compileTermReport(input: CompileReportInput): CompiledReport {
  if (input.attendance.total < 0) throw new Error('attendance.total must be >= 0');
  const attendancePct =
    input.attendance.total === 0
      ? 0
      : Math.round((input.attendance.present / input.attendance.total) * 100);

  return {
    studentId: input.studentId,
    studentDisplayName: input.studentDisplayName,
    term: input.term,
    attendance: { ...input.attendance, attendancePct },
    paces: input.paces,
    behaviour: input.behaviour,
    balances: applyRows(input.ledgerRows),
    headSummary: input.headSummary ?? '',
    compiledAt: new Date().toISOString(),
  };
}

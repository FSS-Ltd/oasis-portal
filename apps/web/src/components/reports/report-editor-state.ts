import type { TermReport } from './report-format';

export type ReportTextEntry = TermReport['compiled']['notes'][number];

export interface ReportSpecificNoteDraft {
  id: string;
  category?: string;
  note: string;
}

export interface ReportEditorState {
  progressComment: string;
  behaviourNotes: ReportSpecificNoteDraft[];
  generalNotes: ReportSpecificNoteDraft[];
}

export function reportSpecificNotes(
  entries: readonly ReportTextEntry[],
): ReportSpecificNoteDraft[] {
  return entries
    .filter((entry) => entry.origin === 'Report')
    .map((entry) => ({
      id: entry.id,
      ...(entry.category ? { category: entry.category } : {}),
      note: entry.note ?? '',
    }));
}

export function editorStateForReport(report: TermReport | null): ReportEditorState {
  if (!report) return { progressComment: '', behaviourNotes: [], generalNotes: [] };
  return {
    progressComment: report.compiled.headSummary,
    behaviourNotes: reportSpecificNotes(report.compiled.behaviour.generalEntries),
    generalNotes: reportSpecificNotes(report.compiled.notes).map(({ id, note }) => ({ id, note })),
  };
}

export function hasBlankReportNotes(state: ReportEditorState): boolean {
  return [...state.behaviourNotes, ...state.generalNotes].some(
    (entry) => entry.note.trim().length === 0,
  );
}

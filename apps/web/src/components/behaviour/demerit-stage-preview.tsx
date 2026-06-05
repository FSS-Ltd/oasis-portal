import {
  demeritPolicyStageForUnits,
  demeritPolicyStageLabel,
  demeritPolicyUnitsForEntry,
  type DemeritPolicyStage,
} from '@oasis/domain';
import type { RouterOutputs } from '@/lib/trpc';

type DailyDemeritStatus = RouterOutputs['behaviour']['dailyDemeritStatuses']['statuses'][number];

export interface DemeritStagePreview {
  affectedCount: number;
  escalates: boolean;
  nextStage: DemeritPolicyStage;
  noteRequired: boolean;
  previousStage: DemeritPolicyStage;
}

export interface DemeritBatchPreviewEntry {
  amount: string;
  category: string;
  count: string;
}

function defaultDemeritStatus(studentId: string): DailyDemeritStatus {
  return {
    badgeTone: 'green',
    demeritUnits: 0,
    manualStage: null,
    manualStageSetAt: null,
    manualStageSetById: null,
    requiresHeadReview: false,
    stage: 0,
    stageLabel: demeritPolicyStageLabel(0),
    studentId,
  };
}

function proposedDemeritUnits(category: string, amount: string): number {
  const selectedAmount = Number(amount);
  return demeritPolicyUnitsForEntry({
    category,
    meritDelta: Number.isFinite(selectedAmount) && selectedAmount > 0 ? -selectedAmount : -1,
    type: 'Demerit',
  });
}

function nextStageForStatus(
  status: DailyDemeritStatus,
  category: string,
  amount: string,
): DemeritPolicyStage {
  const nextUnits = status.demeritUnits + proposedDemeritUnits(category, amount);
  const countStage = demeritPolicyStageForUnits(nextUnits);
  return Math.max(status.stage, countStage) as DemeritPolicyStage;
}

export function previewSingleDemeritStage(
  studentIds: readonly string[],
  statusByStudentId: ReadonlyMap<string, DailyDemeritStatus>,
  category: string,
  amount: string,
): DemeritStagePreview | null {
  if (studentIds.length === 0) return null;

  return studentIds.reduce<DemeritStagePreview>(
    (preview, studentId) => {
      const status = statusByStudentId.get(studentId) ?? defaultDemeritStatus(studentId);
      const nextStage = nextStageForStatus(status, category, amount);

      return {
        affectedCount: preview.affectedCount + 1,
        escalates: preview.escalates || nextStage > status.stage,
        nextStage: Math.max(preview.nextStage, nextStage) as DemeritPolicyStage,
        noteRequired: preview.noteRequired || nextStage >= 3,
        previousStage: Math.max(preview.previousStage, status.stage) as DemeritPolicyStage,
      };
    },
    {
      affectedCount: 0,
      escalates: false,
      nextStage: 0,
      noteRequired: false,
      previousStage: 0,
    },
  );
}

export function previewBatchDemeritStage(
  studentIds: readonly string[],
  statusByStudentId: ReadonlyMap<string, DailyDemeritStatus>,
  entries: readonly DemeritBatchPreviewEntry[],
): DemeritStagePreview | null {
  if (studentIds.length === 0 || entries.length === 0) return null;

  return studentIds.reduce<DemeritStagePreview>(
    (preview, studentId) => {
      const status = statusByStudentId.get(studentId) ?? defaultDemeritStatus(studentId);
      let currentStage = status.stage;
      let currentUnits = status.demeritUnits;

      for (const entry of entries) {
        const count = Number(entry.count) || 0;
        for (let index = 0; index < count; index += 1) {
          currentUnits += proposedDemeritUnits(entry.category, entry.amount);
          currentStage = Math.max(
            currentStage,
            demeritPolicyStageForUnits(currentUnits),
          ) as DemeritPolicyStage;
        }
      }

      return {
        affectedCount: preview.affectedCount + 1,
        escalates: preview.escalates || currentStage > status.stage,
        nextStage: Math.max(preview.nextStage, currentStage) as DemeritPolicyStage,
        noteRequired: preview.noteRequired || currentStage >= 3,
        previousStage: Math.max(preview.previousStage, status.stage) as DemeritPolicyStage,
      };
    },
    {
      affectedCount: 0,
      escalates: false,
      nextStage: 0,
      noteRequired: false,
      previousStage: 0,
    },
  );
}

export function DemeritStagePreviewPanel({ preview }: { preview: DemeritStagePreview | null }) {
  if (!preview) return null;

  return (
    <div
      className={
        preview.escalates ? 'behaviour-stage-preview is-escalation' : 'behaviour-stage-preview'
      }
    >
      <span>{String(preview.affectedCount)} selected</span>
      <strong>
        {demeritPolicyStageLabel(preview.previousStage)} →{' '}
        {demeritPolicyStageLabel(preview.nextStage)}
      </strong>
      {preview.escalates ? <em>Stage change</em> : null}
      {preview.noteRequired ? <small>Note required from Stage 3.</small> : null}
    </div>
  );
}

export const HONESTY_CATEGORY = 'Honesty';
export const SERIOUS_MISCONDUCT_CATEGORY = 'Serious Misconduct';

export type DemeritPolicyStage = 0 | 1 | 2 | 3 | 4 | 5;
export type DemeritPolicyBadgeTone = 'amber' | 'blue' | 'green' | 'red';

export interface DemeritPolicyEntry {
  category: string;
  meritDelta: number;
  type: 'Demerit' | 'General' | 'Merit';
}

export interface DemeritPolicyDatedEntry extends DemeritPolicyEntry {
  createdAt: Date;
  id: string;
  studentId: string;
}

export interface DemeritPolicyStatus {
  badgeTone: DemeritPolicyBadgeTone;
  demeritUnits: number;
  manualStage: DemeritPolicyStage | null;
  requiresHeadReview: boolean;
  stage: DemeritPolicyStage;
  stageLabel: string;
}

export interface DemeritPolicyTransition {
  escalated: boolean;
  nextStatus: DemeritPolicyStatus;
  noteRequired: boolean;
  previousStatus: DemeritPolicyStatus;
}

const STAGE_LABELS = {
  0: 'No demerits',
  1: 'Stage 1 - Reminder',
  2: 'Stage 2 - Reflection',
  3: 'Stage 3 - Privileges',
  4: 'Stage 4 - Parent Contact',
  5: 'Stage 5 - Review',
} as const satisfies Record<DemeritPolicyStage, string>;

export function isSeriousMisconductCategory(category: string): boolean {
  return category.trim().toLowerCase() === SERIOUS_MISCONDUCT_CATEGORY.toLowerCase();
}

export function isHonestyCategory(category: string): boolean {
  return category.trim().toLowerCase() === HONESTY_CATEGORY.toLowerCase();
}

export function demeritMeritDeltaForCategory(category: string): -2 | -1 {
  return isHonestyCategory(category) ? -2 : -1;
}

export function demeritPolicyUnitsFromDelta(meritDelta: number): number {
  if (!Number.isFinite(meritDelta) || meritDelta >= 0) return 0;
  return Math.floor(Math.abs(meritDelta));
}

export function demeritPolicyUnitsForEntry(entry: DemeritPolicyEntry): number {
  if (entry.type !== 'Demerit') return 0;
  return demeritPolicyUnitsFromDelta(entry.meritDelta);
}

export function demeritPolicyStageForUnits(demeritUnits: number): DemeritPolicyStage {
  const units = Math.max(0, Math.floor(demeritUnits));
  if (units === 0) return 0;
  if (units <= 2) return 1;
  if (units <= 4) return 2;
  return 3;
}

export function demeritPolicyBadgeTone(stage: DemeritPolicyStage): DemeritPolicyBadgeTone {
  if (stage === 0) return 'green';
  if (stage === 1) return 'blue';
  if (stage <= 3) return 'amber';
  return 'red';
}

export function demeritPolicyStatusForEntries(
  entries: readonly DemeritPolicyEntry[],
  manualStage: DemeritPolicyStage | null = null,
): DemeritPolicyStatus {
  let demeritUnits = 0;
  let hasSeriousMisconduct = false;

  for (const entry of entries) {
    if (entry.type !== 'Demerit') continue;
    demeritUnits += demeritPolicyUnitsForEntry(entry);
    if (isSeriousMisconductCategory(entry.category)) {
      hasSeriousMisconduct = true;
    }
  }

  const countStage = demeritPolicyStageForUnits(demeritUnits);
  const stage = manualStage !== null && manualStage > countStage ? manualStage : countStage;
  return {
    badgeTone: demeritPolicyBadgeTone(stage),
    demeritUnits,
    manualStage,
    requiresHeadReview: demeritUnits > 6 || hasSeriousMisconduct,
    stage,
    stageLabel: STAGE_LABELS[stage],
  };
}

export function demeritPolicyStageLabel(stage: DemeritPolicyStage): string {
  return STAGE_LABELS[stage];
}

export function demeritPolicyTransitionForEntries(
  currentEntries: readonly DemeritPolicyEntry[],
  proposedEntries: readonly DemeritPolicyEntry[],
): DemeritPolicyTransition {
  const previousStatus = demeritPolicyStatusForEntries(currentEntries);
  const nextStatus = demeritPolicyStatusForEntries([...currentEntries, ...proposedEntries]);

  return {
    escalated: nextStatus.stage > previousStatus.stage,
    nextStatus,
    noteRequired:
      proposedEntries.some((entry) => entry.type === 'Demerit') &&
      (nextStatus.stage >= 3 || nextStatus.requiresHeadReview),
    previousStatus,
  };
}

export function demeritPolicyEscalationEntryIds(
  entries: readonly DemeritPolicyDatedEntry[],
): Set<string> {
  const selectedIds = new Set<string>();
  const groups = new Map<string, DemeritPolicyDatedEntry[]>();

  for (const entry of entries) {
    if (entry.type !== 'Demerit') continue;
    const day = entry.createdAt.toISOString().slice(0, 10);
    const key = `${entry.studentId}:${day}`;
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }

  for (const rows of groups.values()) {
    const sortedRows = [...rows].sort((left, right) => {
      const dateDelta = left.createdAt.getTime() - right.createdAt.getTime();
      return dateDelta === 0 ? left.id.localeCompare(right.id) : dateDelta;
    });

    let previousUnits = 0;
    for (const row of sortedRows) {
      const seriousMisconduct = isSeriousMisconductCategory(row.category);
      const nextUnits = previousUnits + demeritPolicyUnitsForEntry(row);

      if (seriousMisconduct || (previousUnits <= 6 && nextUnits > 6)) {
        selectedIds.add(row.id);
      }

      previousUnits = nextUnits;
    }
  }

  return selectedIds;
}

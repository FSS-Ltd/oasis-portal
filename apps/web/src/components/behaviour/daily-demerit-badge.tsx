'use client';

import { useMemo } from 'react';
import type { RouterOutputs } from '@/lib/trpc';
import { api } from '@/lib/trpc';

export type DailyDemeritStatus =
  RouterOutputs['behaviour']['dailyDemeritStatuses']['statuses'][number];

export function useDailyDemeritStatusMap(date: Date, enabled = true, clubId?: string) {
  const query = api.behaviour.dailyDemeritStatuses.useQuery(
    { date, ...(clubId ? { clubId } : {}) },
    { enabled, retry: false },
  );
  const statusByStudentId = useMemo(
    () => new Map((query.data?.statuses ?? []).map((status) => [status.studentId, status])),
    [query.data?.statuses],
  );

  return { ...query, statusByStudentId };
}

export function DailyDemeritBadge({ status }: { status: DailyDemeritStatus | null | undefined }) {
  if (!status) return null;

  const label = `${String(status.demeritUnits)} daily demerit${
    status.demeritUnits === 1 ? '' : 's'
  } - ${status.stageLabel}${
    status.manualStage ? ' - manually escalated' : status.requiresHeadReview ? ' - Head review' : ''
  }`;

  return (
    <span aria-label={label} className={`daily-demerit-badge is-${status.badgeTone}`} title={label}>
      <span>D</span>
      <strong>{String(status.demeritUnits)}</strong>
    </span>
  );
}

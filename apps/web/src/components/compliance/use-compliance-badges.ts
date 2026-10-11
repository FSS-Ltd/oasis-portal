'use client';

import { useMemo } from 'react';
import type { AdultComplianceBadgeSummary } from '@oasis/domain';
import { api } from '@/lib/trpc';

export function useComplianceBadges(
  userIds: readonly string[],
): ReadonlyMap<string, AdultComplianceBadgeSummary> {
  const ids = useMemo(() => [...new Set(userIds)].sort(), [userIds]);
  const result = api.compliance.badgeSummaries.useQuery(
    { userIds: ids },
    { enabled: ids.length > 0, retry: false },
  );
  return useMemo(
    () => new Map(result.data?.map((row) => [row.userId, row.badges]) ?? []),
    [result.data],
  );
}

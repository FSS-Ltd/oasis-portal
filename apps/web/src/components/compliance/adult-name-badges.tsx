'use client';

import { api } from '@/lib/trpc';
import { ComplianceBadges } from './compliance-badges';

export function AdultNameBadges({ userId }: { userId: string | null | undefined }) {
  const summaries = api.compliance.allBadgeSummaries.useQuery(undefined, {
    enabled: Boolean(userId),
    retry: false,
    staleTime: 60_000,
  });
  const summary = summaries.data?.find((row) => row.userId === userId)?.badges ?? null;
  return <ComplianceBadges summary={summary} />;
}

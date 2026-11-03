const HEALTH_AND_REPAIR_PATHS = new Set([
  'health.ping',
  'health.db',
  'health.me',
  'audit.list',
  'student.update',
  'compliance.update',
]);

/** Uses tRPC's parsed paths; one cohort read makes the entire batch require catch-up. */
export function canSkipSchoolYearSync(calls: readonly { path: string }[]): boolean {
  return calls.length > 0 && calls.every((call) => HEALTH_AND_REPAIR_PATHS.has(call.path));
}

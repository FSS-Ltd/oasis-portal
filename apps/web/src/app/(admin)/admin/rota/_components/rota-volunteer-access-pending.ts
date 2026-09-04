export type PendingVolunteerRows = ReadonlyMap<string, number>;

export function updatePendingVolunteerRow(
  pendingRows: PendingVolunteerRows,
  userId: string,
  delta: 1 | -1,
): Map<string, number> {
  const next = new Map(pendingRows);
  const pendingCount = (next.get(userId) ?? 0) + delta;

  if (pendingCount > 0) {
    next.set(userId, pendingCount);
  } else {
    next.delete(userId);
  }

  return next;
}

export function isPendingVolunteerRow(pendingRows: PendingVolunteerRows, userId: string): boolean {
  return (pendingRows.get(userId) ?? 0) > 0;
}

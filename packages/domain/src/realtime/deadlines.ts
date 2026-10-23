export type KnownDeadline = Date | string | null | undefined;

export function nextKnownDeadline(
  deadlines: readonly KnownDeadline[],
  now = Date.now(),
): number | null {
  const next = Math.min(
    ...deadlines
      .map((deadline) => (deadline ? new Date(deadline).getTime() : Infinity))
      .filter((deadline) => deadline > now),
  );
  return Number.isFinite(next) ? next : null;
}

/** Schedule a known boundary, including deadlines beyond the JS timer limit. */
export function scheduleKnownDeadline(deadline: number | null, callback: () => void): () => void {
  if (deadline === null) return () => {};
  const target = deadline;
  let disposed = false;
  let timer: ReturnType<typeof setTimeout>;
  function schedule(): void {
    timer = setTimeout(
      () => {
        if (disposed) return;
        if (Date.now() < target) schedule();
        else callback();
      },
      Math.min(Math.max(1, target - Date.now() + 1), 2_147_483_647),
    );
  }
  schedule();
  return () => {
    disposed = true;
    clearTimeout(timer);
  };
}

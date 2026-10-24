import { afterEach, describe, expect, it, vi } from 'vitest';
import { nextKnownDeadline, scheduleKnownDeadline } from '../realtime/deadlines.js';

afterEach(() => vi.useRealTimers());

describe('known realtime deadlines', () => {
  it('ignores past and invalid dates and selects the earliest future boundary', () => {
    expect(
      nextKnownDeadline([null, 'invalid', new Date(500), new Date(5_000), new Date(2_000)], 1_000),
    ).toBe(2_000);
    expect(nextKnownDeadline([], 1_000)).toBeNull();
  });

  it('never invokes an idle callback and cancels a scheduled deadline on cleanup', async () => {
    vi.useFakeTimers();
    const read = vi.fn();
    scheduleKnownDeadline(null, read);
    const stop = scheduleKnownDeadline(Date.now() + 1_000, read);
    stop();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(read).not.toHaveBeenCalled();
  });

  it('fires once at the real deadline even beyond the JavaScript timer limit', async () => {
    vi.useFakeTimers();
    const read = vi.fn();
    scheduleKnownDeadline(Date.now() + 3_000_000_000, read);
    await vi.advanceTimersByTimeAsync(2_147_483_647);
    expect(read).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(3_000_000_001 - 2_147_483_647);
    expect(read).toHaveBeenCalledTimes(1);
  });
});

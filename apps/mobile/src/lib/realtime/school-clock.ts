import { createContext, useContext } from 'react';

export const SchoolClockContext = createContext<number | null>(null);

/** Consumers rerender at the school day's boundary without replacing their local form state. */
export function useSchoolNow(): Date {
  const timestamp = useContext(SchoolClockContext);
  return timestamp === null ? new Date() : new Date(timestamp);
}

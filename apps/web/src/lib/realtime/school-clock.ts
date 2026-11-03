'use client';

import { createContext, useContext } from 'react';

export const SchoolClockContext = createContext<number | null>(null);

/** Reuses the school-day clock so DOB-derived forms advance without losing drafts. */
export function useSchoolNow(): Date {
  const timestamp = useContext(SchoolClockContext);
  return timestamp === null ? new Date() : new Date(timestamp);
}

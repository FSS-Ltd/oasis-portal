import type { RealtimeArea } from '@oasis/domain';

// These dependencies also cover data read directly by server components. Keep route
// coverage tested so a new authenticated route cannot silently miss live updates.
export const REALTIME_ROUTE_AREAS = {
  attendance: ['attendance', 'student', 'admin', 'rota'],
  'sensitive-review': ['behaviour', 'childNotes', 'incident'],
  snapshot: ['childLog', 'childNotes', 'attendance', 'behaviour', 'pace', 'student'],
  tasks: ['personalTask'],
  messages: ['message'],
  clubs: ['club', 'student', 'permissionSlip'],
  'my-clubs': ['club', 'student', 'permissionSlip'],
  calendar: ['calendar', 'club', 'timetable'],
  access: ['admin', 'registration'],
  invoices: ['invoice', 'student'],
  fees: ['invoice', 'student'],
  timetables: ['timetable', 'student', 'admin'],
  timetable: ['timetable', 'student', 'admin'],
  'faith-corner': ['faithCorner'],
  faith: ['faithCorner'],
  shop: ['shop', 'meritLedger', 'studentSettings'],
  'permission-slips': ['permissionSlip', 'club', 'student'],
  pace: ['pace', 'academicInventory', 'student', 'studentSettings'],
  library: ['library', 'student'],
  leaderboard: ['leaderboard', 'meritLedger', 'behaviour'],
  ranks: ['leaderboard', 'meritLedger', 'behaviour'],
  compliance: ['compliance', 'userAgreement', 'incident', 'admin'],
  academic: ['admin', 'student', 'pace', 'academicInventory'],
  students: ['student', 'registration', 'studentSettings', 'pace', 'attendance', 'behaviour'],
  children: [
    'student',
    'childLog',
    'childNotes',
    'studentSettings',
    'attendance',
    'behaviour',
    'pace',
  ],
  noticeboard: ['notice'],
  audit: ['audit'],
  profile: ['profile'],
  rota: ['rota', 'admin', 'attendance'],
  homework: ['homework', 'student'],
  'student-portal': ['studentSettings', 'student'],
  staff: ['admin', 'rota', 'compliance'],
  behaviour: ['behaviour', 'meritLedger', 'student'],
  community: ['community', 'studentSettings'],
  'student-notifications': ['studentNotification', 'student'],
  notifications: ['studentNotification'],
  incidents: ['incident', 'student'],
  reports: ['report', 'pace', 'student', 'attendance', 'behaviour'],
  settings: ['studentSettings', 'student'],
  registration: ['registration', 'student'],
  volunteer: ['rota', 'profile', 'health'],
  'notes-history': ['childLog', 'childNotes'],
  wallet: ['meritLedger', 'investment', 'tithe', 'shop'],
  invest: ['investment', 'meritLedger'],
} as const satisfies Record<string, readonly RealtimeArea[]>;

const dashboards = {
  admin: ['attendance', 'behaviour', 'meritLedger', 'student', 'staffHome', 'userAgreement'],
  parent: [
    'student',
    'attendance',
    'behaviour',
    'pace',
    'invoice',
    'notice',
    'userAgreement',
    'studentSettings',
  ],
  supervisor: [
    'staffHome',
    'student',
    'attendance',
    'behaviour',
    'pace',
    'rota',
    'notice',
    'userAgreement',
  ],
  student: [
    'student',
    'meritLedger',
    'pace',
    'homework',
    'studentNotification',
    'studentSettings',
    'timetable',
    'faithCorner',
  ],
  'clubs-lead': ['club', 'student', 'permissionSlip'],
} as const satisfies Record<string, readonly RealtimeArea[]>;

const standalone = {
  compliance: REALTIME_ROUTE_AREAS.compliance,
  'user-agreements': ['userAgreement'],
  'parent-link-requests': ['registration', 'profile', 'student'],
  'children-check': ['student', 'profile', 'registration'],
  registration: REALTIME_ROUTE_AREAS.registration,
  'post-sign-in': ['health', 'profile', 'registration'],
} as const satisfies Record<string, readonly RealtimeArea[]>;

function ownsKey<T extends object>(record: T, key: string): key is Extract<keyof T, string> {
  return Object.hasOwn(record, key);
}

export function routeRealtimeAreas(pathname: string): readonly RealtimeArea[] {
  const segments = pathname.split('/').filter(Boolean);
  const portal = segments[0] ?? '';
  if (ownsKey(standalone, portal)) return ['health', ...standalone[portal]];
  if (!ownsKey(dashboards, portal)) return [];
  const section = segments[1];
  if (!section) return ['health', 'profile', ...dashboards[portal]];
  if (!ownsKey(REALTIME_ROUTE_AREAS, section)) return [];
  return ['health', 'profile', ...REALTIME_ROUTE_AREAS[section]];
}

export function routeDependsOnAreas(pathname: string, areas: readonly RealtimeArea[]): boolean {
  return routeRealtimeAreas(pathname).some((area) => areas.includes(area));
}

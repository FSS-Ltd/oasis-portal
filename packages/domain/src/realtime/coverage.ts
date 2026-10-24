import type { RealtimeArea } from './events.js';

/** Command-only routers have no persisted read model to invalidate. */
export const REALTIME_AREA_EXCLUSIONS = {
  email: 'Command-only email delivery; visible agreement delivery status belongs to userAgreement.',
} as const satisfies Partial<Record<RealtimeArea, string>>;

export type RealtimeAudience =
  | 'agreement'
  | 'audit'
  | 'behaviour'
  | 'calendar'
  | 'club'
  | 'community'
  | 'compliance'
  | 'excluded'
  | 'faith'
  | 'finance'
  | 'homework'
  | 'identity'
  | 'incident'
  | 'library'
  | 'market'
  | 'message'
  | 'notes'
  | 'own'
  | 'pace'
  | 'permission'
  | 'registration'
  | 'safeguarding'
  | 'staff'
  | 'student'
  | 'timetable'
  | 'usage';

export interface RealtimeModelCoverage {
  readonly areas: readonly RealtimeArea[];
  readonly audience: RealtimeAudience;
  readonly clock?: string;
  readonly exclusion?: string;
}

/** Explicit database-to-query dependencies. Operational-only writes never wake clients. */
export const REALTIME_MODEL_COVERAGE = {
  User: {
    areas: [
      'admin',
      'profile',
      'student',
      'registration',
      'staffHome',
      'health',
      'attendance',
      'behaviour',
      'club',
      'calendar',
      'notice',
      'message',
      'report',
      'rota',
      'invoice',
      'incident',
      'studentSettings',
      'personalTask',
      'compliance',
      'userAgreement',
    ],
    audience: 'identity',
  },
  Guardian: {
    areas: [
      'admin',
      'profile',
      'student',
      'registration',
      'staffHome',
      'health',
      'behaviour',
      'childLog',
      'pace',
      'meritLedger',
      'investment',
      'shop',
      'leaderboard',
      'club',
      'calendar',
      'notice',
      'message',
      'report',
      'invoice',
      'permissionSlip',
      'incident',
    ],
    audience: 'identity',
  },
  AdultCompliance: { areas: ['compliance', 'staffHome'], audience: 'compliance' },
  PersonalTask: { areas: ['personalTask', 'staffHome'], audience: 'own' },
  UserInvitation: {
    areas: ['registration', 'admin', 'student', 'profile'],
    audience: 'registration',
  },
  StudentRegistrationCode: {
    areas: ['registration', 'admin', 'student'],
    audience: 'registration',
  },
  StudentSelfRegistration: {
    areas: ['registration', 'admin', 'student'],
    audience: 'registration',
  },
  StudentParentLinkRequest: {
    areas: ['registration', 'admin', 'student'],
    audience: 'registration',
  },
  ParentRegistration: { areas: ['registration', 'admin', 'student'], audience: 'registration' },
  RegistrationGuardianContact: {
    areas: ['registration', 'admin', 'student'],
    audience: 'registration',
  },
  RegistrationEmergencyContact: {
    areas: ['registration', 'admin', 'student'],
    audience: 'registration',
  },
  RegistrationPickupContact: {
    areas: ['registration', 'admin', 'student'],
    audience: 'registration',
  },
  StudentRegistrationProfile: {
    areas: ['registration', 'admin', 'student', 'compliance'],
    audience: 'registration',
  },
  StudentRegistrationConsent: {
    areas: ['registration', 'admin', 'student'],
    audience: 'registration',
  },
  Student: {
    areas: [
      'student',
      'profile',
      'staffHome',
      'timetable',
      'club',
      'report',
      'admin',
      'attendance',
      'behaviour',
      'childLog',
      'childNotes',
      'pace',
      'meritLedger',
      'tithe',
      'investment',
      'shop',
      'leaderboard',
      'calendar',
      'message',
      'community',
      'invoice',
      'permissionSlip',
      'incident',
      'studentSettings',
      'faithCorner',
      'studentNotification',
      'homework',
      'academicInventory',
      'personalTask',
      'library',
      'health',
    ],
    audience: 'student',
  },
  LibraryBook: { areas: ['library', 'staffHome'], audience: 'library' },
  LibraryLoan: { areas: ['library', 'staffHome'], audience: 'library' },
  LibraryEmailReminder: {
    areas: [],
    audience: 'excluded',
    exclusion: 'Delivery bookkeeping; library state is notified by LibraryLoan.',
  },
  StudentPortalUsageMinute: {
    areas: [
      'studentSettings',
      'student',
      'attendance',
      'pace',
      'meritLedger',
      'investment',
      'shop',
      'leaderboard',
      'club',
      'faithCorner',
      'studentNotification',
      'homework',
    ],
    audience: 'usage',
    exclusion:
      'Existing-minute heartbeats update lastSeenAt only; notify minute-count inserts/deletes to guardians/admin, never student heartbeat gates.',
    clock: 'One-shot next Europe/London midnight plus foreground catch-up.',
  },
  UserAgreementDelivery: {
    areas: ['userAgreement', 'compliance'],
    audience: 'agreement',
    exclusion:
      'Lease-only claimUntil changes do not notify; status, attempts, and sentAt notify. Recovery every 15 minutes, at most 100 rows.',
  },
  AuditLog: {
    areas: ['audit'],
    audience: 'audit',
    exclusion:
      'Ignore read/decryption telemetry; only inspectionAuditWhere actions and entities notify audit readers.',
  },
  StudentPortalSettings: {
    areas: [
      'studentSettings',
      'profile',
      'student',
      'attendance',
      'pace',
      'meritLedger',
      'investment',
      'shop',
      'leaderboard',
      'club',
      'faithCorner',
      'studentNotification',
      'homework',
    ],
    audience: 'student',
    clock:
      'One-shot next due boundary (Europe/London day, expiry, or scheduled start/end); refresh on foreground.',
  },
  StudentNotification: {
    areas: ['studentNotification', 'staffHome', 'student', 'behaviour', 'shop', 'club', 'homework'],
    audience: 'student',
  },
  HomeworkAssignment: { areas: ['homework', 'staffHome'], audience: 'homework' },
  HomeworkAssignmentBand: { areas: ['homework', 'staffHome'], audience: 'homework' },
  HomeworkSubmission: { areas: ['homework', 'staffHome'], audience: 'homework' },
  HomeworkSubmissionImage: { areas: ['homework', 'staffHome'], audience: 'homework' },
  HomeworkAssignmentImage: { areas: ['homework', 'staffHome'], audience: 'homework' },
  Subject: {
    areas: [
      'pace',
      'academicInventory',
      'report',
      'staffHome',
      'admin',
      'student',
      'timetable',
      'childLog',
      'leaderboard',
    ],
    audience: 'pace',
  },
  StudentSubject: {
    areas: [
      'pace',
      'academicInventory',
      'report',
      'staffHome',
      'student',
      'studentSettings',
      'childLog',
      'leaderboard',
    ],
    audience: 'pace',
  },
  PaceGapPlan: {
    areas: ['pace', 'academicInventory', 'report', 'staffHome', 'student'],
    audience: 'pace',
  },
  PaceGapPlanItem: {
    areas: ['pace', 'academicInventory', 'report', 'staffHome', 'student'],
    audience: 'pace',
  },
  PaceRecord: {
    areas: [
      'pace',
      'academicInventory',
      'report',
      'staffHome',
      'student',
      'childLog',
      'leaderboard',
    ],
    audience: 'pace',
  },
  PaceProgress: {
    areas: [
      'pace',
      'academicInventory',
      'report',
      'staffHome',
      'student',
      'childLog',
      'leaderboard',
    ],
    audience: 'pace',
  },
  PacePolicy: {
    areas: [
      'pace',
      'academicInventory',
      'report',
      'staffHome',
      'admin',
      'student',
      'childLog',
      'leaderboard',
    ],
    audience: 'pace',
  },
  PaceAdvancementApproval: {
    areas: [
      'pace',
      'academicInventory',
      'report',
      'staffHome',
      'student',
      'childLog',
      'leaderboard',
    ],
    audience: 'pace',
  },
  PaceInventoryOrder: {
    areas: ['pace', 'academicInventory', 'report', 'staffHome'],
    audience: 'pace',
  },
  StudentPaceSupply: {
    areas: ['pace', 'academicInventory', 'report', 'staffHome'],
    audience: 'pace',
  },
  DiagnosticResult: {
    areas: [
      'pace',
      'academicInventory',
      'report',
      'staffHome',
      'student',
      'childLog',
      'leaderboard',
    ],
    audience: 'pace',
  },
  TimetableAgeGroupSchedule: {
    areas: ['timetable', 'student', 'rota', 'staffHome'],
    audience: 'timetable',
  },
  TimetableScheduleSlot: {
    areas: ['timetable', 'student', 'rota', 'staffHome'],
    audience: 'timetable',
  },
  StudentTimetable: { areas: ['timetable', 'student', 'rota', 'staffHome'], audience: 'timetable' },
  StudentTimetableEntry: {
    areas: ['timetable', 'student', 'rota', 'staffHome'],
    audience: 'timetable',
  },
  StudentTimetablePublication: {
    areas: ['timetable', 'student', 'rota', 'staffHome', 'personalTask'],
    audience: 'timetable',
  },
  StudentTimetablePublicationEntry: {
    areas: ['timetable', 'student', 'rota', 'staffHome'],
    audience: 'timetable',
  },
  YearGroupBand: {
    areas: [
      'timetable',
      'student',
      'rota',
      'staffHome',
      'admin',
      'attendance',
      'behaviour',
      'childLog',
      'childNotes',
      'pace',
      'club',
      'calendar',
      'homework',
    ],
    audience: 'timetable',
  },
  Attendance: {
    areas: ['attendance', 'childLog', 'staffHome', 'report', 'student', 'studentSettings'],
    audience: 'student',
    clock:
      'One-shot next due boundary (Europe/London day, expiry, or scheduled start/end); refresh on foreground.',
  },
  SpecialAttendanceSession: {
    areas: ['attendance', 'childLog', 'staffHome', 'report'],
    audience: 'student',
  },
  SpecialAttendanceRecord: {
    areas: ['attendance', 'childLog', 'staffHome', 'report'],
    audience: 'student',
  },
  StaffAttendance: { areas: ['attendance', 'rota', 'staffHome'], audience: 'staff' },
  StaffAvailabilityWindow: { areas: ['attendance', 'rota', 'staffHome'], audience: 'staff' },
  StaffMonthlyAvailabilityWindow: { areas: ['attendance', 'rota', 'staffHome'], audience: 'staff' },
  ParentVolunteerDay: { areas: ['attendance', 'rota', 'staffHome'], audience: 'staff' },
  StaffLunchAndClubsVolunteerDay: { areas: ['attendance', 'rota', 'staffHome'], audience: 'staff' },
  StaffShift: {
    areas: [
      'attendance',
      'rota',
      'staffHome',
      'student',
      'behaviour',
      'childLog',
      'childNotes',
      'pace',
      'club',
      'calendar',
    ],
    audience: 'staff',
    clock:
      'One-shot next due boundary (Europe/London day, expiry, or scheduled start/end); refresh on foreground.',
  },
  ShiftSwapRequest: { areas: ['attendance', 'rota', 'staffHome'], audience: 'staff' },
  BehaviourEntry: {
    areas: [
      'behaviour',
      'childLog',
      'childNotes',
      'meritLedger',
      'leaderboard',
      'report',
      'staffHome',
      'pace',
      'tithe',
    ],
    audience: 'behaviour',
  },
  DemeritStageOverride: {
    areas: [
      'behaviour',
      'childLog',
      'childNotes',
      'meritLedger',
      'leaderboard',
      'report',
      'staffHome',
    ],
    audience: 'behaviour',
  },
  ChildNote: { areas: ['childNotes', 'childLog', 'staffHome', 'report'], audience: 'notes' },
  MeritLedger: {
    areas: [
      'meritLedger',
      'investment',
      'shop',
      'leaderboard',
      'staffHome',
      'student',
      'childLog',
      'tithe',
      'report',
      'studentSettings',
    ],
    audience: 'student',
  },
  TitheConfig: { areas: ['tithe', 'meritLedger', 'investment'], audience: 'student' },
  TitheRun: { areas: ['tithe', 'meritLedger', 'investment'], audience: 'student' },
  SavingsInterestRun: { areas: ['tithe', 'meritLedger', 'investment'], audience: 'student' },
  InvestmentAccount: { areas: ['investment', 'meritLedger', 'staffHome'], audience: 'student' },
  InvestmentHolding: {
    areas: ['investment', 'meritLedger', 'staffHome', 'leaderboard'],
    audience: 'student',
  },
  InvestmentTransaction: {
    areas: ['investment', 'meritLedger', 'staffHome', 'leaderboard'],
    audience: 'student',
  },
  InvestmentDividendPayment: {
    areas: ['investment', 'meritLedger', 'staffHome'],
    audience: 'student',
  },
  InvestmentNav: { areas: ['investment', 'staffHome'], audience: 'market' },
  InvestmentInstrument: { areas: ['investment', 'staffHome'], audience: 'market' },
  MarketDataSnapshot: { areas: ['investment', 'staffHome'], audience: 'market' },
  InvestmentNewsItem: {
    areas: ['investment', 'staffHome'],
    audience: 'market',
    clock:
      'One-shot next due boundary (Europe/London day, expiry, or scheduled start/end); refresh on foreground.',
  },
  InvestmentDividendEvent: { areas: ['investment', 'staffHome'], audience: 'market' },
  CharityPot: { areas: ['tithe', 'meritLedger', 'staffHome', 'leaderboard'], audience: 'market' },
  ShopItem: { areas: ['shop', 'staffHome', 'student'], audience: 'market' },
  ShopPurchase: { areas: ['shop', 'meritLedger', 'staffHome'], audience: 'student' },
  ShopReservation: { areas: ['shop', 'meritLedger', 'staffHome'], audience: 'student' },
  ShopReservationLine: { areas: ['shop', 'meritLedger', 'staffHome'], audience: 'student' },
  LeaderboardSnapshot: {
    areas: ['leaderboard', 'staffHome'],
    audience: 'market',
    clock:
      'One-shot next due boundary (Europe/London day, expiry, or scheduled start/end); refresh on foreground.',
  },
  Club: { areas: ['club', 'rota', 'attendance', 'staffHome'], audience: 'club' },
  ClubYearGroupBand: { areas: ['club', 'rota', 'attendance', 'staffHome'], audience: 'club' },
  ClubSignup: {
    areas: ['club', 'rota', 'attendance', 'staffHome', 'student', 'behaviour', 'studentSettings'],
    audience: 'club',
  },
  ClubNotification: { areas: ['club', 'rota', 'attendance', 'staffHome'], audience: 'club' },
  ClubAttendance: { areas: ['club', 'rota', 'attendance', 'staffHome'], audience: 'club' },
  ClubLeadAssignment: { areas: ['club', 'rota', 'attendance', 'staffHome'], audience: 'club' },
  ClubRotaParticipant: { areas: ['club', 'rota', 'attendance', 'staffHome'], audience: 'club' },
  ClubRotaShift: {
    areas: ['club', 'rota', 'attendance', 'staffHome'],
    audience: 'club',
    clock:
      'One-shot next due boundary (Europe/London day, expiry, or scheduled start/end); refresh on foreground.',
  },
  ClubAvailabilityWindow: { areas: ['club', 'rota', 'attendance', 'staffHome'], audience: 'club' },
  FaithCornerContent: { areas: ['faithCorner', 'staffHome', 'student'], audience: 'faith' },
  FaithCornerContentLike: { areas: ['faithCorner', 'staffHome', 'student'], audience: 'faith' },
  FaithCornerComment: { areas: ['faithCorner', 'staffHome', 'student'], audience: 'faith' },
  FaithCornerCommentLike: { areas: ['faithCorner', 'staffHome'], audience: 'faith' },
  StaffNotice: {
    areas: ['notice', 'staffHome'],
    audience: 'staff',
    clock:
      'One-shot next due boundary (Europe/London day, expiry, or scheduled start/end); refresh on foreground.',
  },
  StaffNoticeAttachment: { areas: ['notice', 'staffHome'], audience: 'staff' },
  StaffNoticeRead: { areas: ['notice', 'staffHome'], audience: 'staff' },
  CalendarEvent: {
    areas: ['calendar', 'staffHome', 'childLog', 'rota', 'personalTask', 'timetable'],
    audience: 'calendar',
    clock:
      'One-shot next due boundary (Europe/London day, expiry, or scheduled start/end); refresh on foreground.',
  },
  CalendarEventRequiredPerson: { areas: ['calendar', 'staffHome'], audience: 'calendar' },
  UserAgreement: { areas: ['userAgreement', 'compliance', 'staffHome'], audience: 'agreement' },
  UserAgreementVersion: {
    areas: ['userAgreement', 'compliance', 'staffHome'],
    audience: 'agreement',
  },
  UserAgreementRequest: {
    areas: ['userAgreement', 'compliance', 'staffHome'],
    audience: 'agreement',
  },
  UserAgreementSignature: {
    areas: ['userAgreement', 'compliance', 'staffHome'],
    audience: 'agreement',
  },
  PermissionSlip: { areas: ['permissionSlip', 'calendar', 'staffHome'], audience: 'permission' },
  PermissionSlipRecipient: {
    areas: ['permissionSlip', 'calendar', 'staffHome'],
    audience: 'permission',
  },
  PermissionSlipBringItem: {
    areas: ['permissionSlip', 'calendar', 'staffHome'],
    audience: 'permission',
  },
  PermissionSlipQuestion: {
    areas: ['permissionSlip', 'calendar', 'staffHome'],
    audience: 'permission',
  },
  PermissionSlipAnswer: {
    areas: ['permissionSlip', 'calendar', 'staffHome'],
    audience: 'permission',
  },
  IncidentReport: { areas: ['incident', 'compliance', 'staffHome'], audience: 'incident' },
  IncidentReportStudent: { areas: ['incident', 'compliance', 'staffHome'], audience: 'incident' },
  IncidentReportStaff: { areas: ['incident', 'compliance', 'staffHome'], audience: 'incident' },
  IncidentReportAttachment: {
    areas: ['incident', 'compliance', 'staffHome'],
    audience: 'incident',
  },
  IncidentReportParentCopy: {
    areas: ['incident', 'compliance', 'staffHome'],
    audience: 'incident',
  },
  IncidentReportParentRecipient: {
    areas: ['incident', 'compliance', 'staffHome'],
    audience: 'incident',
  },
  IncidentReportEvent: { areas: ['incident', 'compliance', 'staffHome'], audience: 'incident' },
  IncidentSafeguardingNote: { areas: ['incident', 'compliance'], audience: 'safeguarding' },
  MessageThread: { areas: ['message', 'staffHome'], audience: 'message' },
  MessageThreadParticipant: { areas: ['message', 'staffHome'], audience: 'message' },
  Message: { areas: ['message', 'staffHome'], audience: 'message' },
  MessageRead: { areas: ['message', 'staffHome'], audience: 'message' },
  CommunityGroup: { areas: ['community', 'staffHome'], audience: 'community' },
  CommunityGroupMember: { areas: ['community', 'staffHome'], audience: 'community' },
  CommunityMessage: { areas: ['community', 'staffHome'], audience: 'community' },
  CommunityMessageRead: { areas: ['community', 'staffHome'], audience: 'community' },
  TermReport: { areas: ['report', 'staffHome'], audience: 'student' },
  SchoolFeeYearFeeConfig: { areas: ['invoice', 'staffHome'], audience: 'finance' },
  SchoolFeeInvoice: { areas: ['invoice', 'staffHome'], audience: 'finance' },
  SchoolFeeInvoiceLineItem: { areas: ['invoice', 'staffHome'], audience: 'finance' },
  SchoolFeeInvoiceStudent: { areas: ['invoice', 'staffHome'], audience: 'finance' },
  SchoolFeeInvoiceDiscount: { areas: ['invoice', 'staffHome'], audience: 'finance' },
} as const satisfies Record<string, RealtimeModelCoverage>;

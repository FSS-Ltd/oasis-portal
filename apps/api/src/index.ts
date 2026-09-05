export { appRouter, type AppRouter } from './router.js';
export {
  applyRlsTx,
  createContext,
  type AppContext,
  type CreateContextArgs,
  type RlsTx,
} from './context.js';
export {
  router,
  publicProcedure,
  authedProcedure,
  adminOperationsProcedure,
  fullAdminProcedure,
  userAccountAdminProcedure,
  roleProcedure,
  auditedProcedure,
} from './trpc.js';
export { adminRouter, createAdminRouter, type AdminRouterDeps } from './routers/admin.js';
export { profileRouter } from './routers/profile.js';
export {
  createDefaultClerkInvitationClient,
  resolveClerkSessionFromBearerToken,
  resolveClerkUserIdFromBearerToken,
  type ClerkSessionAuthResult,
  type ClerkInvitationClient,
  type ClerkInvitationCreateInput,
  type ClerkInvitationResult,
  type ResolveClerkBearerTokenDeps,
} from './lib/clerk.js';
export {
  BEHAVIOUR_NOTIFICATION_EMAIL_SUBJECT,
  DEFAULT_RESEND_FROM,
  HELLO_WORLD_EMAIL_SUBJECT,
  HELLO_WORLD_EMAIL_TO,
  EMAIL_LOGO_PATH,
  CLUB_NOTIFICATION_EMAIL_SUBJECT,
  INVOICE_PAST_DUE_REMINDER_EMAIL_SUBJECT_PREFIX,
  INVOICE_PAYMENT_NOTIFICATION_EMAIL_SUBJECT,
  MESSAGE_NOTIFICATION_EMAIL_SUBJECT,
  NOTICE_NOTIFICATION_EMAIL_SUBJECT,
  PRODUCTION_RESEND_FROM,
  SMOKE_TEST_EMAIL_SUBJECT,
  SMOKE_TEST_EMAIL_TEXT,
  SMOKE_TEST_EMAIL_TO,
  USER_INVITE_EMAIL_SUBJECT,
  buildBehaviourNotificationEmail,
  buildClubNotificationEmail,
  buildEmailLogoUrl,
  buildHelloWorldEmail,
  buildInvoicePastDueReminderEmail,
  buildInvoicePaymentNotificationEmail,
  buildMessageNotificationEmail,
  buildNoticeNotificationEmail,
  buildSmokeTestEmail,
  buildUserInviteEmail,
  createResendEmailClient,
  readEmailConfig,
  type EmailClient,
  type EmailConfig,
  type EmailEnv,
  type BehaviourNotificationEmailInput,
  type ClubNotificationEmailInput,
  type InvoicePastDueReminderEmailInput,
  type InvoicePaymentNotificationEmailInput,
  type MessageNotificationEmailInput,
  type NoticeNotificationEmailInput,
  type SendEmailInput,
  type SendEmailResult,
  type UserInviteEmailInput,
} from './lib/email.js';
export {
  buildOperationalLogEntry,
  logOperationalEvent,
  operationalErrorMessage,
  sanitizeOperationalMeta,
  type OperationalLogEntry,
  type OperationalLogInput,
  type OperationalLogLevel,
  type OperationalLogMeta,
  type OperationalLogMetaValue,
} from './lib/observability.js';
export {
  DEFAULT_TITHE_CADENCE,
  DEFAULT_TITHE_MODE,
  DEFAULT_TITHE_MONTHLY_DATE,
  DEFAULT_TITHE_PERCENTAGE,
  DEFAULT_TITHE_WEEKLY_DAY,
  loadManualTitheStatus,
  payManualTithe,
  type ManualTitheConfigDto,
  type ManualTithePaymentDto,
  type ManualTitheStatusDto,
} from './services/tithe-run.js';
export {
  previousSavingsInterestMonth,
  runMonthlySavingsInterest,
  type MonthlySavingsInterestSummary,
  type SavingsInterestRunResultDto,
} from './services/savings-interest.js';
export {
  readCachedInvestmentMarketData,
  readInvestmentInstrumentDetail,
  refreshInvestmentMarketData,
  type CachedMarketDataResult,
  type InstrumentDetailResult,
  type InvestmentMarketRefreshDb,
  type MarketDataRefreshResult,
  type MarketDataSnapshotValuationDto,
} from './services/market-data/investment-market-refresh.js';
export {
  INVOICE_PAST_DUE_REMINDER_AUDIT_ENTITY,
  INVOICE_PAST_DUE_REMINDER_SOURCE,
  sendPastDueInvoiceReminders,
  type InvoicePastDueReminderDb,
  type PastDueInvoiceReminderSummary,
  type SendPastDueInvoiceRemindersInput,
} from './services/invoice-past-due-reminders.js';
export {
  syncTimetableTasks,
  type TimetableTaskDb,
  type TimetableTaskSyncSummary,
} from './services/timetable-tasks.js';
export {
  timetableRouter,
  createTimetableRouter,
  type TimetableRouterDeps,
  type TimetablePublicationView,
} from './routers/timetable.js';
export {
  createTwelveDataMarketDataProvider,
  type TwelveDataQuoteProvider,
} from './services/market-data/twelve-data-provider.js';
export { isLondonStockMarketOpen } from './services/market-data/london-market-hours.js';
export {
  behaviourRouter,
  createBehaviourRouter,
  type BehaviourRouterDeps,
} from './routers/behaviour.js';
export { clubRouter, createClubRouter, type ClubRouterDeps } from './routers/club.js';
export { emailRouter, createEmailRouter, type EmailRouterDeps } from './routers/email.js';
export { invoiceRouter, createInvoiceRouter, type InvoiceRouterDeps } from './routers/invoice.js';
export { permissionSlipRouter } from './routers/permissionSlip.js';
export {
  studentSettingsRouter,
  createStudentSettingsRouter,
  type StudentCredentialAdapter,
  type StudentSettingsRouterDeps,
} from './routers/studentSettings.js';
export { faithCornerRouter } from './routers/faithCorner.js';
export { messageRouter, createMessageRouter, type MessageRouterDeps } from './routers/message.js';
export { staffHomeRouter } from './routers/staffHome.js';
export {
  handleClerkWebhookRequest,
  mapClerkUserToUpsertInput,
  processClerkWebhookEvent,
  createPrismaClerkUserStore,
  createDefaultClerkUserLookupClient,
  mapClerkUserProfileToUpsertInput,
  reconcileClerkUser,
  type ClerkUserStore,
  type ClerkUserLookupClient,
  type ClerkUserProfile,
  type ClerkUserUpsertInput,
  type ClerkWebhookVerifier,
  type PrismaClerkUserStoreDb,
} from './routers/clerkWebhook.js';

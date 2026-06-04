export { appRouter, type AppRouter } from './router.js';
export { createContext, type AppContext, type CreateContextArgs, type RlsTx } from './context.js';
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
  MESSAGE_NOTIFICATION_EMAIL_SUBJECT,
  PRODUCTION_RESEND_FROM,
  SMOKE_TEST_EMAIL_SUBJECT,
  SMOKE_TEST_EMAIL_TEXT,
  SMOKE_TEST_EMAIL_TO,
  USER_INVITE_EMAIL_SUBJECT,
  buildBehaviourNotificationEmail,
  buildClubNotificationEmail,
  buildEmailLogoUrl,
  buildHelloWorldEmail,
  buildMessageNotificationEmail,
  buildSmokeTestEmail,
  buildUserInviteEmail,
  createResendEmailClient,
  readEmailConfig,
  type EmailClient,
  type EmailConfig,
  type EmailEnv,
  type BehaviourNotificationEmailInput,
  type ClubNotificationEmailInput,
  type MessageNotificationEmailInput,
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
  DEFAULT_TITHE_PERCENTAGE,
  TITHE_CADENCE,
  runWeeklyTithe,
  toTithePercentage,
  type TitheRunResultDto,
  type WeeklyTitheRunSummary,
} from './services/tithe-run.js';
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
export {
  handleClerkWebhookRequest,
  mapClerkUserToUpsertInput,
  processClerkWebhookEvent,
  createPrismaClerkUserStore,
  type ClerkUserStore,
  type ClerkUserUpsertInput,
  type ClerkWebhookVerifier,
  type PrismaClerkUserStoreDb,
} from './routers/clerkWebhook.js';

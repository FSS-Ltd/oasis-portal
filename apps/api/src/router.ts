/**
 * Root tRPC router — composes all module routers.
 */
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';
import { router } from './trpc.js';
import { adminRouter } from './routers/admin.js';
import { auditRouter } from './routers/audit.js';
import { healthRouter } from './routers/health.js';
import { studentRouter } from './routers/student.js';
import { attendanceRouter } from './routers/attendance.js';
import { behaviourRouter } from './routers/behaviour.js';
import { childLogRouter } from './routers/childLog.js';
import { childNotesRouter } from './routers/childNotes.js';
import { paceRouter } from './routers/pace.js';
import { meritLedgerRouter } from './routers/meritLedger.js';
import { titheRouter } from './routers/tithe.js';
import { investmentRouter } from './routers/investment.js';
import { shopRouter } from './routers/shop.js';
import { leaderboardRouter } from './routers/leaderboard.js';
import { clubRouter } from './routers/club.js';
import { calendarRouter } from './routers/calendar.js';
import { noticeRouter } from './routers/notice.js';
import { messageRouter } from './routers/message.js';
import { communityRouter } from './routers/community.js';
import { profileRouter } from './routers/profile.js';
import { reportRouter } from './routers/report.js';
import { rotaRouter } from './routers/rota.js';
import { emailRouter } from './routers/email.js';
import { registrationRouter } from './routers/registration.js';
import { invoiceRouter } from './routers/invoice.js';
import { permissionSlipRouter } from './routers/permissionSlip.js';
import { incidentRouter } from './routers/incident.js';
import { studentSettingsRouter } from './routers/studentSettings.js';
import { faithCornerRouter } from './routers/faithCorner.js';
import { studentNotificationRouter } from './routers/studentNotification.js';
import { homeworkRouter } from './routers/homework.js';
import { staffHomeRouter } from './routers/staffHome.js';
import { academicInventoryRouter } from './routers/academicInventory.js';

export const appRouter = router({
  admin: adminRouter,
  audit: auditRouter,
  health: healthRouter,
  student: studentRouter,
  attendance: attendanceRouter,
  behaviour: behaviourRouter,
  childLog: childLogRouter,
  childNotes: childNotesRouter,
  pace: paceRouter,
  meritLedger: meritLedgerRouter,
  tithe: titheRouter,
  investment: investmentRouter,
  shop: shopRouter,
  leaderboard: leaderboardRouter,
  club: clubRouter,
  calendar: calendarRouter,
  notice: noticeRouter,
  message: messageRouter,
  community: communityRouter,
  profile: profileRouter,
  report: reportRouter,
  rota: rotaRouter,
  email: emailRouter,
  registration: registrationRouter,
  invoice: invoiceRouter,
  permissionSlip: permissionSlipRouter,
  incident: incidentRouter,
  studentSettings: studentSettingsRouter,
  faithCorner: faithCornerRouter,
  studentNotification: studentNotificationRouter,
  homework: homeworkRouter,
  staffHome: staffHomeRouter,
  academicInventory: academicInventoryRouter,
});

export type AppRouter = typeof appRouter;
export type RouterInputs = inferRouterInputs<AppRouter>;
export type RouterOutputs = inferRouterOutputs<AppRouter>;

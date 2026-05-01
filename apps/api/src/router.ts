/**
 * Root tRPC router — composes all module routers.
 */
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
import { noticeRouter } from './routers/notice.js';
import { messageRouter } from './routers/message.js';
import { profileRouter } from './routers/profile.js';
import { reportRouter } from './routers/report.js';
import { rotaRouter } from './routers/rota.js';

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
  notice: noticeRouter,
  message: messageRouter,
  profile: profileRouter,
  report: reportRouter,
  rota: rotaRouter,
});

export type AppRouter = typeof appRouter;

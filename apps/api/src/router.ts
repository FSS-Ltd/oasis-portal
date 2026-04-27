/**
 * Root tRPC router — composes all module routers.
 *
 * Phase 0 ships skeleton routers so the shape is frozen and web/mobile clients
 * can be typed against it. Each router is fleshed out in its own Phase during
 * the build plan.
 */
import { router } from './trpc.js';
import { adminRouter } from './routers/admin.js';
import { healthRouter } from './routers/health.js';
import { studentRouter } from './routers/student.js';
import { attendanceRouter } from './routers/attendance.js';
import { behaviourRouter } from './routers/behaviour.js';
import { paceRouter } from './routers/pace.js';
import { meritLedgerRouter } from './routers/meritLedger.js';
import { titheRouter } from './routers/tithe.js';
import { investmentRouter } from './routers/investment.js';
import { shopRouter } from './routers/shop.js';
import { leaderboardRouter } from './routers/leaderboard.js';
import { clubRouter } from './routers/club.js';
import { noticeRouter } from './routers/notice.js';
import { messageRouter } from './routers/message.js';
import { reportRouter } from './routers/report.js';

export const appRouter = router({
  admin: adminRouter,
  health: healthRouter,
  student: studentRouter,
  attendance: attendanceRouter,
  behaviour: behaviourRouter,
  pace: paceRouter,
  meritLedger: meritLedgerRouter,
  tithe: titheRouter,
  investment: investmentRouter,
  shop: shopRouter,
  leaderboard: leaderboardRouter,
  club: clubRouter,
  notice: noticeRouter,
  message: messageRouter,
  report: reportRouter,
});

export type AppRouter = typeof appRouter;

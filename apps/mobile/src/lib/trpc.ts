/**
 * tRPC React client for the mobile app.
 *
 * Shares AppRouter types with web — mobile gets identical typed endpoints.
 * Provider wiring (QueryClient + httpBatchLink pointing at the web app's
 * /api/trpc) lands in Phase 1 alongside Clerk Expo auth.
 */
import { createTRPCReact } from '@trpc/react-query';
import type { CreateTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@oasis/api';

export const api: CreateTRPCReact<AppRouter, unknown> = createTRPCReact<AppRouter>();

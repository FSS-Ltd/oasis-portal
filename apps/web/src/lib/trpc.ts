/**
 * tRPC React client for the web app.
 *
 * Provides a typed client bound to @oasis/api's AppRouter. The actual
 * provider wiring (QueryClient + httpBatchLink) is added in Phase 1 when
 * Clerk auth is live; Phase 0 only freezes the types so pages can import
 * `api.<router>.<proc>.useQuery(...)` call sites during scaffolding.
 */
import { createTRPCReact } from '@trpc/react-query';
import type { CreateTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@oasis/api';

export const api: CreateTRPCReact<AppRouter, unknown> = createTRPCReact<AppRouter>();

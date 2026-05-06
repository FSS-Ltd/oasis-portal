/**
 * tRPC React client for the mobile app.
 *
 * Shares AppRouter types with web — mobile gets identical typed endpoints.
 */
import { createTRPCReact } from '@trpc/react-query';
import type { CreateTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@oasis/api/router';

export const api: CreateTRPCReact<AppRouter, unknown> = createTRPCReact<AppRouter>();

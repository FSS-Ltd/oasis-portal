import { auth } from '@clerk/nextjs/server';
import { appRouter, createContext, resolveClerkUserIdFromBearerToken } from '@oasis/api';

type AppRouterCaller = ReturnType<typeof appRouter.createCaller>;

export async function resolveClerkUserId(headers: Headers): Promise<string | null> {
  try {
    const { userId } = await auth();
    if (userId) return userId;
  } catch {
    // Continue to bearer-token resolution for mobile requests.
  }

  return resolveClerkUserIdFromBearerToken(headers);
}

export async function createCallerForRequest(req: Request): Promise<AppRouterCaller> {
  const ctx = await createContext({
    headers: req.headers,
    clerkUserId: await resolveClerkUserId(req.headers),
  });
  return appRouter.createCaller(ctx);
}

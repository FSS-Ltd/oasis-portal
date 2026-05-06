import { useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import { httpBatchLink } from '@trpc/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import superjson from 'superjson';
import { api } from './trpc';

function trpcUrl(): string {
  return process.env.EXPO_PUBLIC_TRPC_URL ?? 'http://localhost:3000/api/trpc';
}

export function MobileTrpcProvider({ children }: { children: ReactNode }) {
  const { getToken } = useAuth();
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            refetchOnReconnect: true,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  const trpcClient = useMemo(
    () =>
      api.createClient({
        links: [
          httpBatchLink({
            url: trpcUrl(),
            transformer: superjson,
            headers: async () => {
              const token = await getToken();
              return token ? { authorization: `Bearer ${token}` } : {};
            },
          }),
        ],
      }),
    [getToken],
  );

  return (
    <api.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </api.Provider>
  );
}

import { useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import { httpBatchLink } from '@trpc/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import superjson from 'superjson';
import { api } from './trpc';
import { trpcUrl } from './trpc-url';
import { MobileRealtimeProvider } from './realtime/mobile-realtime-provider';

export function MobileTrpcProvider({ children }: { children: ReactNode }) {
  const { getToken } = useAuth();
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            refetchOnReconnect: false,
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
      <QueryClientProvider client={queryClient}>
        <MobileRealtimeProvider>{children}</MobileRealtimeProvider>
      </QueryClientProvider>
    </api.Provider>
  );
}

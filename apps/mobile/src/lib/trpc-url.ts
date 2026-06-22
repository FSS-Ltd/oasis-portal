const DEFAULT_TRPC_URL = 'http://localhost:3000/api/trpc';
const REDIRECTING_OASIS_WEB_HOST = 'www.oasisportal.space';
const CANONICAL_OASIS_WEB_HOST = 'oasisportal.space';

export function normalizeTrpcUrl(url: string): string {
  try {
    const parsed = new URL(url);

    if (parsed.hostname === REDIRECTING_OASIS_WEB_HOST) {
      parsed.hostname = CANONICAL_OASIS_WEB_HOST;
    }

    return parsed.toString();
  } catch {
    return url;
  }
}

export function trpcUrl(): string {
  return normalizeTrpcUrl(process.env.EXPO_PUBLIC_TRPC_URL ?? DEFAULT_TRPC_URL);
}

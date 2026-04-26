export function hasClerkPublishableKey(): boolean {
  return Boolean(process.env['NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY']);
}

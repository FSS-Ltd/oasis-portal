import { buildSmokeTestEmail, createResendEmailClient } from '../src/lib/email.js';

async function main() {
  const email = buildSmokeTestEmail();
  const result = await createResendEmailClient().send(email);
  const recipient = Array.isArray(email.to) ? email.to.join(', ') : email.to;
  const suffix = result.id ? ` (${result.id})` : '';
  console.warn(`Sent Resend deliverability smoke test to ${recipient}${suffix}.`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});

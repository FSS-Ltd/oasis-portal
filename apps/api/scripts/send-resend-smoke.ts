import { buildHelloWorldEmail, createResendEmailClient } from '../src/lib/email.js';

async function main() {
  const email = buildHelloWorldEmail();
  const result = await createResendEmailClient().send(email);
  const recipient = Array.isArray(email.to) ? email.to.join(', ') : email.to;
  const suffix = result.id ? ` (${result.id})` : '';
  console.warn(`Sent Resend hello-world email to ${recipient}${suffix}.`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});

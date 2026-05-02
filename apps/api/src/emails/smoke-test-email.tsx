import { OasisEmailShell, paragraphStyle, Text } from './_components/oasis-email-shell.js';

export interface SmokeTestEmailProps {
  logoUrl?: string;
}

export function buildSmokeTestEmailText(): string {
  return [
    'Oasis Portal transactional email deliverability check.',
    'Inspect the received message headers for spf=pass, dkim=pass, and dmarc=pass after deployment.',
  ].join(' ');
}

export function SmokeTestEmail({ logoUrl }: SmokeTestEmailProps) {
  const logoProps = logoUrl ? { logoUrl } : {};

  return (
    <OasisEmailShell
      eyebrow="Oasis Learning Centre"
      preview="Transactional email deliverability check from Oasis Portal."
      title="Email deliverability check"
      {...logoProps}
    >
      <Text style={paragraphStyle}>This is a transactional smoke test from Oasis Portal.</Text>
      <Text style={paragraphStyle}>
        Use this message to inspect mailbox headers for SPF, DKIM, and DMARC pass results after
        deployment.
      </Text>
    </OasisEmailShell>
  );
}

export default SmokeTestEmail;

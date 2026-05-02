import type { CSSProperties, ReactNode } from 'react';
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from 'react-email';
import { oasisEmailFont, oasisEmailTheme as theme } from '../oasis-email-theme.js';

interface OasisEmailShellProps {
  children: ReactNode;
  cta?: {
    href: string;
    label: string;
  };
  eyebrow: string;
  footerNote?: string;
  logoUrl?: string;
  preview: string;
  title: string;
}

const bodyStyle = {
  margin: '0',
  backgroundColor: theme.bg,
  color: theme.textPrimary,
  fontFamily: oasisEmailFont,
} satisfies CSSProperties;

const outerSectionStyle = {
  backgroundColor: theme.bg,
  padding: '32px 16px',
} satisfies CSSProperties;

const containerStyle = {
  maxWidth: '584px',
  overflow: 'hidden',
  border: `1px solid ${theme.border}`,
  borderRadius: '12px',
  backgroundColor: theme.surface,
} satisfies CSSProperties;

const headerStyle = {
  padding: '28px',
  backgroundColor: theme.navy,
  color: theme.surface,
} satisfies CSSProperties;

const logoStyle = {
  display: 'block',
  height: '48px',
  margin: '0 0 18px',
  objectFit: 'contain',
  width: 'auto',
} satisfies CSSProperties;

const eyebrowStyle = {
  margin: '0',
  color: theme.blueLight,
  fontSize: '13px',
  fontWeight: 700,
  letterSpacing: '0.04em',
  lineHeight: '1.3',
  textTransform: 'uppercase',
} satisfies CSSProperties;

const titleStyle = {
  margin: '8px 0 0',
  color: theme.surface,
  fontSize: '25px',
  fontWeight: 800,
  lineHeight: '1.2',
} satisfies CSSProperties;

const contentStyle = {
  padding: '28px',
} satisfies CSSProperties;

const ctaStyle = {
  display: 'inline-block',
  borderRadius: '8px',
  backgroundColor: theme.crimson,
  color: theme.surface,
  fontSize: '14px',
  fontWeight: 700,
  lineHeight: '1',
  padding: '13px 18px',
  textDecoration: 'none',
} satisfies CSSProperties;

const footerStyle = {
  padding: '0 28px 28px',
} satisfies CSSProperties;

const footerTextStyle = {
  margin: '0',
  color: theme.textMuted,
  fontSize: '12px',
  lineHeight: '1.55',
} satisfies CSSProperties;

const hrStyle = {
  borderColor: theme.borderLight,
  margin: '0 0 18px',
} satisfies CSSProperties;

export const paragraphStyle = {
  margin: '0 0 16px',
  color: theme.textSecondary,
  fontSize: '15px',
  lineHeight: '1.65',
} satisfies CSSProperties;

export const mutedParagraphStyle = {
  ...paragraphStyle,
  color: theme.textMuted,
  fontSize: '12px',
  lineHeight: '1.55',
} satisfies CSSProperties;

export const linkStyle = {
  color: theme.blue,
  fontWeight: 700,
  textDecoration: 'underline',
  wordBreak: 'break-all',
} satisfies CSSProperties;

export function OasisEmailShell({
  children,
  cta,
  eyebrow,
  footerNote,
  logoUrl,
  preview,
  title,
}: OasisEmailShellProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={bodyStyle}>
        <Section style={outerSectionStyle}>
          <Container style={containerStyle}>
            <Section style={headerStyle}>
              {logoUrl ? (
                <Img alt="Oasis Learning Centre" height="48" src={logoUrl} style={logoStyle} />
              ) : null}
              <Text style={eyebrowStyle}>{eyebrow}</Text>
              <Heading as="h1" style={titleStyle}>
                {title}
              </Heading>
            </Section>

            <Section style={contentStyle}>
              {children}
              {cta ? (
                <Button href={cta.href} style={ctaStyle}>
                  {cta.label}
                </Button>
              ) : null}
            </Section>

            <Section style={footerStyle}>
              <Hr style={hrStyle} />
              <Text style={footerTextStyle}>
                Oasis Learning Centre Portal sends transactional emails for account access and
                centre operations.
              </Text>
              {footerNote ? <Text style={footerTextStyle}>{footerNote}</Text> : null}
              <Text style={footerTextStyle}>
                Need help? Contact Oasis Learning Centre through your usual centre contact.
              </Text>
            </Section>
          </Container>
        </Section>
      </Body>
    </Html>
  );
}

export { Link, Text };

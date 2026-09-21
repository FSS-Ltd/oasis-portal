import React from 'react';
import { OasisEmailShell, paragraphStyle, Text } from './_components/oasis-email-shell.js';
import type { LibraryReminderStage } from '@oasis/domain';

export interface LibraryReminderEmailProps {
  bookTitle: string;
  childName: string;
  dueOn: string;
  libraryUrl?: string;
  logoUrl?: string;
  stage: LibraryReminderStage;
}

function titleFor(stage: LibraryReminderStage): string {
  if (stage === 'DueInTwoDays') return 'Library book due in two days';
  if (stage === 'DueToday') return 'Library book due today';
  return 'Library book is overdue';
}

export function buildLibraryReminderEmailText(
  props: Omit<LibraryReminderEmailProps, 'logoUrl'>,
): string {
  const status =
    props.stage === 'DueInTwoDays'
      ? 'due in two days'
      : props.stage === 'DueToday'
        ? 'due today'
        : 'one day overdue';
  return [
    `${props.childName}'s library book “${props.bookTitle}” is ${status}.`,
    `Please return it by ${props.dueOn}.`,
    props.libraryUrl ? `Open Library: ${props.libraryUrl}` : null,
    'Oasis Learning Centre',
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function LibraryReminderEmail(props: LibraryReminderEmailProps) {
  const status =
    props.stage === 'DueInTwoDays'
      ? 'due in two days'
      : props.stage === 'DueToday'
        ? 'due today'
        : 'one day overdue';
  const ctaProps = props.libraryUrl
    ? { cta: { href: props.libraryUrl, label: 'Open Library' } }
    : {};
  const logoProps = props.logoUrl ? { logoUrl: props.logoUrl } : {};
  return (
    <OasisEmailShell
      {...ctaProps}
      {...logoProps}
      eyebrow="Oasis Learning Centre"
      preview={titleFor(props.stage)}
      title={titleFor(props.stage)}
    >
      <Text style={paragraphStyle}>
        {props.childName}'s library book <strong>{props.bookTitle}</strong> is {status}.
      </Text>
      <Text style={paragraphStyle}>Please return it by {props.dueOn}.</Text>
    </OasisEmailShell>
  );
}

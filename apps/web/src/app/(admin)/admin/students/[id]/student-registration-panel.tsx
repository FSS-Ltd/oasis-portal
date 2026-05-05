'use client';

import { type ReactNode } from 'react';
import { REGISTRATION_CONSENT_COPY, REGISTRATION_CONSENT_TYPES } from '@oasis/domain';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { api, type RouterOutputs } from '@/lib/trpc';

type RegistrationRecord = NonNullable<RouterOutputs['registration']['byStudent']>;
type RegistrationContact =
  | RegistrationRecord['guardianContacts'][number]
  | RegistrationRecord['emergencyContacts'][number]
  | RegistrationRecord['pickupContacts'][number];

interface StudentRegistrationPanelProps {
  studentId: string;
}

function formatDate(value: Date | string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function valueOrDash(value: string | null | undefined): string {
  return value && value.trim().length > 0 ? value : '—';
}

function SummaryItem({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="registration-summary-item">
      <span>{label}</span>
      <strong>{children}</strong>
    </div>
  );
}

function ReadSection({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="registration-read-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function RegistrationFieldRows({
  fields,
  variant = 'default',
}: {
  fields: { label: string; value: string | null | undefined }[];
  variant?: 'default' | 'two';
}) {
  return (
    <div
      className={
        variant === 'two'
          ? 'profile-field-list registration-field-list registration-field-list--two'
          : 'profile-field-list registration-field-list'
      }
    >
      {fields.map((field) => (
        <div className="profile-field-row" key={field.label}>
          <span>{field.label}</span>
          <strong>{valueOrDash(field.value)}</strong>
        </div>
      ))}
    </div>
  );
}

function ContactList({
  className,
  contacts,
  kind,
}: {
  className?: string | undefined;
  contacts: RegistrationContact[];
  kind: 'guardian' | 'emergency' | 'pickup';
}) {
  if (contacts.length === 0) return <p className="muted">No contacts recorded.</p>;
  const listClassName = className
    ? `registration-read-list ${className}`
    : 'registration-read-list';

  return (
    <div className={listClassName}>
      {contacts.map((contact, index) => (
        <article
          className="registration-read-card"
          key={`${kind}-${contact.fullName}-${String(index)}`}
        >
          <strong>{contact.fullName}</strong>
          <span>{contact.relationship}</span>
          {'primaryPhone' in contact ? <span>{contact.primaryPhone}</span> : null}
          {'phone' in contact ? <span>{contact.phone}</span> : null}
          {'email' in contact ? <span>{valueOrDash(contact.email)}</span> : null}
          {'canPickUp' in contact ? (
            <Badge tone={contact.canPickUp ? 'green' : 'amber'}>
              {contact.canPickUp ? 'Can pick up' : 'No pickup'}
            </Badge>
          ) : null}
        </article>
      ))}
    </div>
  );
}

export function StudentRegistrationPanel({ studentId }: StudentRegistrationPanelProps) {
  const registrationQuery = api.registration.byStudent.useQuery({ studentId }, { retry: false });
  const registration = registrationQuery.data;

  if (registrationQuery.isLoading) {
    return <div className="empty-state">Loading registration form...</div>;
  }

  if (registrationQuery.error) {
    return <EmptyState detail={registrationQuery.error.message} title="Registration unavailable" />;
  }

  if (!registration) {
    return (
      <EmptyState
        detail="This student was not created through parent registration."
        title="No registration form"
      />
    );
  }

  const identityFields = [
    { label: 'Preferred name', value: registration.student.preferredName },
    { label: 'Gender', value: registration.student.gender },
    { label: 'Home language', value: registration.student.homeLanguage },
  ];
  const careFields = [
    { label: 'Allergies', value: registration.student.allergies },
    { label: 'Medical', value: registration.student.medicalConditions },
    { label: 'Medication', value: registration.student.medicationAtCentre },
    { label: 'Dietary', value: registration.student.dietaryRestrictions },
    { label: 'Support', value: registration.student.learningSupport },
    { label: 'Strengths', value: registration.student.interestsStrengths },
    { label: 'Settling', value: registration.student.settlingComfortNotes },
    { label: 'Notes', value: registration.student.additionalInfo },
  ];

  return (
    <section className="panel student-registration-panel">
      <div className="panel__body">
        <div className="section-title student-registration-panel__header">
          <div>
            <h2>Registration form</h2>
            <p className="muted">Parent-submitted child profile and shared household record.</p>
          </div>
          <Badge tone="blue">Submitted {formatDate(registration.submittedAt)}</Badge>
        </div>

        <div className="registration-summary-grid">
          <SummaryItem label="Home address">{registration.homeAddress}</SummaryItem>
          <SummaryItem label="Agreement">
            {registration.agreement.guardianName} ·{' '}
            {formatDate(registration.agreement.agreementDate)}
          </SummaryItem>
          <SummaryItem label="Siblings">
            <span className="badge-list">
              {registration.siblings.map((sibling) => (
                <Badge key={sibling.id} tone={sibling.active ? 'green' : 'amber'}>
                  {sibling.fullName}
                </Badge>
              ))}
            </span>
          </SummaryItem>
        </div>

        <ReadSection title="Child profile">
          <RegistrationFieldRows fields={identityFields} variant="two" />
        </ReadSection>

        <ReadSection title="Care, medical, and notes">
          <RegistrationFieldRows fields={careFields} variant="two" />
          <div className="registration-notes-block">
            <span>Attendance, routine, or communication notes</span>
            <strong>{valueOrDash(registration.student.studentNotes)}</strong>
          </div>
        </ReadSection>

        <ReadSection title="Shared contacts">
          <div className="registration-contact-grid">
            <div>
              <h4>Guardian contacts</h4>
              <ContactList
                className="registration-read-list--compact"
                contacts={registration.guardianContacts}
                kind="guardian"
              />
            </div>
            <div>
              <h4>Emergency contacts</h4>
              <ContactList
                className="registration-read-list--compact"
                contacts={registration.emergencyContacts}
                kind="emergency"
              />
            </div>
          </div>
        </ReadSection>

        <ReadSection title="Authorised pickup">
          <ContactList contacts={registration.pickupContacts} kind="pickup" />
        </ReadSection>

        <ReadSection title="Permissions & consents">
          <div className="registration-consent-list">
            {REGISTRATION_CONSENT_TYPES.map((type) => (
              <div className="registration-consent-item" key={type}>
                <span>{REGISTRATION_CONSENT_COPY[type]}</span>
                <strong>
                  {registration.student.consents[type].granted ? 'Yes' : 'No'} · Initials:{' '}
                  {registration.student.consents[type].initials}
                </strong>
              </div>
            ))}
          </div>
        </ReadSection>
      </div>
    </section>
  );
}

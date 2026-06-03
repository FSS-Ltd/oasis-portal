import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  formatIncidentDateTime,
  incidentConfidentialityLabels,
  incidentSeverityLabels,
  incidentTypeLabels,
} from './incident-format';
import {
  reportabilityChecks,
  type IncidentConfidentiality,
  type IncidentSeverity,
  type IncidentType,
  type StaffIncident,
} from './incident-staff-workflow-state';

interface IncidentReportDetailProps {
  report: StaffIncident;
}

interface DetailItem {
  label: string;
  value: string;
}

function valueOrFallback(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : 'Not recorded';
}

function yesNo(value: boolean): string {
  return value ? 'Yes' : 'No';
}

function DetailSection({
  children,
  items,
  title,
}: {
  children?: ReactNode;
  items?: readonly DetailItem[];
  title: string;
}) {
  return (
    <section className="incident-report-detail__section">
      <h3>{title}</h3>
      {items ? (
        <dl className="incident-report-detail__grid">
          {items.map((item) => (
            <div key={item.label}>
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {children}
    </section>
  );
}

function CopyBlock({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="incident-report-detail__copy">
      <span>{label}</span>
      <p>{valueOrFallback(value)}</p>
    </div>
  );
}

export function IncidentReportDetail({ report }: IncidentReportDetailProps) {
  const staffInvolved = report.staff
    .filter((staffMember) => staffMember.kind === 'StaffInvolved')
    .map((staffMember) => staffMember.name)
    .join(', ');
  const witnessStaff = report.staff
    .filter((staffMember) => staffMember.kind === 'Witness')
    .map((staffMember) => staffMember.name)
    .join(', ');
  const children = report.students.map((student) => student.fullName).join(', ');

  return (
    <div className="incident-report-detail">
      <DetailSection
        items={[
          { label: 'Type', value: incidentTypeLabels[report.type as IncidentType] },
          { label: 'Severity', value: incidentSeverityLabels[report.severity as IncidentSeverity] },
          {
            label: 'Confidentiality',
            value: incidentConfidentialityLabels[report.confidentiality as IncidentConfidentiality],
          },
          { label: 'Status', value: report.status },
        ]}
        title="Incident classification"
      />

      <DetailSection
        items={[
          { label: 'Occurred', value: formatIncidentDateTime(report.occurredAt) },
          { label: 'Location', value: report.location },
          { label: 'Activity / context', value: valueOrFallback(report.activity) },
          { label: 'Off-site activity', value: yesNo(report.offSite) },
        ]}
        title="When and where"
      />

      <DetailSection
        items={[
          { label: 'Children', value: valueOrFallback(children) },
          { label: 'Staff involved', value: valueOrFallback(staffInvolved) },
          { label: 'Witness staff', value: valueOrFallback(witnessStaff) },
          { label: 'Other witnesses', value: valueOrFallback(report.witnesses) },
          { label: 'Recorded by', value: valueOrFallback(report.recordedByName) },
        ]}
        title="People involved"
      />

      <DetailSection title="Factual account">
        <CopyBlock label="What happened" value={report.factualAccount} />
        <CopyBlock label="Child's voice / direct disclosure" value={report.directDisclosure} />
        <CopyBlock label="Immediate actions taken" value={report.immediateActions} />
      </DetailSection>

      <DetailSection
        items={[
          { label: 'Injury sustained', value: yesNo(report.injurySustained) },
          { label: 'Body area / injury', value: valueOrFallback(report.bodyArea) },
          { label: 'First aid given', value: yesNo(report.firstAidGiven) },
          { label: 'First aider', value: valueOrFallback(report.firstAiderName) },
          {
            label: 'Hospital / 111 / 999 contacted',
            value: yesNo(report.emergencyServicesContacted),
          },
          { label: 'Hospital treatment', value: yesNo(report.hospitalTreatment) },
          { label: 'Parent / carer notified', value: yesNo(report.parentCarerNotified) },
          {
            label: 'Time notified',
            value: report.parentNotifiedAt
              ? formatIncidentDateTime(report.parentNotifiedAt)
              : 'Not recorded',
          },
          { label: 'Medical notes', value: valueOrFallback(report.medicalNotes) },
        ]}
        title="Injury, first aid and medical"
      />

      <DetailSection title="Reportability checks">
        <div className="incident-report-detail__checks">
          {reportabilityChecks.map((check) => (
            <div key={check.field}>
              <span>{check.label}</span>
              <Badge tone={report[check.field] ? 'green' : 'grey'}>
                {report[check.field] ? 'Yes' : 'No'}
              </Badge>
            </div>
          ))}
        </div>
      </DetailSection>
    </div>
  );
}

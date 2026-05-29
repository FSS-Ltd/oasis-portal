'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  Info,
  MessageSquare,
  Stethoscope,
  UserCheck,
  X,
} from 'lucide-react';
import { displaySchoolYearLabel } from '@oasis/domain';
import { ParentChildSelector } from '@/components/parent/parent-child-selector';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { Panel } from '@/components/ui/panel';
import { StatCard } from '@/components/ui/stat-card';
import { showErrorToast, showSuccessToast } from '@/lib/notifications';
import { api, type RouterOutputs } from '@/lib/trpc';
import { formatIncidentDate, incidentTypeLabels } from './incident-format';

type ParentIncident = RouterOutputs['incident']['listParent'][number];
type IncidentType = keyof typeof incidentTypeLabels;

function ParentIncidentPreview({
  incident,
  onAcknowledge,
  onClose,
  pending,
}: {
  incident: ParentIncident | null;
  onAcknowledge: (copyId: string) => void;
  onClose: () => void;
  pending: boolean;
}) {
  if (!incident) {
    return null;
  }
  const occurredAt = new Date(incident.occurredAt);
  const timeLabel = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(occurredAt);
  const signedOffLabel = incident.signedOffAt
    ? formatIncidentDate(incident.signedOffAt)
    : incident.sharedAt
      ? formatIncidentDate(incident.sharedAt)
      : null;

  return (
    <Panel body className="incident-parent-preview">
      <div className="incident-parent-preview__head">
        <div>
          <h2>Incident Report</h2>
        </div>
        <Badge tone="red">Parent copy</Badge>
        <button
          aria-label="Close incident report preview"
          className="incident-parent-preview__close"
          onClick={onClose}
          type="button"
        >
          <X aria-hidden="true" size={18} />
        </button>
      </div>
      <dl className="incident-parent-meta">
        <dt>Report ID</dt>
        <dd>{incident.reportNumber}</dd>
        <dt>Child</dt>
        <dd>{incident.studentName}</dd>
        <dt>Type</dt>
        <dd>{incidentTypeLabels[incident.type as IncidentType]}</dd>
        <dt>Date / time</dt>
        <dd>
          {formatIncidentDate(incident.occurredAt)}
          <span aria-hidden="true"> · </span>
          {timeLabel}
        </dd>
      </dl>
      <div className="incident-parent-document">
        <div className="incident-parent-document__brand">
          <Image alt="" height={42} src="/oasis-logo.svg" width={128} />
        </div>
        <h3>Incident Report</h3>
        <section>
          <FileText aria-hidden="true" size={18} />
          <div>
            <strong>Summary shared with parent</strong>
            <p>{incident.parentSummary}</p>
          </div>
        </section>
        <section>
          <Stethoscope aria-hidden="true" size={18} />
          <div>
            <strong>First aid given</strong>
            <p>
              {incident.firstAidGiven
                ? 'First aid was recorded as part of this incident report.'
                : 'No first aid was recorded on this parent copy.'}
            </p>
          </div>
        </section>
        <section>
          <AlertCircle aria-hidden="true" size={18} />
          <div>
            <strong>Follow-up requested</strong>
            <p>Monitor and contact the centre if anything changes.</p>
          </div>
        </section>
        <section>
          <UserCheck aria-hidden="true" size={18} />
          <div>
            <strong>Head sign-off</strong>
            <p>
              {signedOffLabel
                ? `Signed off by the centre on ${signedOffLabel}.`
                : 'Signed off by the centre before sharing.'}
            </p>
          </div>
        </section>
      </div>
      <div className="incident-parent-actions">
        <a
          className="button button--primary incident-parent-actions__primary"
          href={`/api/incidents/parent-pdf/${incident.id}`}
        >
          <Eye aria-hidden="true" size={15} />
          View PDF
        </a>
        <a
          className="button button--secondary"
          href={`/api/incidents/parent-pdf/${incident.id}`}
          download
        >
          <Download aria-hidden="true" size={15} />
          Download PDF
        </a>
        <Button
          disabled={!incident.requiresAcknowledgement}
          onClick={() => {
            onAcknowledge(incident.id);
          }}
          pending={pending}
          type="button"
          variant="secondary"
        >
          <CheckCircle2 aria-hidden="true" size={15} />
          Acknowledge receipt
        </Button>
      </div>
      <div className="incident-parent-note">
        <Info aria-hidden="true" size={18} />
        <p>
          Some internal safeguarding notes may be withheld where sharing would not be appropriate.
          Contact the centre if you need to discuss this report.
        </p>
      </div>
    </Panel>
  );
}

export function IncidentParentPortal() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const profile = api.profile.me.useQuery(undefined, { retry: false });
  const incidents = api.incident.listParent.useQuery();
  const utils = api.useUtils();
  const acknowledge = api.incident.acknowledgeParentCopy.useMutation({
    async onSuccess() {
      await utils.incident.listParent.invalidate();
      showSuccessToast('Incident receipt acknowledged.');
    },
    onError(error) {
      showErrorToast(error, 'Incident receipt could not be acknowledged.');
    },
  });
  const rows = incidents.data ?? [];
  const children = profile.data?.children ?? [];
  const selectedChild =
    children.find((child) => child.id === selectedChildId) ?? children[0] ?? null;
  const visibleRows = useMemo(
    () =>
      selectedChild ? rows.filter((incident) => incident.studentId === selectedChild.id) : rows,
    [rows, selectedChild],
  );
  const selected = useMemo(
    () => visibleRows.find((incident) => incident.id === selectedId) ?? null,
    [visibleRows, selectedId],
  );
  const stats = {
    acknowledged: visibleRows.filter((incident) => incident.acknowledgedAt).length,
    downloaded: visibleRows.filter((incident) => incident.downloadedAt).length,
    shared: visibleRows.length,
    waiting: visibleRows.filter((incident) => incident.requiresAcknowledgement).length,
  };
  const columns: DataTableColumn<ParentIncident>[] = [
    {
      id: 'report',
      header: 'Report',
      render: (incident) => (
        <div className="incident-parent-report-cell">
          <span aria-hidden="true" className="incident-parent-pdf-icon">
            PDF
          </span>
          <span>{incident.reportNumber}</span>
        </div>
      ),
    },
    {
      id: 'type',
      header: 'Incident type',
      render: (incident) => incidentTypeLabels[incident.type as IncidentType],
    },
    {
      id: 'date',
      header: 'Date',
      render: (incident) => formatIncidentDate(incident.occurredAt),
    },
    {
      id: 'status',
      header: 'Status',
      render: (incident) =>
        incident.requiresAcknowledgement ? (
          <Badge tone="red">Acknowledgement requested</Badge>
        ) : (
          <Badge tone="green">Viewed</Badge>
        ),
    },
    {
      id: 'actions',
      header: 'Actions',
      render: (incident) => (
        <div
          className="incident-parent-table-actions"
          onClick={(event) => {
            event.stopPropagation();
          }}
          onKeyDown={(event) => {
            event.stopPropagation();
          }}
        >
          <a href={`/api/incidents/parent-pdf/${incident.id}`}>
            <Eye aria-hidden="true" size={14} />
            View PDF
          </a>
          <a href={`/api/incidents/parent-pdf/${incident.id}`} download>
            <Download aria-hidden="true" size={14} />
            Download
          </a>
        </div>
      ),
    },
  ];

  return (
    <section className="incident-page incident-parent-page">
      <header className="incident-page__header">
        <div>
          <p>{formatIncidentDate(new Date())}</p>
          <h1>Incidents</h1>
          <span>View signed-off reports shared by Oasis Learning Centre.</span>
        </div>
        {selectedChild ? (
          <ParentChildSelector
            children={children.map((child) => ({
              fullName: child.fullName,
              id: child.id,
              yearGroup: child.yearGroup,
            }))}
            onSelect={(studentId) => {
              setSelectedChildId(studentId);
              setSelectedId(null);
            }}
            selectedChildId={selectedChild.id}
          />
        ) : null}
      </header>

      {selectedChild ? (
        <section className="incident-parent-hero">
          <Avatar className="incident-parent-hero__avatar" name={selectedChild.fullName} />
          <div>
            <h2>{selectedChild.fullName}</h2>
            <p>{displaySchoolYearLabel(selectedChild.yearGroup)}</p>
          </div>
          <div className="incident-parent-hero__badges">
            <Badge tone="blue">
              <FileText aria-hidden="true" size={16} />
              {String(stats.shared)} shared reports
            </Badge>
            {stats.waiting > 0 ? (
              <Badge tone="red">
                <AlertCircle aria-hidden="true" size={16} />
                {String(stats.waiting)} requires acknowledgement
              </Badge>
            ) : null}
          </div>
        </section>
      ) : null}

      <div className="dashboard-grid incident-stat-grid">
        <StatCard
          accent="#5B90C5"
          icon={<FileText aria-hidden="true" size={28} />}
          label="Shared reports"
          value={stats.shared}
        />
        <StatCard
          accent="#8B1E2D"
          icon={<AlertCircle aria-hidden="true" size={28} />}
          label="Acknowledgement due"
          value={stats.waiting}
        />
        <StatCard
          accent="#166534"
          icon={<CheckCircle2 aria-hidden="true" size={28} />}
          label="Acknowledged"
          value={stats.acknowledged}
        />
        <StatCard
          accent="#1B2B5E"
          icon={<Download aria-hidden="true" size={28} />}
          label="Downloaded"
          value={stats.downloaded}
        />
      </div>

      <div className={selected ? 'incident-layout incident-layout--parent-preview' : 'incident-layout'}>
        <div className="incident-parent-main-column">
          <Panel body className="incident-list-panel">
            <h2>Shared incident reports</h2>
            <DataTable
              columns={columns}
              empty="No signed-off incident reports have been shared."
              errorMessage={incidents.error?.message}
              getRowKey={(incident) => incident.id}
              getRowClassName={(incident) =>
                incident.id === selected?.id
                  ? 'incident-table-row is-selected'
                  : 'incident-table-row'
              }
              loading={incidents.isLoading}
              onRowClick={(incident) => {
                setSelectedId(incident.id);
              }}
              rows={visibleRows}
            />
          </Panel>
          <Panel body className="incident-parent-contact">
            <div>
              <h2>Need to discuss this?</h2>
              <p>
                If you have any questions or would like to talk through this incident, contact the
                centre.
              </p>
            </div>
            <div>
              <a className="parent-contact-action parent-contact-action--message" href="/parent/messages">
                <MessageSquare aria-hidden="true" size={15} />
                Message supervisor
              </a>
            </div>
          </Panel>
        </div>
        {selected ? (
          <ParentIncidentPreview
            incident={selected}
            onAcknowledge={(copyId) => {
              acknowledge.mutate({ copyId });
            }}
            onClose={() => {
              setSelectedId(null);
            }}
            pending={acknowledge.isPending}
          />
        ) : null}
      </div>
    </section>
  );
}

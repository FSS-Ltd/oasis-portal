'use client';

import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ReportPeriodControls, type DraftPeriod } from './report-period-controls';
import { ReportSectionPicker, type DraftSections } from './report-section-picker';

interface ReportDraftControlsProps {
  hasSelectedStudent: boolean;
  onGenerate: () => void;
  onPeriodChange: (period: DraftPeriod) => void;
  onSectionsChange: (sections: DraftSections) => void;
  pending: boolean;
  period: DraftPeriod;
  sections: DraftSections;
}

export function ReportDraftControls({
  hasSelectedStudent,
  onGenerate,
  onPeriodChange,
  onSectionsChange,
  pending,
  period,
  sections,
}: ReportDraftControlsProps) {
  return (
    <section className="panel panel__body report-controls" aria-labelledby="report-actions">
      <div className="section-title">
        <div>
          <h2 id="report-actions">Draft Controls</h2>
          <p className="muted">Choose the reporting period and included sections.</p>
        </div>
      </div>
      <ReportPeriodControls disabled={pending} onChange={onPeriodChange} value={period} />
      <ReportSectionPicker disabled={pending} onChange={onSectionsChange} value={sections} />
      <div className="report-control-row report-control-row--actions">
        <span className="muted">Generate or refresh this saved snapshot.</span>
        <Button
          disabled={!hasSelectedStudent}
          onClick={onGenerate}
          pending={pending}
          type="button"
          variant="secondary"
        >
          <RefreshCw aria-hidden="true" size={16} />
          Generate Draft
        </Button>
      </div>
    </section>
  );
}

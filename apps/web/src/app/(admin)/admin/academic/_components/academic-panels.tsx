import { Save, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, TextInput } from '@/components/ui/field';
import { standardSchoolYearOptions } from './school-year-options';

export type PolicyForm = {
  dailyTestLimitEnabled: boolean;
  maxTestsPerStudentPerDay: string;
  passThreshold: string;
  samePaceSameDayBlockEnabled: boolean;
};

interface StandardYearsPanelProps {
  yearCount: number;
}

export function StandardYearsPanel({ yearCount }: StandardYearsPanelProps) {
  return (
    <section className="panel settings-wide">
      <div className="panel__body">
        <div className="section-title">
          <h2>Standard school years</h2>
          <span className="badge">{yearCount} years</span>
        </div>
        <div className="year-chip-grid" aria-label="Standard school years">
          {standardSchoolYearOptions.map(({ label, year }) => (
            <span className="year-chip" key={year}>
              {label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

interface PacePolicyPanelProps {
  form: PolicyForm;
  onChange: (form: PolicyForm) => void;
  onSubmit: () => void;
  policyError?: string | undefined;
  saveError?: string | undefined;
  savePending: boolean;
  saveSuccess: boolean;
}

export function PacePolicyPanel({
  form,
  onChange,
  onSubmit,
  policyError,
  saveError,
  savePending,
  saveSuccess,
}: PacePolicyPanelProps) {
  return (
    <section className="panel settings-wide">
      <div className="panel__body">
        <div className="section-title">
          <h2>PACE policy</h2>
          <SlidersHorizontal aria-hidden="true" color="#5B90C5" size={18} />
        </div>
        <form
          className="form-grid"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <div className="policy-grid">
            <label className="field">
              <span className="field__label">Daily test limit</span>
              <input
                checked={form.dailyTestLimitEnabled}
                className="switch-input"
                onChange={(event) => {
                  onChange({ ...form, dailyTestLimitEnabled: event.target.checked });
                }}
                type="checkbox"
              />
            </label>
            <Field label="Maximum tests per student per day">
              <TextInput
                max={20}
                min={1}
                onChange={(event) => {
                  onChange({ ...form, maxTestsPerStudentPerDay: event.target.value });
                }}
                type="number"
                value={form.maxTestsPerStudentPerDay}
              />
            </Field>
            <label className="field">
              <span className="field__label">Same-day self/final block</span>
              <input
                checked={form.samePaceSameDayBlockEnabled}
                className="switch-input"
                onChange={(event) => {
                  onChange({ ...form, samePaceSameDayBlockEnabled: event.target.checked });
                }}
                type="checkbox"
              />
            </label>
            <Field label="Pass threshold">
              <TextInput
                max={100}
                min={1}
                onChange={(event) => {
                  onChange({ ...form, passThreshold: event.target.value });
                }}
                type="number"
                value={form.passThreshold}
              />
            </Field>
          </div>
          {policyError ? (
            <p className="status--error" role="alert">
              {policyError}
            </p>
          ) : null}
          {saveError ? (
            <p className="status--error" role="alert">
              {saveError}
            </p>
          ) : null}
          {saveSuccess ? <p className="status--success">PACE policy saved</p> : null}
          <div>
            <Button pending={savePending} type="submit">
              <Save aria-hidden="true" size={16} />
              Save PACE policy
            </Button>
          </div>
        </form>
      </div>
    </section>
  );
}

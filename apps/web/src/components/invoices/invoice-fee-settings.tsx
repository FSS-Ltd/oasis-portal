'use client';

import { type FormEvent, useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, TextInput } from '@/components/ui/field';
import type { RouterInputs, RouterOutputs } from '@/lib/trpc';
import { formatPence } from './invoice-ui';

type FeeConfig = RouterOutputs['invoice']['listFeeConfig'];
type FeeConfigInput = RouterInputs['invoice']['upsertFeeConfig'];

function penceToInput(amountPence: number): string {
  return (amountPence / 100).toFixed(2);
}

function parsePenceInput(value: string): number | null {
  const normalized = value.trim().replace(/[£,\s]/gu, '');
  if (!/^[0-9]+(?:\.[0-9]{1,2})?$/u.test(normalized)) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? Math.round(amount * 100) : null;
}

export function InvoiceFeeSettings({
  config,
  pending,
  onSubmit,
}: {
  config: FeeConfig;
  pending: boolean;
  onSubmit: (input: FeeConfigInput) => void;
}) {
  const [schoolYear, setSchoolYear] = useState(String(config.schoolYear));
  const [annual, setAnnual] = useState(penceToInput(config.annualAmountPence));
  const [term, setTerm] = useState(penceToInput(config.termAmountPence));
  const [monthly, setMonthly] = useState(penceToInput(config.monthlyAmountPence));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSchoolYear(String(config.schoolYear));
    setAnnual(penceToInput(config.annualAmountPence));
    setTerm(penceToInput(config.termAmountPence));
    setMonthly(penceToInput(config.monthlyAmountPence));
  }, [config]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedYear = Number(schoolYear);
    const annualAmountPence = parsePenceInput(annual);
    const termAmountPence = parsePenceInput(term);
    const monthlyAmountPence = parsePenceInput(monthly);
    if (
      !Number.isInteger(parsedYear) ||
      annualAmountPence === null ||
      termAmountPence === null ||
      monthlyAmountPence === null
    ) {
      setError('Enter a valid fee year and fee amounts.');
      return;
    }
    setError(null);
    onSubmit({
      schoolYear: parsedYear,
      annualAmountPence,
      termAmountPence,
      monthlyAmountPence,
    });
  }

  return (
    <form className="invoice-fee-settings" onSubmit={submit}>
      <div>
        <p>Fee settings - {config.cycleLabel}</p>
        <h2>{formatPence(config.annualAmountPence)} per annum</h2>
      </div>
      <div className="invoice-fee-settings__fields">
        <Field label="Year">
          <TextInput
            onChange={(event) => {
              setSchoolYear(event.target.value);
            }}
            value={schoolYear}
          />
        </Field>
        <Field label="Annual">
          <TextInput
            inputMode="decimal"
            onChange={(event) => {
              setAnnual(event.target.value);
            }}
            value={annual}
          />
        </Field>
        <Field label="Term">
          <TextInput
            inputMode="decimal"
            onChange={(event) => {
              setTerm(event.target.value);
            }}
            value={term}
          />
        </Field>
        <Field label="Monthly">
          <TextInput
            inputMode="decimal"
            onChange={(event) => {
              setMonthly(event.target.value);
            }}
            value={monthly}
          />
        </Field>
      </div>
      {error ? <p className="invoice-form-error">{error}</p> : null}
      <Button pending={pending} size="sm" type="submit" variant="secondary">
        <Save aria-hidden="true" size={14} />
        Save fees
      </Button>
    </form>
  );
}

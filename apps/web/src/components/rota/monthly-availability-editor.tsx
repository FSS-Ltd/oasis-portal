'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import { friendlyErrorMessage, showErrorToast, showSuccessToast } from '@/lib/notifications';
import { api } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Field, TextInput } from '@/components/ui/field';

type MonthlyAvailabilityDraft = {
  id: string;
  date: string;
  startMinute: number;
  endMinute: number;
};

interface MonthlyAvailabilityEditorProps {
  title?: string;
}

function currentMonthKey(): string {
  return new Date().toISOString().slice(0, 7);
}

function firstDateForMonth(month: string): string {
  return `${month}-01`;
}

function emptyAvailabilityRow(month: string): MonthlyAvailabilityDraft {
  return {
    id: `draft_${String(Date.now())}_${Math.random().toString(36).slice(2)}`,
    date: firstDateForMonth(month),
    startMinute: 540,
    endMinute: 720,
  };
}

function toTimeValue(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function fromTimeValue(value: string): number {
  const [hour = '0', minute = '0'] = value.split(':');
  return Number(hour) * 60 + Number(minute);
}

function lastDateForMonth(month: string): string {
  const [yearValue, monthValue] = month.split('-');
  const lastDate = new Date(Date.UTC(Number(yearValue), Number(monthValue), 0));
  return lastDate.toISOString().slice(0, 10);
}

export function MonthlyAvailabilityEditor({
  title = 'Monthly availability',
}: MonthlyAvailabilityEditorProps) {
  const utils = api.useUtils();
  const [month, setMonth] = useState(currentMonthKey);
  const [availabilityDraft, setAvailabilityDraft] = useState<MonthlyAvailabilityDraft[]>([]);
  const monthBounds = useMemo(
    () => ({ min: firstDateForMonth(month), max: lastDateForMonth(month) }),
    [month],
  );
  const availabilityQuery = api.rota.myMonthlyAvailability.useQuery({ month }, { retry: false });
  const saveAvailability = api.rota.setMyMonthlyAvailability.useMutation({
    onSuccess: async () => {
      showSuccessToast('Monthly availability saved.');
      await Promise.all([
        utils.rota.myMonthlyAvailability.invalidate({ month }),
        utils.rota.staffMonthlyAvailability.invalidate(),
      ]);
    },
    onError(error) {
      showErrorToast(error, 'Monthly availability could not be saved.');
    },
  });

  useEffect(() => {
    if (!availabilityQuery.data) return;
    setAvailabilityDraft(
      availabilityQuery.data.map((window) => ({
        id: window.id,
        date: window.date,
        startMinute: window.startMinute,
        endMinute: window.endMinute,
      })),
    );
  }, [availabilityQuery.data]);

  return (
    <section className="panel panel__body">
      <div className="section-title">
        <div>
          <h2>{title}</h2>
          <p className="muted">Set exact dates for this month.</p>
        </div>
        <Button
          onClick={() => {
            setAvailabilityDraft((rows) => [...rows, emptyAvailabilityRow(month)]);
          }}
          size="sm"
          type="button"
          variant="secondary"
        >
          <Plus aria-hidden="true" size={14} />
          Add
        </Button>
      </div>

      <Field label="Month">
        <TextInput
          onChange={(event) => {
            setMonth(event.target.value || currentMonthKey());
          }}
          type="month"
          value={month}
        />
      </Field>

      {availabilityQuery.isLoading ? (
        <div className="empty-state">Loading monthly availability...</div>
      ) : null}
      {availabilityQuery.error ? (
        <p className="status--error">{friendlyErrorMessage(availabilityQuery.error)}</p>
      ) : null}

      <div className="availability-editor monthly-availability-editor">
        {availabilityDraft.length === 0 ? (
          <div className="empty-state">No monthly availability set.</div>
        ) : (
          availabilityDraft.map((window) => (
            <div className="availability-editor__row" key={window.id}>
              <Field label="Date">
                <TextInput
                  max={monthBounds.max}
                  min={monthBounds.min}
                  onChange={(event) => {
                    setAvailabilityDraft((rows) =>
                      rows.map((row) =>
                        row.id === window.id ? { ...row, date: event.target.value } : row,
                      ),
                    );
                  }}
                  type="date"
                  value={window.date}
                />
              </Field>
              <Field label="Start">
                <TextInput
                  aria-label="Monthly availability start time"
                  onChange={(event) => {
                    setAvailabilityDraft((rows) =>
                      rows.map((row) =>
                        row.id === window.id
                          ? { ...row, startMinute: fromTimeValue(event.target.value) }
                          : row,
                      ),
                    );
                  }}
                  type="time"
                  value={toTimeValue(window.startMinute)}
                />
              </Field>
              <Field label="End">
                <TextInput
                  aria-label="Monthly availability end time"
                  onChange={(event) => {
                    setAvailabilityDraft((rows) =>
                      rows.map((row) =>
                        row.id === window.id
                          ? { ...row, endMinute: fromTimeValue(event.target.value) }
                          : row,
                      ),
                    );
                  }}
                  type="time"
                  value={toTimeValue(window.endMinute)}
                />
              </Field>
              <Button
                aria-label="Remove monthly availability window"
                onClick={() => {
                  setAvailabilityDraft((rows) => rows.filter((row) => row.id !== window.id));
                }}
                size="sm"
                type="button"
                variant="ghost"
              >
                <Trash2 aria-hidden="true" size={14} />
              </Button>
            </div>
          ))
        )}
      </div>

      <Button
        className="supervisor-submit"
        onClick={() => {
          saveAvailability.mutate({
            month,
            windows: availabilityDraft.map(({ date, startMinute, endMinute }) => ({
              date,
              startMinute,
              endMinute,
            })),
          });
        }}
        pending={saveAvailability.isPending}
        type="button"
      >
        <Save aria-hidden="true" size={16} />
        Save monthly availability
      </Button>
    </section>
  );
}

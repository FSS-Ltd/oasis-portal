'use client';

import { useEffect, useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import { api } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Field, SelectInput, TextInput } from '@/components/ui/field';

const weekdays = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
] as const;

type AvailabilityDraft = {
  id: string;
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
};

interface MyAvailabilityEditorProps {
  title?: string;
}

function emptyAvailabilityRow(): AvailabilityDraft {
  return {
    id: `draft_${String(Date.now())}_${Math.random().toString(36).slice(2)}`,
    dayOfWeek: 1,
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

export function MyAvailabilityEditor({ title = 'Weekly availability' }: MyAvailabilityEditorProps) {
  const utils = api.useUtils();
  const [availabilityDraft, setAvailabilityDraft] = useState<AvailabilityDraft[]>([]);
  const [availabilityStatus, setAvailabilityStatus] = useState<string | null>(null);
  const availabilityQuery = api.rota.myAvailability.useQuery(undefined, { retry: false });
  const saveAvailability = api.rota.setMyAvailability.useMutation({
    onSuccess: async () => {
      setAvailabilityStatus('Availability saved.');
      await Promise.all([
        utils.rota.myAvailability.invalidate(),
        utils.rota.staffAvailability.invalidate(),
      ]);
    },
  });

  useEffect(() => {
    if (!availabilityQuery.data) return;
    setAvailabilityDraft(
      availabilityQuery.data.map((window) => ({
        id: window.id,
        dayOfWeek: window.dayOfWeek,
        startMinute: window.startMinute,
        endMinute: window.endMinute,
      })),
    );
  }, [availabilityQuery.data]);

  return (
    <section className="panel panel__body">
      <div className="section-title">
        <h2>{title}</h2>
        <Button
          onClick={() => {
            setAvailabilityDraft((rows) => [...rows, emptyAvailabilityRow()]);
          }}
          size="sm"
          type="button"
          variant="secondary"
        >
          <Plus aria-hidden="true" size={14} />
          Add
        </Button>
      </div>

      {availabilityQuery.isLoading ? (
        <div className="empty-state">Loading availability...</div>
      ) : null}
      {availabilityQuery.error ? (
        <p className="status--error">{availabilityQuery.error.message}</p>
      ) : null}

      <div className="availability-editor">
        {availabilityDraft.length === 0 ? (
          <div className="empty-state">No availability set.</div>
        ) : (
          availabilityDraft.map((window) => (
            <div className="availability-editor__row" key={window.id}>
              <Field label="Day">
                <SelectInput
                  aria-label="Availability day"
                  onChange={(event) => {
                    setAvailabilityDraft((rows) =>
                      rows.map((row) =>
                        row.id === window.id
                          ? { ...row, dayOfWeek: Number(event.target.value) }
                          : row,
                      ),
                    );
                  }}
                  value={window.dayOfWeek}
                >
                  {weekdays.map((day) => (
                    <option key={day.value} value={day.value}>
                      {day.label}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="Start">
                <TextInput
                  aria-label="Availability start time"
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
                  aria-label="Availability end time"
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
                aria-label="Remove availability window"
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
          setAvailabilityStatus(null);
          saveAvailability.mutate({
            windows: availabilityDraft.map(({ dayOfWeek, startMinute, endMinute }) => ({
              dayOfWeek,
              startMinute,
              endMinute,
            })),
          });
        }}
        pending={saveAvailability.isPending}
        type="button"
      >
        <Save aria-hidden="true" size={16} />
        Save availability
      </Button>
      {availabilityStatus ? <p className="status--success">{availabilityStatus}</p> : null}
      {saveAvailability.error ? (
        <p className="status--error">{saveAvailability.error.message}</p>
      ) : null}
    </section>
  );
}

'use client';

import { useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Coffee, Plus, Save, Trash2 } from 'lucide-react';
import { findScheduleIssues, type TimetableSlotInput } from '@oasis/domain';
import { Button } from '@/components/ui/button';
import { SelectInput, TextInput } from '@/components/ui/field';
import { formatMinutes, minutesFromTime } from './timetable-format';
import styles from './timetable.module.css';

export interface EditableScheduleSlot extends TimetableSlotInput {
  id?: string;
}

interface ScheduleEditorProps {
  initialSlots: readonly EditableScheduleSlot[];
  onSave: (slots: EditableScheduleSlot[]) => Promise<void>;
  pending: boolean;
  saved: boolean;
}

interface LocalSlot extends EditableScheduleSlot {
  clientKey: string;
}

function nextSlotTimes(slots: readonly LocalSlot[]): { endMinutes: number; startMinutes: number } {
  const startMinutes = slots.at(-1)?.endMinutes ?? 9 * 60;
  return { startMinutes, endMinutes: Math.min(startMinutes + 30, 24 * 60) };
}

export function AgeGroupScheduleEditor({
  initialSlots,
  onSave,
  pending,
  saved,
}: ScheduleEditorProps) {
  const sequence = useRef(0);
  const [slots, setSlots] = useState<LocalSlot[]>(() =>
    initialSlots.map((slot, index) => ({
      ...slot,
      clientKey: slot.id ?? `initial-${String(index)}`,
    })),
  );
  const issues = useMemo(() => findScheduleIssues(slots), [slots]);

  function addSlot(kind: 'Lesson' | 'Break'): void {
    sequence.current += 1;
    const times = nextSlotTimes(slots);
    const matchingCount = slots.filter((slot) => slot.kind === kind).length;
    setSlots((current) => [
      ...current,
      {
        ...times,
        clientKey: `new-${String(sequence.current)}`,
        kind,
        label: kind === 'Break' ? 'Break' : `Lesson ${String(matchingCount + 1)}`,
      },
    ]);
  }

  function updateSlot(index: number, update: Partial<EditableScheduleSlot>): void {
    setSlots((current) =>
      current.map((slot, slotIndex) => (slotIndex === index ? { ...slot, ...update } : slot)),
    );
  }

  function moveSlot(index: number, direction: -1 | 1): void {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= slots.length) return;
    setSlots((current) => {
      const next = [...current];
      const slot = next[index];
      const target = next[nextIndex];
      if (!slot || !target) return current;
      next[index] = target;
      next[nextIndex] = slot;
      return next;
    });
  }

  async function save(): Promise<void> {
    if (issues.length > 0) return;
    await onSave(
      slots.map((slot) => ({
        ...(slot.id ? { id: slot.id } : {}),
        kind: slot.kind,
        label: slot.label,
        startMinutes: slot.startMinutes,
        endMinutes: slot.endMinutes,
      })),
    );
  }

  return (
    <section className={styles.schedulePanel} aria-labelledby="schedule-heading">
      <div className={styles.sectionHeading}>
        <div>
          <p>Shared structure</p>
          <h2 id="schedule-heading">Lesson and break times</h2>
          <span>
            These times are shared by every child in this age group. Drag-free controls keep
            ordering accessible on touch and keyboard.
          </span>
        </div>
        <span className={saved ? styles.savedBadge : styles.draftBadge}>
          {saved ? 'Saved schedule' : 'Default times'}
        </span>
      </div>

      <div className={styles.slotList}>
        {slots.map((slot, index) => {
          const issue = issues.find((candidate) => candidate.position === index);
          return (
            <div className={styles.slotRow} data-kind={slot.kind} key={slot.clientKey}>
              <span className={styles.slotOrder}>{String(index + 1).padStart(2, '0')}</span>
              <SelectInput
                aria-label={`Slot ${String(index + 1)} type`}
                onChange={(event) => {
                  const kind = event.target.value as 'Lesson' | 'Break';
                  updateSlot(index, { kind, label: kind === 'Break' ? 'Break' : slot.label });
                }}
                value={slot.kind}
              >
                <option value="Lesson">Lesson</option>
                <option value="Break">Break</option>
              </SelectInput>
              <TextInput
                aria-label={`Slot ${String(index + 1)} label`}
                onChange={(event) => {
                  updateSlot(index, { label: event.target.value });
                }}
                value={slot.label}
              />
              <label className={styles.timeField}>
                <span>Starts</span>
                <input
                  aria-label={`${slot.label} start time`}
                  onChange={(event) => {
                    updateSlot(index, { startMinutes: minutesFromTime(event.target.value) });
                  }}
                  type="time"
                  value={formatMinutes(slot.startMinutes)}
                />
              </label>
              <label className={styles.timeField}>
                <span>Ends</span>
                <input
                  aria-label={`${slot.label} end time`}
                  onChange={(event) => {
                    updateSlot(index, { endMinutes: minutesFromTime(event.target.value) });
                  }}
                  type="time"
                  value={formatMinutes(slot.endMinutes)}
                />
              </label>
              <div className={styles.slotActions}>
                <Button
                  aria-label={`Move ${slot.label} up`}
                  disabled={index === 0}
                  onClick={() => {
                    moveSlot(index, -1);
                  }}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  <ArrowUp aria-hidden="true" size={16} />
                  <span className={styles.srOnly}>Move up</span>
                </Button>
                <Button
                  aria-label={`Move ${slot.label} down`}
                  disabled={index === slots.length - 1}
                  onClick={() => {
                    moveSlot(index, 1);
                  }}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  <ArrowDown aria-hidden="true" size={16} />
                  <span className={styles.srOnly}>Move down</span>
                </Button>
                <Button
                  aria-label={`Remove ${slot.label}`}
                  disabled={slots.length === 1}
                  onClick={() => {
                    setSlots((current) => current.filter((_, slotIndex) => slotIndex !== index));
                  }}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  <Trash2 aria-hidden="true" size={16} />
                </Button>
              </div>
              {issue ? <small className={styles.slotError}>{issue.message}</small> : null}
            </div>
          );
        })}
      </div>

      <div className={styles.scheduleActions}>
        <div>
          <Button
            onClick={() => {
              addSlot('Lesson');
            }}
            size="sm"
            type="button"
            variant="secondary"
          >
            <Plus aria-hidden="true" size={15} /> Add lesson
          </Button>
          <Button
            onClick={() => {
              addSlot('Break');
            }}
            size="sm"
            type="button"
            variant="secondary"
          >
            <Coffee aria-hidden="true" size={15} /> Add break
          </Button>
        </div>
        <Button
          disabled={issues.length > 0}
          onClick={() => {
            void save().catch(() => undefined);
          }}
          pending={pending}
          type="button"
        >
          <Save aria-hidden="true" size={16} /> Save times
        </Button>
      </div>
    </section>
  );
}

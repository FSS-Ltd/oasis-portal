import { Pencil, Save, Trash2, X } from 'lucide-react';
import type { Role } from '@oasis/domain';
import { roleLabel } from '@/lib/profile-display';
import { Button } from '@/components/ui/button';
import { Field, SelectInput, TextInput } from '@/components/ui/field';
import { type ShiftForm } from './rota-utils';

type RotaStaffMember = {
  fullName: string;
  id: string;
  role: Role;
};

type RotaYearGroupBand = {
  id: string;
  name: string;
};

export type RotaBatchScheduleResult = {
  count: number;
  dates: string[];
  skipped: { date: string; reason: 'closed' | 'unavailable' | 'existingShift' }[];
};

type RotaShiftEditorProps = {
  activeBands: readonly RotaYearGroupBand[];
  availableDates: readonly { label: string; value: string }[];
  dateStatus?: { kind: 'operating' | 'fieldTrip' | 'closed'; label: string } | undefined;
  errorMessage?: string | undefined;
  form: ShiftForm;
  isDeleting: boolean;
  isSaving: boolean;
  onCancel: () => void;
  onChange: (nextForm: ShiftForm) => void;
  onChangeRepeatScope: (repeatScope: 'week' | 'term') => void;
  onChangeSelectedDates: (dates: string[]) => void;
  onDelete: () => void;
  onSubmit: () => void;
  repeatScope: 'week' | 'term';
  selectedDates: readonly string[];
  scheduleResult?: RotaBatchScheduleResult | undefined;
  staff: readonly RotaStaffMember[];
};

function skippedDateReasonLabel(
  reason: RotaBatchScheduleResult['skipped'][number]['reason'],
): string {
  switch (reason) {
    case 'closed':
      return 'Centre closed';
    case 'unavailable':
      return 'Supervisor unavailable';
    default:
      return 'Existing shift';
  }
}

export function RotaShiftEditor({
  activeBands,
  availableDates,
  dateStatus,
  errorMessage,
  form,
  isDeleting,
  isSaving,
  onCancel,
  onChange,
  onChangeRepeatScope,
  onChangeSelectedDates,
  onDelete,
  onSubmit,
  repeatScope,
  scheduleResult,
  selectedDates,
  staff,
}: RotaShiftEditorProps) {
  const canSchedule =
    (dateStatus?.kind === 'operating' || dateStatus?.kind === 'fieldTrip') &&
    (form.id !== null || selectedDates.length > 0);
  return (
    <section aria-labelledby="rota-shift-editor-title" className="panel">
      <div className="panel__body">
        <div className="section-title">
          <div>
            <p className="staff-rota-eyebrow">Staffing action</p>
            <h2 id="rota-shift-editor-title">{form.id ? 'Update shift' : 'Create shift'}</h2>
          </div>
          {form.id ? <span className="badge">Editing</span> : null}
        </div>
        <form
          className="form-grid"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          {dateStatus?.kind === 'closed' ? (
            <p className="status--warning">
              This date is unavailable for rota shifts: {dateStatus.label}.
            </p>
          ) : dateStatus?.kind === 'fieldTrip' ? (
            <p className="status--info">This shift is being scheduled for a planned field trip.</p>
          ) : null}
          <Field label="Supervisor">
            <SelectInput
              onChange={(event) => {
                onChange({ ...form, staffUserId: event.target.value });
              }}
              required
              value={form.staffUserId}
            >
              <option value="">Choose supervisor</option>
              {staff.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.fullName} - {roleLabel(member.role)}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Shift type">
            <SelectInput
              onChange={(event) => {
                const kind = event.target.value === 'Meeting' ? 'Meeting' : 'Cover';
                onChange({
                  ...form,
                  kind,
                  yearGroupBandId: kind === 'Meeting' ? '' : form.yearGroupBandId,
                });
              }}
              required
              value={form.kind}
            >
              <option value="Cover">Year-group cover</option>
              <option value="Meeting">Meeting</option>
            </SelectInput>
          </Field>
          {form.kind === 'Cover' ? (
            <Field label="Year-group band">
              <SelectInput
                onChange={(event) => {
                  onChange({ ...form, yearGroupBandId: event.target.value });
                }}
                required
                value={form.yearGroupBandId}
              >
                <option value="">Choose band</option>
                {activeBands.map((band) => (
                  <option key={band.id} value={band.id}>
                    {band.name}
                  </option>
                ))}
              </SelectInput>
            </Field>
          ) : null}
          {form.id ? (
            <Field label="Date">
              <TextInput
                onChange={(event) => {
                  onChange({ ...form, date: event.target.value });
                }}
                required
                type="date"
                value={form.date}
              />
            </Field>
          ) : (
            <>
              <Field label="Dates" hint="Choose one or more operating days from this week">
                <div className="staff-rota-day-picker">
                  {availableDates.map((date) => {
                    const selected = selectedDates.includes(date.value);
                    return (
                      <label
                        className={`staff-rota-day-picker__day${selected ? ' is-selected' : ''}`}
                        key={date.value}
                      >
                        <input
                          checked={selected}
                          onChange={() => {
                            onChangeSelectedDates(
                              selected
                                ? selectedDates.filter((value) => value !== date.value)
                                : [...selectedDates, date.value],
                            );
                          }}
                          type="checkbox"
                        />
                        {date.label}
                      </label>
                    );
                  })}
                </div>
              </Field>
              <Field
                hint={
                  repeatScope === 'term'
                    ? 'Schedules the selected weekdays through the term and skips unavailable dates.'
                    : 'Schedules only the selected dates this week.'
                }
                label="Repeat"
              >
                <SelectInput
                  onChange={(event) => {
                    onChangeRepeatScope(event.target.value === 'term' ? 'term' : 'week');
                  }}
                  value={repeatScope}
                >
                  <option value="week">This week only</option>
                  <option value="term">Whole term</option>
                </SelectInput>
              </Field>
            </>
          )}
          <div className="form-grid form-grid--two rota-time-grid">
            <Field label="Start time">
              <TextInput
                onChange={(event) => {
                  onChange({ ...form, startsAt: event.target.value });
                }}
                required
                type="time"
                value={form.startsAt}
              />
            </Field>
            <Field label="End time">
              <TextInput
                onChange={(event) => {
                  onChange({ ...form, endsAt: event.target.value });
                }}
                required
                type="time"
                value={form.endsAt}
              />
            </Field>
          </div>
          <Field label="Notes">
            <TextInput
              onChange={(event) => {
                onChange({ ...form, notes: event.target.value });
              }}
              value={form.notes}
            />
          </Field>
          {errorMessage ? <p className="status--error">{errorMessage}</p> : null}
          {scheduleResult ? (
            <section aria-live="polite" className="rota-schedule-result" role="status">
              <strong>
                {scheduleResult.count === 1
                  ? '1 shift scheduled'
                  : `${String(scheduleResult.count)} shifts scheduled`}
              </strong>
              {scheduleResult.skipped.length > 0 ? (
                <div>
                  <span>
                    {scheduleResult.skipped.length === 1
                      ? '1 date skipped'
                      : `${String(scheduleResult.skipped.length)} dates skipped`}
                  </span>
                  <ul>
                    {scheduleResult.skipped.map((skipped) => (
                      <li key={`${skipped.date}-${skipped.reason}`}>
                        {skipped.date}: {skippedDateReasonLabel(skipped.reason)}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <span>All selected dates were scheduled.</span>
              )}
            </section>
          ) : null}
          <div className="row-actions">
            {form.id ? (
              <Button onClick={onCancel} type="button" variant="secondary">
                <X aria-hidden="true" size={16} />
                Cancel
              </Button>
            ) : null}
            {form.id ? (
              <Button onClick={onDelete} pending={isDeleting} type="button" variant="secondary">
                <Trash2 aria-hidden="true" size={16} />
                Remove
              </Button>
            ) : null}
            <Button disabled={!canSchedule} pending={isSaving} type="submit">
              {form.id ? (
                <Pencil aria-hidden="true" size={16} />
              ) : (
                <Save aria-hidden="true" size={16} />
              )}
              {form.id ? 'Update shift' : 'Create shift'}
            </Button>
          </div>
        </form>
      </div>
    </section>
  );
}

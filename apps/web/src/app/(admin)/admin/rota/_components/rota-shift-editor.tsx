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

type RotaShiftEditorProps = {
  activeBands: readonly RotaYearGroupBand[];
  errorMessage?: string | undefined;
  form: ShiftForm;
  isDeleting: boolean;
  isSaving: boolean;
  onCancel: () => void;
  onChange: (nextForm: ShiftForm) => void;
  onDelete: () => void;
  onSubmit: () => void;
  staff: readonly RotaStaffMember[];
};

export function RotaShiftEditor({
  activeBands,
  errorMessage,
  form,
  isDeleting,
  isSaving,
  onCancel,
  onChange,
  onDelete,
  onSubmit,
  staff,
}: RotaShiftEditorProps) {
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
            <Button pending={isSaving} type="submit">
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

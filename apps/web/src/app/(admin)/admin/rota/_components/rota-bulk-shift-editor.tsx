import { ArrowRightLeft, X } from 'lucide-react';
import type { Role } from '@oasis/domain';
import { roleLabel } from '@/lib/profile-display';
import { Button } from '@/components/ui/button';
import { Field, SelectInput } from '@/components/ui/field';

type RotaStaffMember = {
  fullName: string;
  id: string;
  role: Role;
};

type RotaBulkShiftEditorProps = {
  errorMessage?: string | undefined;
  isSaving: boolean;
  onCancel: () => void;
  onSubmit: (staffUserId: string) => void;
  selectedCount: number;
  staff: readonly RotaStaffMember[];
};

export function RotaBulkShiftEditor({
  errorMessage,
  isSaving,
  onCancel,
  onSubmit,
  selectedCount,
  staff,
}: RotaBulkShiftEditorProps) {
  return (
    <section aria-labelledby="rota-bulk-shift-editor-title" className="panel">
      <div className="panel__body rota-bulk-shift-editor">
        <div className="section-title">
          <div>
            <p className="staff-rota-eyebrow">Bulk action</p>
            <h2 id="rota-bulk-shift-editor-title">Reassign selected shifts</h2>
          </div>
          <span className="badge badge--blue">{selectedCount} selected</span>
        </div>
        <p className="muted">
          Move all selected shifts to one supervisor. Dates, times, assignments, and notes stay the
          same.
        </p>
        <form
          className="form-grid"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const staffUserId = data.get('staffUserId');
            if (typeof staffUserId === 'string' && staffUserId) onSubmit(staffUserId);
          }}
        >
          <Field label="Replacement supervisor">
            <SelectInput defaultValue="" name="staffUserId" required>
              <option value="">Choose supervisor</option>
              {staff.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.fullName} - {roleLabel(member.role)}
                </option>
              ))}
            </SelectInput>
          </Field>
          {errorMessage ? <p className="status--error">{errorMessage}</p> : null}
          <div className="row-actions">
            <Button onClick={onCancel} type="button" variant="secondary">
              <X aria-hidden="true" size={16} />
              Cancel
            </Button>
            <Button pending={isSaving} type="submit">
              <ArrowRightLeft aria-hidden="true" size={16} />
              Reassign {selectedCount} shifts
            </Button>
          </div>
        </form>
      </div>
    </section>
  );
}

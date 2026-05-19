'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';

export interface BehaviourStudentOption {
  id: string;
  label: string;
  description?: string | undefined;
}

interface BehaviourStudentSelectorProps {
  disabled?: boolean | undefined;
  hint?: string | undefined;
  label: string;
  loading?: boolean | undefined;
  onChange: (studentIds: string[]) => void;
  options: readonly BehaviourStudentOption[];
  selectedIds: readonly string[];
}

export function BehaviourStudentSelector({
  disabled = false,
  hint,
  label,
  loading = false,
  onChange,
  options,
  selectedIds,
}: BehaviourStudentSelectorProps) {
  const baseId = useId();
  const [open, setOpen] = useState(false);
  const optionById = useMemo(
    () => new Map(options.map((option) => [option.id, option])),
    [options],
  );
  const selectedOptions = selectedIds
    .map((studentId) => optionById.get(studentId))
    .filter((option): option is BehaviourStudentOption => option !== undefined);
  const allSelected = options.length > 0 && selectedOptions.length === options.length;
  const unavailable = disabled || loading;
  const countHint = `${String(selectedOptions.length)} of ${String(options.length)} selected`;

  useEffect(() => {
    if (unavailable) setOpen(false);
  }, [unavailable]);

  function setSelected(nextIds: readonly string[]): void {
    const validIds = nextIds.filter((studentId) => optionById.has(studentId));
    onChange([...new Set(validIds)]);
  }

  function toggleStudent(studentId: string): void {
    if (selectedIds.includes(studentId)) {
      setSelected(selectedIds.filter((selectedId) => selectedId !== studentId));
      return;
    }
    setSelected([...selectedIds, studentId]);
  }

  const buttonLabel =
    selectedOptions.length === 0
      ? 'Choose students'
      : selectedOptions.length === 1
        ? (selectedOptions[0]?.label ?? 'Choose students')
        : `${String(selectedOptions.length)} students selected`;

  return (
    <div className="field behaviour-student-selector-field">
      <span className="field__label" id={`${baseId}-label`}>
        {label}
      </span>
      <div aria-label="Selected students" className="behaviour-selected-student-tags">
        {selectedOptions.length > 0 ? (
          selectedOptions.map((student) => (
            <span className="behaviour-student-tag" key={student.id}>
              <span>{student.label}</span>
              <button
                aria-label={`Remove ${student.label}`}
                disabled={unavailable}
                onClick={() => {
                  setSelected(selectedIds.filter((studentId) => studentId !== student.id));
                }}
                type="button"
              >
                <X aria-hidden="true" size={13} />
              </button>
            </span>
          ))
        ) : (
          <span className="behaviour-student-tags-empty">No students selected</span>
        )}
      </div>
      <div className="behaviour-student-selector">
        <button
          aria-controls={`${baseId}-menu`}
          aria-expanded={open}
          aria-haspopup="true"
          aria-label={`${label} selector`}
          className="input behaviour-student-selector__button"
          disabled={unavailable || options.length === 0}
          onClick={() => {
            setOpen((current) => !current);
          }}
          type="button"
        >
          <span>{loading ? 'Loading students...' : buttonLabel}</span>
          <ChevronDown aria-hidden="true" size={16} />
        </button>
        {open ? (
          <div
            aria-labelledby={`${baseId}-label`}
            className="behaviour-student-selector__menu"
            id={`${baseId}-menu`}
            role="group"
          >
            <div className="behaviour-student-selector__actions">
              <button
                disabled={allSelected || options.length === 0}
                onClick={() => {
                  setSelected(options.map((option) => option.id));
                }}
                type="button"
              >
                Select all
              </button>
              <button
                disabled={selectedOptions.length === 0}
                onClick={() => {
                  setSelected([]);
                }}
                type="button"
              >
                Clear all
              </button>
            </div>
            <div className="behaviour-student-selector__list">
              {options.map((student) => (
                <label className="behaviour-student-option" key={student.id}>
                  <input
                    checked={selectedIds.includes(student.id)}
                    onChange={() => {
                      toggleStudent(student.id);
                    }}
                    type="checkbox"
                  />
                  <span>
                    <strong>{student.label}</strong>
                    {student.description ? <small>{student.description}</small> : null}
                  </span>
                </label>
              ))}
            </div>
          </div>
        ) : null}
      </div>
      <span className="field__hint">{hint ?? countHint}</span>
    </div>
  );
}

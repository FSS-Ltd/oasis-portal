'use client';

import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { displaySchoolYearLabel } from '@oasis/domain';
import { Button } from '@/components/ui/button';
import { Field, SelectInput, TextInput } from '@/components/ui/field';
import type { RouterInputs, RouterOutputs } from '@/lib/trpc';
import { permissionSlipCategories, permissionSlipCategoryLabels } from './permission-slip-ui';

type StudentCandidate = RouterOutputs['permissionSlip']['listStudentCandidates'][number];
type CreateInput = RouterInputs['permissionSlip']['create'];

interface AdminPermissionSlipFormProps {
  creating: boolean;
  onClose: () => void;
  onSubmit: (input: CreateInput) => void;
  students: readonly StudentCandidate[];
}

interface QuestionDraft {
  id: string;
  label: string;
  required: boolean;
}

const defaultConsent =
  'I give permission for my child to take part in this activity. I understand that my child will be supervised by Oasis staff at all times.';

function studentIdsFor(students: readonly StudentCandidate[]): string[] {
  return students.map((student) => student.id);
}

function groupStudentsByYear(
  students: readonly StudentCandidate[],
): Record<string, StudentCandidate[]> {
  return students.reduce<Record<string, StudentCandidate[]>>((groups, student) => {
    groups[student.yearGroup] = [...(groups[student.yearGroup] ?? []), student];
    return groups;
  }, {});
}

function questionsForCreate(questions: readonly QuestionDraft[]): CreateInput['questions'] {
  return questions
    .filter((question) => question.label.trim())
    .map((question) => ({ label: question.label.trim(), required: question.required }));
}

export function AdminPermissionSlipForm({
  creating,
  onClose,
  onSubmit,
  students,
}: AdminPermissionSlipFormProps) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<CreateInput['category']>('SchoolTrip');
  const [recipientLabel, setRecipientLabel] = useState('Years 7-10');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [deadline, setDeadline] = useState('');
  const [departureTime, setDepartureTime] = useState('');
  const [returnTime, setReturnTime] = useState('');
  const [location, setLocation] = useState('');
  const [transport, setTransport] = useState('');
  const [cost, setCost] = useState('');
  const [consentText, setConsentText] = useState(defaultConsent);
  const [requireMedical, setRequireMedical] = useState(true);
  const [requireEmergencyContact, setRequireEmergencyContact] = useState(true);
  const [requirePayment, setRequirePayment] = useState(false);
  const [studentIds, setStudentIds] = useState<string[]>(() => studentIdsFor(students));
  const [bringDraft, setBringDraft] = useState('');
  const [bringItems, setBringItems] = useState<string[]>([]);
  const [questions, setQuestions] = useState<QuestionDraft[]>([]);

  const selectedStudentCount = studentIds.length;
  const canSubmit = title.trim() && deadline && consentText.trim() && selectedStudentCount > 0;
  const studentsByYear = useMemo(() => groupStudentsByYear(students), [students]);

  useEffect(() => {
    setStudentIds((current) =>
      current.length === 0 && students.length > 0 ? studentIdsFor(students) : current,
    );
  }, [students]);

  function toggleStudent(studentId: string) {
    setStudentIds((current) =>
      current.includes(studentId)
        ? current.filter((candidate) => candidate !== studentId)
        : [...current, studentId],
    );
  }

  function addBringItem() {
    const value = bringDraft.trim();
    if (!value) return;
    setBringItems((current) => [...current, value]);
    setBringDraft('');
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit({
      title: title.trim(),
      category,
      description: description.trim() || undefined,
      eventDate: eventDate || undefined,
      deadline,
      departureTime: departureTime || undefined,
      returnTime: returnTime || undefined,
      location: location.trim() || undefined,
      transport: transport.trim() || undefined,
      cost: cost.trim() || undefined,
      consentText: consentText.trim(),
      requireMedical,
      requireEmergencyContact,
      requirePayment,
      recipientLabel: recipientLabel.trim(),
      studentIds,
      bringItems,
      questions: questionsForCreate(questions),
    });
  }

  return (
    <div aria-modal="true" className="permission-modal" role="dialog">
      <button
        aria-label="Close permission slip builder"
        className="permission-modal__backdrop"
        onClick={onClose}
        type="button"
      />
      <form className="permission-modal__panel" onSubmit={submit}>
        <header className="permission-modal__header">
          <div>
            <p>Permission Slips</p>
            <h2>New permission slip</h2>
          </div>
          <button aria-label="Close permission slip builder" onClick={onClose} type="button">
            <X aria-hidden="true" size={18} />
          </button>
        </header>

        <div className="permission-modal__body">
          <section className="permission-form-section">
            <h3>Title and description</h3>
            <div className="form-grid">
              <Field label="Title" required>
                <TextInput
                  onChange={(event) => {
                    setTitle(event.target.value);
                  }}
                  placeholder="Howletts Wild Animal Park"
                  value={title}
                />
              </Field>
              <div className="form-grid form-grid--two">
                <Field label="Category" required>
                  <SelectInput
                    onChange={(event) => {
                      setCategory(event.target.value as CreateInput['category']);
                    }}
                    value={category}
                  >
                    {permissionSlipCategories.map((candidate) => (
                      <option key={candidate} value={candidate}>
                        {permissionSlipCategoryLabels[candidate]}
                      </option>
                    ))}
                  </SelectInput>
                </Field>
                <Field label="Recipient label" required>
                  <TextInput
                    onChange={(event) => {
                      setRecipientLabel(event.target.value);
                    }}
                    value={recipientLabel}
                  />
                </Field>
              </div>
              <Field label="Description">
                <textarea
                  className="input permission-textarea"
                  onChange={(event) => {
                    setDescription(event.target.value);
                  }}
                  rows={4}
                  value={description}
                />
              </Field>
            </div>
          </section>

          <section className="permission-form-section">
            <h3>Event details</h3>
            <div className="form-grid form-grid--two">
              <Field label="Event date">
                <TextInput
                  onChange={(event) => {
                    setEventDate(event.target.value);
                  }}
                  type="date"
                  value={eventDate}
                />
              </Field>
              <Field label="Deadline" required>
                <TextInput
                  onChange={(event) => {
                    setDeadline(event.target.value);
                  }}
                  type="date"
                  value={deadline}
                />
              </Field>
              <Field label="Departure time">
                <TextInput
                  onChange={(event) => {
                    setDepartureTime(event.target.value);
                  }}
                  type="time"
                  value={departureTime}
                />
              </Field>
              <Field label="Return time">
                <TextInput
                  onChange={(event) => {
                    setReturnTime(event.target.value);
                  }}
                  type="time"
                  value={returnTime}
                />
              </Field>
              <Field label="Location">
                <TextInput
                  onChange={(event) => {
                    setLocation(event.target.value);
                  }}
                  value={location}
                />
              </Field>
              <Field label="Transport">
                <TextInput
                  onChange={(event) => {
                    setTransport(event.target.value);
                  }}
                  value={transport}
                />
              </Field>
              <Field label="Cost">
                <TextInput
                  onChange={(event) => {
                    setCost(event.target.value);
                  }}
                  placeholder="GBP 20 or 150 merits"
                  value={cost}
                />
              </Field>
            </div>
          </section>

          <section className="permission-form-section">
            <h3>Required from parents</h3>
            <div className="permission-toggle-grid">
              <label>
                <input
                  checked={requireMedical}
                  onChange={(event) => {
                    setRequireMedical(event.target.checked);
                  }}
                  type="checkbox"
                />
                <span>Medical or allergy information</span>
              </label>
              <label>
                <input
                  checked={requireEmergencyContact}
                  onChange={(event) => {
                    setRequireEmergencyContact(event.target.checked);
                  }}
                  type="checkbox"
                />
                <span>Emergency contact</span>
              </label>
              <label>
                <input
                  checked={requirePayment}
                  onChange={(event) => {
                    setRequirePayment(event.target.checked);
                  }}
                  type="checkbox"
                />
                <span>Payment acknowledgement</span>
              </label>
            </div>
          </section>

          <section className="permission-form-section">
            <h3>What to bring</h3>
            <div className="permission-inline-entry">
              <TextInput
                onChange={(event) => {
                  setBringDraft(event.target.value);
                }}
                placeholder="Packed lunch"
                value={bringDraft}
              />
              <Button onClick={addBringItem} type="button" variant="secondary">
                <Plus aria-hidden="true" size={15} />
                Add
              </Button>
            </div>
            {bringItems.length > 0 ? (
              <div className="permission-chip-list">
                {bringItems.map((item) => (
                  <span key={item}>
                    {item}
                    <button
                      aria-label={`Remove ${item}`}
                      onClick={() => {
                        setBringItems((current) =>
                          current.filter((candidate) => candidate !== item),
                        );
                      }}
                      type="button"
                    >
                      <X aria-hidden="true" size={13} />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
          </section>

          <section className="permission-form-section">
            <div className="permission-form-section__head">
              <h3>Custom questions</h3>
              <Button
                onClick={() => {
                  setQuestions((current) => [
                    ...current,
                    { id: crypto.randomUUID(), label: '', required: true },
                  ]);
                }}
                size="sm"
                type="button"
                variant="secondary"
              >
                <Plus aria-hidden="true" size={14} />
                Add question
              </Button>
            </div>
            {questions.length === 0 ? (
              <p className="permission-muted">No custom questions added.</p>
            ) : (
              <div className="permission-question-list">
                {questions.map((question) => (
                  <div className="permission-question-draft" key={question.id}>
                    <TextInput
                      aria-label="Question"
                      onChange={(event) => {
                        setQuestions((current) =>
                          current.map((candidate) =>
                            candidate.id === question.id
                              ? { ...candidate, label: event.target.value }
                              : candidate,
                          ),
                        );
                      }}
                      placeholder="Question text"
                      value={question.label}
                    />
                    <label>
                      <input
                        checked={question.required}
                        onChange={(event) => {
                          setQuestions((current) =>
                            current.map((candidate) =>
                              candidate.id === question.id
                                ? { ...candidate, required: event.target.checked }
                                : candidate,
                            ),
                          );
                        }}
                        type="checkbox"
                      />
                      Required
                    </label>
                    <button
                      aria-label="Remove question"
                      onClick={() => {
                        setQuestions((current) =>
                          current.filter((candidate) => candidate.id !== question.id),
                        );
                      }}
                      type="button"
                    >
                      <Trash2 aria-hidden="true" size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="permission-form-section">
            <h3>Consent statement</h3>
            <textarea
              className="input permission-textarea"
              onChange={(event) => {
                setConsentText(event.target.value);
              }}
              rows={4}
              value={consentText}
            />
          </section>

          <section className="permission-form-section">
            <h3>Recipients</h3>
            <div className="permission-recipient-tools">
              <span>{selectedStudentCount} selected</span>
              <Button
                onClick={() => {
                  setStudentIds(students.map((student) => student.id));
                }}
                size="sm"
                type="button"
                variant="ghost"
              >
                All
              </Button>
              <Button
                onClick={() => {
                  setStudentIds([]);
                }}
                size="sm"
                type="button"
                variant="ghost"
              >
                None
              </Button>
            </div>
            <div className="permission-recipient-grid">
              {Object.entries(studentsByYear).map(([yearGroup, rows]) => (
                <div className="permission-recipient-year" key={yearGroup}>
                  <strong>{displaySchoolYearLabel(yearGroup)}</strong>
                  {rows.map((student) => (
                    <label key={student.id}>
                      <input
                        checked={studentIds.includes(student.id)}
                        onChange={() => {
                          toggleStudent(student.id);
                        }}
                        type="checkbox"
                      />
                      <span>{student.fullName}</span>
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </section>
        </div>

        <footer className="permission-modal__footer">
          <Button onClick={onClose} type="button" variant="ghost">
            Cancel
          </Button>
          <Button disabled={!canSubmit} pending={creating} type="submit">
            Send to {selectedStudentCount} families
          </Button>
        </footer>
      </form>
    </div>
  );
}

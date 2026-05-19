'use client';

import { type CSSProperties, type FormEvent, useMemo, useState } from 'react';
import { Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, SelectInput, TextInput } from '@/components/ui/field';
import { dateInputValue, scoreLabel, scoreTone } from './pace-workflow-utils';

export interface EditablePaceSubject {
  subjectId: string;
  code: string;
  name: string;
  active?: boolean | undefined;
}

export interface EditablePaceRecord {
  id: string;
  completedAt: Date | string | null;
  createdAt: Date | string;
  paceNumber: number;
  score: number;
  startedAt: Date | string | null;
  studentName?: string | undefined;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  testType: string;
}

interface PaceRecordEditModalProps {
  errorMessage?: string | undefined;
  onClose: () => void;
  onSave: (input: {
    completedAt: string;
    paceNumber: number;
    recordId: string;
    score: number;
    startedAt: string;
    subjectId: string;
  }) => Promise<void>;
  pending: boolean;
  record: EditablePaceRecord;
  subjects: readonly EditablePaceSubject[];
}

export function PaceRecordEditModal({
  errorMessage,
  onClose,
  onSave,
  pending,
  record,
  subjects,
}: PaceRecordEditModalProps) {
  const [subjectId, setSubjectId] = useState(record.subjectId);
  const [paceNumber, setPaceNumber] = useState(String(record.paceNumber));
  const [score, setScore] = useState(String(record.score));
  const [completedAt, setCompletedAt] = useState(
    dateInputValue(record.completedAt ?? record.createdAt),
  );
  const [startedAt, setStartedAt] = useState(
    dateInputValue(record.startedAt ?? record.completedAt ?? record.createdAt),
  );
  const scoreNumber = score.trim() === '' ? null : Number(score);
  const validScore =
    scoreNumber !== null && Number.isFinite(scoreNumber) && scoreNumber >= 0 && scoreNumber <= 100;
  const validPaceNumber = Number.isInteger(Number(paceNumber)) && Number(paceNumber) > 0;
  const subjectOptions =
    subjects.length > 0
      ? subjects
      : [
          {
            subjectId: record.subjectId,
            code: record.subjectCode,
            name: record.subjectName,
            active: true,
          },
        ];
  const tone = scoreTone(scoreNumber);
  const ringStyle = useMemo(
    () =>
      ({
        '--score-percent': `${String(validScore ? scoreNumber : 0)}%`,
      }) as CSSProperties,
    [scoreNumber, validScore],
  );

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!validScore || !validPaceNumber) return;
    await onSave({
      completedAt,
      paceNumber: Number(paceNumber),
      recordId: record.id,
      score: scoreNumber,
      startedAt,
      subjectId,
    });
  }

  return (
    <div aria-modal="true" className="pace-modal-backdrop" role="dialog">
      <form
        className="pace-modal"
        onSubmit={(event) => {
          void submit(event);
        }}
      >
        <header className="pace-modal__header">
          <div>
            <h2>Update PACE Score</h2>
            <p>
              {record.studentName ? `${record.studentName} · ` : ''}
              {record.subjectName} · PACE #{String(record.paceNumber)} · {record.testType}
            </p>
          </div>
          <Button onClick={onClose} size="sm" type="button" variant="ghost">
            <X aria-hidden="true" size={16} />
            <span className="sr-only">Close</span>
          </Button>
        </header>

        <div className="pace-modal__body">
          <div className="form-grid form-grid--two">
            <Field label="Subject">
              <SelectInput
                aria-label="PACE subject"
                onChange={(event) => {
                  setSubjectId(event.target.value);
                }}
                value={subjectId}
              >
                {subjectOptions.map((subject) => (
                  <option
                    disabled={subject.active === false}
                    key={subject.subjectId}
                    value={subject.subjectId}
                  >
                    {subject.code} · {subject.name}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label="PACE number">
              <TextInput
                aria-label="PACE number"
                min={1}
                onChange={(event) => {
                  setPaceNumber(event.target.value);
                }}
                required
                type="number"
                value={paceNumber}
              />
            </Field>
          </div>

          <div className="pace-score-entry">
            <div className={`pace-score-ring pace-score-ring--${tone}`} style={ringStyle}>
              <strong>{validScore ? String(scoreNumber) : '-'}</strong>
              <span>/ 100</span>
            </div>
            <Field label="Score (%)" hint={scoreLabel(validScore ? scoreNumber : null)}>
              <TextInput
                aria-label="PACE score"
                max={100}
                min={0}
                onChange={(event) => {
                  setScore(event.target.value);
                }}
                required
                step="0.1"
                type="number"
                value={score}
              />
            </Field>
          </div>

          <div className="form-grid form-grid--two">
            <Field label="Completion date">
              <TextInput
                aria-label="PACE completion date"
                onChange={(event) => {
                  setCompletedAt(event.target.value);
                }}
                required
                type="date"
                value={completedAt}
              />
            </Field>
            <Field label="Started date">
              <TextInput
                aria-label="PACE started date"
                onChange={(event) => {
                  setStartedAt(event.target.value);
                }}
                required
                type="date"
                value={startedAt}
              />
            </Field>
          </div>

          <div className="pace-modal__summary">
            <span>Existing record</span>
            <strong>
              {record.subjectCode} #{String(record.paceNumber)} · {record.testType}
            </strong>
          </div>

          {errorMessage ? <p className="status--error">{errorMessage}</p> : null}
        </div>

        <footer className="pace-modal__footer">
          <Button disabled={pending} onClick={onClose} type="button" variant="secondary">
            Cancel
          </Button>
          <Button disabled={!validScore || !validPaceNumber} pending={pending} type="submit">
            <Save aria-hidden="true" size={16} />
            Update Score
          </Button>
        </footer>
      </form>
    </div>
  );
}

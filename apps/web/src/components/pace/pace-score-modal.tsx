'use client';

import { type CSSProperties, type FormEvent, useMemo, useState } from 'react';
import { Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, SelectInput, TextInput } from '@/components/ui/field';
import {
  scoreLabel,
  scoreTone,
  type PaceSubject,
  type PaceTestType,
} from './pace-workflow-utils';

interface PaceScoreModalProps {
  canEditDate: boolean;
  completedDate: string;
  errorMessage?: string | undefined;
  onClose: () => void;
  onSave: (input: {
    completedAt: string;
    paceNumber: number;
    score: number;
    subjectId: string;
    testType: PaceTestType;
  }) => Promise<void>;
  pending: boolean;
  studentName: string;
  studentYearLabel: string;
  subject: PaceSubject;
  subjects: readonly PaceSubject[];
}

export function PaceScoreModal({
  canEditDate,
  completedDate,
  errorMessage,
  onClose,
  onSave,
  pending,
  studentName,
  studentYearLabel,
  subject,
  subjects,
}: PaceScoreModalProps) {
  const [subjectId, setSubjectId] = useState(subject.subjectId);
  const [paceNumber, setPaceNumber] = useState(String(subject.currentPaceNumber));
  const [score, setScore] = useState('');
  const [testType, setTestType] = useState<PaceTestType>('SelfTest');
  const [date, setDate] = useState(completedDate);
  const selectedSubject = subjects.find((item) => item.subjectId === subjectId) ?? subject;
  const scoreNumber = score.trim() === '' ? null : Number(score);
  const validScore = scoreNumber !== null && Number.isInteger(scoreNumber) && scoreNumber >= 0 && scoreNumber <= 100;
  const validPaceNumber = Number.isInteger(Number(paceNumber)) && Number(paceNumber) > 0;
  const tone = scoreTone(scoreNumber);
  const ringStyle = useMemo(
    () => ({
      '--score-percent': `${String(validScore ? scoreNumber : 0)}%`,
    }) as CSSProperties,
    [scoreNumber, validScore],
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validScore || !validPaceNumber) return;
    await onSave({
      completedAt: date,
      paceNumber: Number(paceNumber),
      score: scoreNumber,
      subjectId,
      testType,
    });
  }

  return (
    <div
      aria-modal="true"
      className="pace-modal-backdrop"
      role="dialog"
    >
      <form className="pace-modal" onSubmit={(event) => { void submit(event); }}>
        <header className="pace-modal__header">
          <div>
            <h2>Update PACE Score</h2>
            <p>
              {studentName} · {studentYearLabel}
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
                  const next = subjects.find((item) => item.subjectId === event.target.value);
                  setSubjectId(event.target.value);
                  if (next) setPaceNumber(String(next.currentPaceNumber));
                }}
                value={subjectId}
              >
                {subjects.map((item) => (
                  <option disabled={!item.active} key={item.subjectId} value={item.subjectId}>
                    {item.code} · {item.name}
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

          <Field label="Test type">
            <div aria-label="PACE test type" className="pace-test-toggle" role="group">
              {(['SelfTest', 'FinalTest'] as const).map((item) => (
                <button
                  className={testType === item ? 'is-selected' : undefined}
                  key={item}
                  onClick={() => {
                    setTestType(item);
                  }}
                  type="button"
                >
                  {item === 'SelfTest' ? 'Self-Test' : 'PACE Test'}
                </button>
              ))}
            </div>
          </Field>

          <div className="pace-score-entry">
            <div className={`pace-score-ring pace-score-ring--${tone}`} style={ringStyle}>
              <strong>{validScore ? String(scoreNumber) : '-'}</strong>
              <span>/ 100</span>
            </div>
            <Field label="Score (%)" hint={scoreLabel(scoreNumber)}>
              <TextInput
                aria-label="PACE score"
                max={100}
                min={0}
                onChange={(event) => {
                  setScore(event.target.value);
                }}
                placeholder="0-100"
                required
                type="number"
                value={score}
              />
            </Field>
          </div>

          <div className="form-grid form-grid--two">
            <Field label="Completion date">
              <TextInput
                aria-label="PACE completion date"
                disabled={!canEditDate}
                onChange={(event) => {
                  setDate(event.target.value);
                }}
                required
                type="date"
                value={date}
              />
            </Field>
            <div className="pace-modal__summary">
              <span>Current subject PACE</span>
              <strong>
                {selectedSubject.code} #{String(selectedSubject.currentPaceNumber)}
              </strong>
            </div>
          </div>

          {errorMessage ? <p className="status--error">{errorMessage}</p> : null}
        </div>

        <footer className="pace-modal__footer">
          <Button disabled={pending} onClick={onClose} type="button" variant="secondary">
            Cancel
          </Button>
          <Button disabled={!validScore || !validPaceNumber} pending={pending} type="submit">
            <Save aria-hidden="true" size={16} />
            Save Score
          </Button>
        </footer>
      </form>
    </div>
  );
}

'use client';

import { type CSSProperties, type FormEvent, useEffect, useMemo, useState } from 'react';
import { Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, SelectInput, TextInput } from '@/components/ui/field';
import {
  dateInputValue,
  scoreLabel,
  scoreTone,
  type PaceSubject,
  type PaceTestType,
} from './pace-workflow-utils';

type PaceEditableRecord = NonNullable<PaceSubject['currentScoreRecord']>;

interface PaceScoreModalProps {
  canEditDate: boolean;
  completedDate: string;
  errorMessage?: string | undefined;
  initialRecord?: PaceEditableRecord | undefined;
  initialTestType?: PaceTestType | undefined;
  mode: 'create' | 'update';
  onClose: () => void;
  onSave: (input: {
    completedAt: string;
    paceNumber: number;
    recordId?: string | undefined;
    score: number;
    startedAt?: string | undefined;
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
  initialRecord,
  initialTestType,
  mode,
  onClose,
  onSave,
  pending,
  studentName,
  studentYearLabel,
  subject,
  subjects,
}: PaceScoreModalProps) {
  const isUpdateMode = mode === 'update' && initialRecord !== undefined;
  const [subjectId, setSubjectId] = useState(subject.subjectId);
  const [paceNumber, setPaceNumber] = useState(
    isUpdateMode ? String(initialRecord.paceNumber) : String(subject.currentPaceNumber),
  );
  const [score, setScore] = useState(isUpdateMode ? String(initialRecord.score) : '');
  const [testType, setTestType] = useState<PaceTestType>(
    isUpdateMode ? initialRecord.testType : (initialTestType ?? 'SelfTest'),
  );
  const [date, setDate] = useState(
    isUpdateMode
      ? dateInputValue(initialRecord.completedAt ?? initialRecord.createdAt)
      : completedDate,
  );
  const [startedDate, setStartedDate] = useState(
    isUpdateMode
      ? dateInputValue(
          initialRecord.startedAt ?? initialRecord.completedAt ?? initialRecord.createdAt,
        )
      : completedDate,
  );
  const selectedSubject = subjects.find((item) => item.subjectId === subjectId) ?? subject;
  const scoreNumber = score.trim() === '' ? null : Number(score);
  const paceNumberValue = Number(paceNumber);
  const validScore =
    scoreNumber !== null && Number.isFinite(scoreNumber) && scoreNumber >= 0 && scoreNumber <= 100;
  const validPaceNumber = Number.isInteger(paceNumberValue) && paceNumberValue > 0;
  const finalTestPrerequisiteMet =
    validPaceNumber && selectedSubject.selfTestPaceNumbers.includes(paceNumberValue);
  const selfTestAlreadyRecorded = !isUpdateMode && finalTestPrerequisiteMet;
  const selfTestDisabled = selfTestAlreadyRecorded;
  const finalTestDisabled = !isUpdateMode && !finalTestPrerequisiteMet;
  const selectedTestTypeDisabled =
    (testType === 'SelfTest' && selfTestDisabled) ||
    (testType === 'FinalTest' && finalTestDisabled);
  const saveDisabled = !validScore || !validPaceNumber || selectedTestTypeDisabled;
  const testTypeHint = selfTestDisabled
    ? 'A Self-Test already exists for this PACE number. Record a PACE Test instead.'
    : finalTestDisabled
      ? 'Add a Self-Test for this subject PACE number before adding a PACE Test.'
      : undefined;
  const tone = scoreTone(scoreNumber);
  const ringStyle = useMemo(
    () =>
      ({
        '--score-percent': `${String(validScore ? scoreNumber : 0)}%`,
      }) as CSSProperties,
    [scoreNumber, validScore],
  );

  useEffect(() => {
    if (testType === 'SelfTest' && selfTestDisabled) {
      setTestType('FinalTest');
      return;
    }
    if (testType === 'FinalTest' && finalTestDisabled) {
      setTestType('SelfTest');
    }
  }, [finalTestDisabled, selfTestDisabled, testType]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saveDisabled) {
      return;
    }
    await onSave({
      completedAt: date,
      paceNumber: paceNumberValue,
      recordId: isUpdateMode ? initialRecord.id : undefined,
      score: scoreNumber,
      startedAt: isUpdateMode ? startedDate : undefined,
      subjectId,
      testType,
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
            <h2>{isUpdateMode ? 'Update PACE Score' : 'Record PACE Score'}</h2>
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
                  if (!isUpdateMode && next) setPaceNumber(String(next.currentPaceNumber));
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

          <Field hint={testTypeHint} label="Test type">
            <div aria-label="PACE test type" className="pace-test-toggle" role="group">
              {(['SelfTest', 'FinalTest'] as const).map((item) => (
                <button
                  className={testType === item ? 'is-selected' : undefined}
                  disabled={
                    isUpdateMode ||
                    (item === 'SelfTest' && selfTestDisabled) ||
                    (item === 'FinalTest' && finalTestDisabled)
                  }
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
            <Field label="Score (%)" hint={scoreLabel(validScore ? scoreNumber : null)}>
              <TextInput
                aria-label="PACE score"
                max={100}
                min={0}
                onChange={(event) => {
                  setScore(event.target.value);
                }}
                placeholder="0-100"
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
                disabled={!canEditDate}
                onChange={(event) => {
                  setDate(event.target.value);
                }}
                required
                type="date"
                value={date}
              />
            </Field>
            {isUpdateMode ? (
              <Field label="Started date">
                <TextInput
                  aria-label="PACE started date"
                  disabled={!canEditDate}
                  onChange={(event) => {
                    setStartedDate(event.target.value);
                  }}
                  required
                  type="date"
                  value={startedDate}
                />
              </Field>
            ) : (
              <div className="pace-modal__summary">
                <span>Current subject PACE</span>
                <strong>
                  {selectedSubject.code} #{String(selectedSubject.currentPaceNumber)}
                </strong>
              </div>
            )}
          </div>

          {isUpdateMode ? (
            <div className="pace-modal__summary">
              <span>Existing record</span>
              <strong>
                {subject.code} #{String(initialRecord.paceNumber)} ·{' '}
                {initialRecord.testType === 'SelfTest' ? 'Self-Test' : 'PACE Test'}
              </strong>
            </div>
          ) : null}

          {errorMessage ? <p className="status--error">{errorMessage}</p> : null}
        </div>

        <footer className="pace-modal__footer">
          <Button disabled={pending} onClick={onClose} type="button" variant="secondary">
            Cancel
          </Button>
          <Button disabled={saveDisabled} pending={pending} type="submit">
            <Save aria-hidden="true" size={16} />
            {isUpdateMode ? 'Update Score' : 'Save Score'}
          </Button>
        </footer>
      </form>
    </div>
  );
}

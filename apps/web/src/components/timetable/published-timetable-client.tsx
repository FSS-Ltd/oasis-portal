'use client';

import { useEffect, useState } from 'react';
import { CalendarRange, Eye } from 'lucide-react';
import { ParentChildSelector } from '@/components/parent/parent-child-selector';
import { EmptyState } from '@/components/ui/empty-state';
import { SelectInput } from '@/components/ui/field';
import { friendlyErrorMessage } from '@/lib/notifications';
import { api, type RouterOutputs } from '@/lib/trpc';
import { formatTermDates } from './timetable-format';
import { PublishedTimetableView } from './published-timetable-view';
import styles from './timetable.module.css';

type TeachingTerm = RouterOutputs['timetable']['terms'][number];

interface PublishedTimetableClientProps {
  mode: 'parent' | 'student';
}

function initialTermKey(terms: readonly TeachingTerm[], now = new Date()): string {
  const nowTime = now.getTime();
  return (
    terms.find(
      (term) =>
        new Date(term.startsOn).getTime() <= nowTime && new Date(term.endsOn).getTime() >= nowTime,
    )?.key ??
    terms.find((term) => new Date(term.startsOn).getTime() > nowTime)?.key ??
    terms.at(-1)?.key ??
    ''
  );
}

export function PublishedTimetableClient({ mode }: PublishedTimetableClientProps) {
  const termsQuery = api.timetable.terms.useQuery(undefined, { retry: false });
  const childrenQuery = api.childLog.listAccessibleStudents.useQuery(
    { linkedOnly: true },
    { enabled: mode === 'parent', retry: false },
  );
  const [termKey, setTermKey] = useState('');
  const [studentId, setStudentId] = useState('');
  const terms = termsQuery.data ?? [];
  const children = childrenQuery.data ?? [];

  useEffect(() => {
    if (!termKey && terms.length > 0) setTermKey(initialTermKey(terms));
  }, [termKey, terms]);

  useEffect(() => {
    if (mode !== 'parent' || children.length === 0) return;
    if (!children.some((child) => child.id === studentId)) setStudentId(children[0]?.id ?? '');
  }, [children, mode, studentId]);

  const parentPublication = api.timetable.publishedForParent.useQuery(
    { studentId, termKey },
    { enabled: mode === 'parent' && studentId.length > 0 && termKey.length > 0, retry: false },
  );
  const studentPublication = api.timetable.publishedForStudent.useQuery(
    { termKey },
    { enabled: mode === 'student' && termKey.length > 0, retry: false },
  );
  const publicationQuery = mode === 'parent' ? parentPublication : studentPublication;
  const selectedTerm = terms.find((term) => term.key === termKey) ?? null;

  return (
    <div className={styles.page}>
      <header className={styles.readOnlyHero}>
        <div>
          <p>{mode === 'parent' ? 'Parent portal' : 'Student portal'}</p>
          <h1>Timetable</h1>
          <span>Your published Tuesday–Friday lesson plan, kept clear and easy to scan.</span>
        </div>
        <span className={styles.viewOnlyBadge}>
          <Eye aria-hidden="true" size={16} /> View only
        </span>
      </header>

      <section className={styles.viewerControls}>
        {mode === 'parent' && children.length > 0 ? (
          <ParentChildSelector
            children={children}
            onSelect={setStudentId}
            selectedChildId={studentId}
          />
        ) : null}
        <label>
          <span>Teaching term</span>
          <SelectInput
            disabled={terms.length === 0}
            onChange={(event) => {
              setTermKey(event.target.value);
            }}
            value={termKey}
          >
            {terms.map((term) => (
              <option key={term.key} value={term.key}>
                {term.academicYearLabel} · {term.label}
              </option>
            ))}
          </SelectInput>
        </label>
        {selectedTerm ? (
          <span className={styles.termDates}>
            <CalendarRange aria-hidden="true" size={16} />
            {formatTermDates(selectedTerm.startsOn, selectedTerm.endsOn)}
          </span>
        ) : null}
      </section>

      {termsQuery.error || childrenQuery.error || publicationQuery.error ? (
        <div className={styles.errorCard}>
          {friendlyErrorMessage(termsQuery.error ?? childrenQuery.error ?? publicationQuery.error)}
        </div>
      ) : termsQuery.isLoading || publicationQuery.isLoading ? (
        <div className={styles.loadingCard}>Loading the published timetable…</div>
      ) : mode === 'parent' && children.length === 0 ? (
        <EmptyState
          detail="No active child is linked to this account."
          title="No linked children"
        />
      ) : publicationQuery.data ? (
        <PublishedTimetableView publication={publicationQuery.data} />
      ) : (
        <EmptyState
          detail="The Head has not published a timetable for this child and term yet."
          title="No published timetable"
        />
      )}
    </div>
  );
}

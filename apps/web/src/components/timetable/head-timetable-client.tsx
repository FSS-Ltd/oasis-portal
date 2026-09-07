'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarRange, CheckCircle2, UsersRound } from 'lucide-react';
import { REGISTRATION_LEVELS, type TimetableRegistrationLevel } from '@oasis/domain';
import { EmptyState } from '@/components/ui/empty-state';
import { SelectInput } from '@/components/ui/field';
import { friendlyErrorMessage, showErrorToast, showSuccessToast } from '@/lib/notifications';
import { api, type RouterOutputs } from '@/lib/trpc';
import { AgeGroupScheduleEditor, type EditableScheduleSlot } from './age-group-schedule-editor';
import { StudentTimetableEditor } from './student-timetable-editor';
import type { TimetableGridSlot } from './timetable-grid';
import { formatTermDates } from './timetable-format';
import styles from './timetable.module.css';

type TeachingTerm = RouterOutputs['timetable']['terms'][number];
type Workspace = RouterOutputs['timetable']['headWorkspace'];

function preferredTermKey(terms: readonly TeachingTerm[], now = new Date()): string {
  const timestamp = now.getTime();
  return (
    terms.find(
      (term) =>
        new Date(term.startsOn).getTime() <= timestamp &&
        new Date(term.endsOn).getTime() >= timestamp,
    )?.key ??
    terms.find((term) => new Date(term.startsOn).getTime() > timestamp)?.key ??
    terms.at(-1)?.key ??
    ''
  );
}

function scheduleSlots(workspace: Workspace): TimetableGridSlot[] {
  return (
    workspace.schedule?.slots.map((slot) => ({
      id: slot.id,
      position: slot.position,
      kind: slot.kind,
      label: slot.label,
      startMinutes: slot.startMinutes,
      endMinutes: slot.endMinutes,
    })) ?? []
  );
}

export function HeadTimetableClient() {
  const utils = api.useUtils();
  const termsQuery = api.timetable.terms.useQuery(undefined, { retry: false });
  const terms = termsQuery.data ?? [];
  const [termKey, setTermKey] = useState('');
  const [registrationLevel, setRegistrationLevel] = useState<TimetableRegistrationLevel>('ABC');
  const [selectedStudentId, setSelectedStudentId] = useState('');

  useEffect(() => {
    if (!termKey && terms.length > 0) setTermKey(preferredTermKey(terms));
  }, [termKey, terms]);

  const workspaceQuery = api.timetable.headWorkspace.useQuery(
    { termKey, registrationLevel },
    { enabled: termKey.length > 0, retry: false },
  );
  const workspace = workspaceQuery.data;
  const children = useMemo(() => workspace?.children ?? [], [workspace?.children]);
  const ownTimetableChildren = workspace?.ownTimetableChildren ?? [];

  useEffect(() => {
    if (children.length === 0) {
      setSelectedStudentId('');
      return;
    }
    if (!children.some((child) => child.id === selectedStudentId)) {
      setSelectedStudentId(children[0]?.id ?? '');
    }
  }, [children, selectedStudentId]);

  const draftQuery = api.timetable.studentDraft.useQuery(
    { studentId: selectedStudentId, termKey },
    { enabled: Boolean(workspace?.schedule && selectedStudentId && termKey), retry: false },
  );

  const saveSchedule = api.timetable.saveSchedule.useMutation({
    async onSuccess() {
      showSuccessToast('Shared timetable times saved.');
      await Promise.all([
        utils.timetable.headWorkspace.invalidate({ termKey, registrationLevel }),
        utils.timetable.studentDraft.invalidate({ termKey }),
      ]);
    },
    onError(error) {
      showErrorToast(error, 'The timetable times could not be saved.');
    },
  });
  const saveDraft = api.timetable.saveDraft.useMutation({
    async onSuccess() {
      showSuccessToast('Timetable draft saved.');
      await Promise.all([
        utils.timetable.studentDraft.invalidate({ studentId: selectedStudentId, termKey }),
        utils.timetable.headWorkspace.invalidate({ termKey, registrationLevel }),
      ]);
    },
    onError(error) {
      showErrorToast(error, 'The timetable draft could not be saved.');
    },
  });
  const createSubject = api.timetable.createAndAssignSubject.useMutation({
    async onSuccess(subject) {
      showSuccessToast(`${subject.name} added for this child.`);
      await utils.timetable.studentDraft.invalidate({ studentId: selectedStudentId, termKey });
    },
    onError(error) {
      showErrorToast(error, 'The subject could not be added.');
    },
  });
  const publish = api.timetable.publish.useMutation();
  const setMembership = api.timetable.setMembership.useMutation({
    async onSuccess(_, variables) {
      if (variables.studentId === selectedStudentId) setSelectedStudentId('');
      showSuccessToast(
        variables.isOwnTimetable
          ? 'Child moved to N/A and removed from timetable tasks.'
          : `Child returned to ${variables.registrationLevel ?? registrationLevel}.`,
      );
      await Promise.all([
        utils.timetable.headWorkspace.invalidate({ termKey, registrationLevel }),
        utils.personalTask.list.invalidate(),
      ]);
    },
    onError(error) {
      showErrorToast(error, 'The child’s timetable status could not be changed.');
    },
  });

  async function handleScheduleSave(slots: EditableScheduleSlot[]): Promise<void> {
    await saveSchedule.mutateAsync({ termKey, registrationLevel, slots });
  }

  async function handlePublish(): Promise<void> {
    if (!selectedStudentId) return;
    try {
      const result = await publish.mutateAsync({
        studentId: selectedStudentId,
        termKey,
        acknowledgeUnassigned: false,
      });
      await afterPublish(result.publication.studentFirstName);
    } catch (error) {
      const message = friendlyErrorMessage(error, 'The timetable could not be published.');
      if (!message.includes('lesson periods have no subject')) {
        showErrorToast(error, 'The timetable could not be published.');
        return;
      }
      const acknowledgeUnassigned = window.confirm(
        `${message}\n\nMissing subjects are only a suggestion. Publish anyway?`,
      );
      if (!acknowledgeUnassigned) return;
      try {
        const result = await publish.mutateAsync({
          studentId: selectedStudentId,
          termKey,
          acknowledgeUnassigned,
        });
        await afterPublish(result.publication.studentFirstName);
      } catch (retryError) {
        showErrorToast(retryError, 'The timetable could not be published.');
      }
    }
  }

  async function afterPublish(firstName: string): Promise<void> {
    showSuccessToast(`${firstName}’s timetable is published.`);
    await Promise.all([
      utils.timetable.studentDraft.invalidate({ studentId: selectedStudentId, termKey }),
      utils.timetable.headWorkspace.invalidate({ termKey, registrationLevel }),
      utils.personalTask.list.invalidate(),
    ]);
  }

  if (termsQuery.isLoading) {
    return <div className={styles.loadingCard}>Loading timetable terms…</div>;
  }

  if (termsQuery.error) {
    return <div className={styles.errorCard}>{friendlyErrorMessage(termsQuery.error)}</div>;
  }

  if (terms.length === 0) {
    return (
      <EmptyState
        detail="Add the term start and end dates to the calendar before building timetables."
        title="No teaching terms found"
      />
    );
  }

  const selectedTerm = terms.find((term) => term.key === termKey) ?? terms[0];

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div>
          <p>Learning &amp; progress</p>
          <h1>Timetable studio</h1>
          <span>
            Set shared age-group times, then compose and publish a timetable for each child.
          </span>
        </div>
        <div className={styles.heroControls}>
          <label>
            <span>Teaching term</span>
            <SelectInput
              onChange={(event) => {
                setTermKey(event.target.value);
                setSelectedStudentId('');
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
        </div>
      </header>

      <nav aria-label="Age groups" className={styles.ageTabs}>
        {REGISTRATION_LEVELS.map((level) => (
          <button
            aria-current={registrationLevel === level ? 'page' : undefined}
            className={registrationLevel === level ? styles.activeAgeTab : undefined}
            key={level}
            onClick={() => {
              setRegistrationLevel(level);
              setSelectedStudentId('');
            }}
            type="button"
          >
            {level}
          </button>
        ))}
      </nav>

      {workspaceQuery.error ? (
        <div className={styles.errorCard}>{friendlyErrorMessage(workspaceQuery.error)}</div>
      ) : workspaceQuery.isLoading || !workspace ? (
        <div className={styles.loadingCard}>Preparing {registrationLevel}…</div>
      ) : (
        <>
          <div className={styles.progressStrip}>
            <span>
              <CheckCircle2 aria-hidden="true" size={18} />
              <strong>
                {String(workspace.progress.done)}/{String(workspace.progress.total)} published
              </strong>
            </span>
            <span>
              <UsersRound aria-hidden="true" size={18} />
              {String(workspace.children.length)} children in {registrationLevel}
            </span>
          </div>

          <AgeGroupScheduleEditor
            initialSlots={workspace.schedule?.slots ?? workspace.defaultSlots}
            key={`${termKey}-${registrationLevel}-${JSON.stringify(workspace.schedule?.slots ?? [])}`}
            onSave={handleScheduleSave}
            pending={saveSchedule.isPending}
            saved={Boolean(workspace.schedule)}
          />

          <section className={styles.childrenPanel}>
            <div className={styles.sectionHeading}>
              <div>
                <p>Child timetables</p>
                <h2>Choose a child</h2>
              </div>
            </div>
            {children.length === 0 ? (
              <EmptyState
                detail={`No active children are currently assigned to ${registrationLevel}.`}
                title="No children in this age group"
              />
            ) : (
              <div className={styles.childPicker}>
                {children.map((child) => (
                  <div className={styles.childCard} key={child.id}>
                    <button
                      aria-pressed={selectedStudentId === child.id}
                      className={selectedStudentId === child.id ? styles.selectedChild : undefined}
                      onClick={() => {
                        setSelectedStudentId(child.id);
                      }}
                      type="button"
                    >
                      <span>{child.firstName.slice(0, 1).toUpperCase()}</span>
                      <strong>{child.firstName}</strong>
                      <small data-status={child.status}>
                        {child.status === 'NotStarted' ? 'Not started' : child.status}
                      </small>
                    </button>
                    <button
                      className={styles.naAction}
                      disabled={setMembership.isPending}
                      onClick={() => {
                        setMembership.mutate({ studentId: child.id, isOwnTimetable: true });
                      }}
                      type="button"
                    >
                      Set to N/A
                    </button>
                  </div>
                ))}
              </div>
            )}
            {ownTimetableChildren.length > 0 ? (
              <div className={styles.ownTimetableList}>
                <strong>N/A · own timetable</strong>
                {ownTimetableChildren.map((child) => (
                  <div key={child.id}>
                    <span>{child.firstName}</span>
                    <small>N/A</small>
                    <button
                      disabled={setMembership.isPending}
                      onClick={() => {
                        setMembership.mutate({
                          studentId: child.id,
                          isOwnTimetable: false,
                          registrationLevel,
                        });
                      }}
                      type="button"
                    >
                      Return to {registrationLevel}
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </section>

          {saveSchedule.isPending ? (
            <div className={styles.loadingCard}>Refreshing shared timetable times…</div>
          ) : !workspace.schedule && selectedStudentId ? (
            <div className={styles.guidanceCard}>
              Save the shared {registrationLevel} times before assigning subjects.
            </div>
          ) : draftQuery.error ? (
            <div className={styles.errorCard}>{friendlyErrorMessage(draftQuery.error)}</div>
          ) : draftQuery.isLoading && selectedStudentId ? (
            <div className={styles.loadingCard}>Loading this child’s timetable…</div>
          ) : draftQuery.data && workspace.schedule ? (
            <StudentTimetableEditor
              draft={draftQuery.data}
              key={`${termKey}-${selectedStudentId}-${JSON.stringify(workspace.schedule.slots)}`}
              onAddSubject={async (name) => {
                await createSubject.mutateAsync({ studentId: selectedStudentId, name });
              }}
              onPublish={handlePublish}
              onSave={async (entries) => {
                await saveDraft.mutateAsync({ studentId: selectedStudentId, termKey, entries });
              }}
              pendingAction={
                createSubject.isPending
                  ? 'subject'
                  : saveDraft.isPending
                    ? 'save'
                    : publish.isPending
                      ? 'publish'
                      : null
              }
              publicationId={draftQuery.data.latestPublication?.id ?? null}
              slots={scheduleSlots(workspace)}
            />
          ) : null}
        </>
      )}
    </div>
  );
}

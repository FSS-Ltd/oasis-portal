'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarRange, CheckCircle2, Download, UsersRound } from 'lucide-react';
import { type TimetableDay, type TimetableSlotKind } from '@oasis/domain';
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
type EditorMode = 'draft' | 'published';

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

function scheduledSlots(workspace: Workspace): TimetableGridSlot[] {
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

function formatVersionDate(value: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(value);
}

function isLessonCell(
  kind: TimetableSlotKind,
): kind is Extract<TimetableSlotKind, 'Lesson'> {
  return kind === 'Lesson';
}

export function HeadTimetableClient() {
  const utils = api.useUtils();
  const termsQuery = api.timetable.terms.useQuery(undefined, { retry: false });
  const bandsQuery = api.timetable.bands.useQuery(undefined, { retry: false });
  const terms = termsQuery.data ?? [];
  const bands = bandsQuery.data ?? [];
  const [termKey, setTermKey] = useState('');
  const [ageBandId, setAgeBandId] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedPublicationId, setSelectedPublicationId] = useState('');
  const [editorMode, setEditorMode] = useState<EditorMode>('draft');

  useEffect(() => {
    if (!termKey && terms.length > 0) setTermKey(preferredTermKey(terms));
  }, [termKey, terms]);

  useEffect(() => {
    if (!ageBandId && bands.length > 0) setAgeBandId(bands[0]?.id ?? '');
  }, [ageBandId, bands]);

  const workspaceQuery = api.timetable.headWorkspace.useQuery(
    { termKey, ageBandId },
    { enabled: termKey.length > 0 && ageBandId.length > 0, retry: false },
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
  const publishedVersions = useMemo(() => {
    const versions = [...(draftQuery.data?.publishedVersions ?? [])];
    return versions
      .sort((left, right) => right.publishedAt.getTime() - left.publishedAt.getTime())
      .map((publication, index) => ({
        ...publication,
        label: `V${versions.length - index}`,
      }));
  }, [draftQuery.data?.publishedVersions]);
  const selectedPublication = publishedVersions.find(
    (publication) => publication.id === selectedPublicationId,
  );

  const publicationVersionIds = useMemo(
    () => publishedVersions.map((publication) => publication.id).join('|'),
    [publishedVersions],
  );
  const hasPublishedVersions = publishedVersions.length > 0;
  const isPublishedMode = editorMode === 'published';

  useEffect(() => {
    if (!selectedStudentId) {
      setSelectedPublicationId('');
      return;
    }
    if (!isPublishedMode) return;
    if (hasPublishedVersions && !publishedVersions.some((publication) => publication.id === selectedPublicationId)) {
      setSelectedPublicationId(publishedVersions[0]?.id ?? '');
    }
  }, [
    hasPublishedVersions,
    isPublishedMode,
    publishedVersions,
    publicationVersionIds,
    selectedPublicationId,
    selectedStudentId,
  ]);

  const publicationQuery = api.timetable.publicationForHead.useQuery(
    { publicationId: selectedPublicationId },
    { enabled: isPublishedMode && selectedPublicationId.length > 0, retry: false },
  );

  const draftWithPublishedEntries = useMemo(() => {
    if (!draftQuery.data) return null;
    if (!isPublishedMode || !publicationQuery.data || !workspace?.schedule) return draftQuery.data;
    const slotIdByPosition = new Map<number, string>(
      scheduledSlots(workspace).map((slot) => [slot.position, slot.id]),
    );
    const publishedEntries = publicationQuery.data.entries.flatMap((entry) => {
      if (!isLessonCell(entry.slotKind) || !entry.subjectId) return [];
      const slotId = slotIdByPosition.get(entry.slotPosition);
      if (!slotId) return [];
      return [{ day: entry.day, slotId, subjectId: entry.subjectId }];
    });
    return { ...draftQuery.data, entries: publishedEntries };
  }, [draftQuery.data, isPublishedMode, publicationQuery.data, workspace]);

  const saveSchedule = api.timetable.saveSchedule.useMutation({
    async onSuccess() {
      showSuccessToast('Shared timetable times saved.');
      await Promise.all([
        utils.timetable.headWorkspace.invalidate({ termKey, ageBandId }),
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
        utils.timetable.headWorkspace.invalidate({ termKey, ageBandId }),
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
  const setOwnTimetable = api.timetable.setOwnTimetable.useMutation({
    async onSuccess(_, variables) {
      if (variables.studentId === selectedStudentId) setSelectedStudentId('');
      showSuccessToast(
        variables.followsOwnTimetable
          ? 'Child moved to N/A and removed from timetable tasks.'
          : 'Child returned to the shared timetable workflow.',
      );
      await Promise.all([
        utils.timetable.headWorkspace.invalidate({ termKey, ageBandId }),
        utils.personalTask.list.invalidate(),
      ]);
    },
    onError(error) {
      showErrorToast(error, 'The child’s timetable status could not be changed.');
    },
  });

  async function handleScheduleSave(slots: EditableScheduleSlot[]): Promise<void> {
    await saveSchedule.mutateAsync({ termKey, ageBandId, slots });
  }

  async function handlePublishTimetable(): Promise<string | null> {
    if (!selectedStudentId) return null;
    try {
      const result = await publish.mutateAsync({
        studentId: selectedStudentId,
        termKey,
        acknowledgeUnassigned: false,
      });
      await afterPublish(result.publication.studentFirstName);
      return result.publication.id;
    } catch (error) {
      const message = friendlyErrorMessage(error, 'The timetable could not be published.');
      if (!message.includes('lesson periods have no subject')) {
        showErrorToast(error, 'The timetable could not be published.');
        return null;
      }
      const acknowledgeUnassigned = window.confirm(
        `${message}\n\nMissing subjects are only a suggestion. Publish anyway?`,
      );
      if (!acknowledgeUnassigned) return null;
      try {
        const result = await publish.mutateAsync({
          studentId: selectedStudentId,
          termKey,
          acknowledgeUnassigned,
        });
        await afterPublish(result.publication.studentFirstName);
        return result.publication.id;
      } catch (retryError) {
        showErrorToast(retryError, 'The timetable could not be published.');
        return null;
      }
    }
  }

  async function afterPublish(firstName: string): Promise<void> {
    showSuccessToast(`${firstName}’s timetable is published.`);
    await Promise.all([
      utils.timetable.studentDraft.invalidate({ studentId: selectedStudentId, termKey }),
      utils.timetable.headWorkspace.invalidate({ termKey, ageBandId }),
      utils.personalTask.list.invalidate(),
    ]);
  }

  async function handleSaveTimetable(
    entries: Array<{ day: TimetableDay; slotId: string; subjectId: string }>,
  ): Promise<void> {
    if (!selectedStudentId) return;
    await saveDraft.mutateAsync({ studentId: selectedStudentId, termKey, entries });
    if (!isPublishedMode) return;
    const publicationId = await handlePublishTimetable();
    if (publicationId) setSelectedPublicationId(publicationId);
  } 

  function pendingAction():
    | 'subject'
    | 'save'
    | 'publish'
    | null {
    if (createSubject.isPending) return 'subject';
    if (saveDraft.isPending || (isPublishedMode && publish.isPending)) return 'save';
    if (publish.isPending) return 'publish';
    return null;
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

      <nav aria-label="Age bands" className={styles.ageTabs}>
        {bands.map((band) => (
          <button
            aria-current={ageBandId === band.id ? 'page' : undefined}
            className={ageBandId === band.id ? styles.activeAgeTab : undefined}
            key={band.id}
            onClick={() => {
              setAgeBandId(band.id);
              setSelectedStudentId('');
            }}
            type="button"
          >
            {band.name}
          </button>
        ))}
      </nav>

      {workspaceQuery.error ? (
        <div className={styles.errorCard}>{friendlyErrorMessage(workspaceQuery.error)}</div>
      ) : workspaceQuery.isLoading || !workspace ? (
        <div className={styles.loadingCard}>Preparing age band…</div>
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
              {String(workspace.children.length)} children in {workspace.ageBand.name}
            </span>
          </div>

          <AgeGroupScheduleEditor
            initialSlots={workspace.schedule?.slots ?? workspace.defaultSlots}
            key={`${termKey}-${ageBandId}-${JSON.stringify(workspace.schedule?.slots ?? [])}`}
            onSave={handleScheduleSave}
            pending={saveSchedule.isPending}
            saved={Boolean(workspace.schedule)}
          />

          <section className={styles.childrenPanel}>
            <div className={styles.sectionHeading}>
              <div>
                <p>Child timetables</p>
                <h2>Choose a child</h2>
                <span>Switch to Published to inspect and version history.</span>
              </div>
            </div>

            <nav aria-label="Timetable editor mode" className={`${styles.ageTabs} ${styles.modeTabs}`}>
              <button
                aria-current={!isPublishedMode ? 'page' : undefined}
                className={!isPublishedMode ? styles.activeAgeTab : undefined}
                onClick={() => setEditorMode('draft')}
                type="button"
              >
                Draft timetables
              </button>
              <button
                aria-current={isPublishedMode ? 'page' : undefined}
                className={isPublishedMode ? styles.activeAgeTab : undefined}
                onClick={() => setEditorMode('published')}
                type="button"
              >
                Published timetables
              </button>
            </nav>

            {isPublishedMode ? (
              hasPublishedVersions ? (
                <div className={styles.versionList}>
                  {publishedVersions.map((publication) => {
                    const selected = publication.id === selectedPublicationId;
                    return (
                      <article
                        className={`${styles.versionItem} ${selected ? styles.selectedVersionItem : ''}`}
                        key={`${publication.id}-${publication.label}`}
                      >
                        <button
                          aria-pressed={selected}
                          className={styles.versionSelector}
                          onClick={() => {
                            setSelectedPublicationId(publication.id);
                          }}
                          type="button"
                        >
                          <strong>{publication.label}</strong>
                          <span>Published {formatVersionDate(publication.publishedAt)}</span>
                        </button>
                        <a className={styles.downloadButton} href={`/api/timetables/${publication.id}/pdf`}>
                          <Download aria-hidden="true" size={16} /> Download PDF
                        </a>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  detail="Publish this child’s timetable at least once to begin versioning."
                  title="No published timetables yet"
                />
              )
            ) : children.length === 0 ? (
              <EmptyState
                detail={`No active children are currently assigned to ${workspace.ageBand.name}.`}
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
                      disabled={setOwnTimetable.isPending}
                      onClick={() => {
                        setOwnTimetable.mutate({
                          studentId: child.id,
                          followsOwnTimetable: true,
                        });
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
                      disabled={setOwnTimetable.isPending}
                      onClick={() => {
                        setOwnTimetable.mutate({
                          studentId: child.id,
                          followsOwnTimetable: false,
                        });
                      }}
                      type="button"
                    >
                      Return to {workspace.ageBand.name}
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
              Save the shared {workspace.ageBand.name} times before assigning subjects.
            </div>
          ) : isPublishedMode && publicationQuery.isLoading && selectedPublicationId ? (
            <div className={styles.loadingCard}>Loading published timetable…</div>
          ) : isPublishedMode && publicationQuery.error ? (
            <div className={styles.errorCard}>{friendlyErrorMessage(publicationQuery.error)}</div>
          ) : draftQuery.error ? (
            <div className={styles.errorCard}>{friendlyErrorMessage(draftQuery.error)}</div>
          ) : isPublishedMode && !hasPublishedVersions ? null : draftQuery.isLoading && selectedStudentId ? (
            <div className={styles.loadingCard}>Loading this child’s timetable…</div>
          ) : draftWithPublishedEntries && workspace.schedule ? (
            <StudentTimetableEditor
              draft={draftWithPublishedEntries}
              key={`${termKey}-${selectedStudentId}-${isPublishedMode ? selectedPublicationId : 'draft'}-${JSON.stringify(workspace.schedule.slots)}`}
              mode={editorMode}
              onAddSubject={async (name) => {
                await createSubject.mutateAsync({ studentId: selectedStudentId, name });
              }}
              onPublish={() => {
                if (!selectedStudentId) return Promise.resolve();
                return handlePublishTimetable().then((publicationId) => {
                  if (publicationId) setSelectedPublicationId(publicationId);
                });
              }}
              onSave={async (entries) => {
                await handleSaveTimetable(entries);
              }}
              pendingAction={pendingAction()}
              publicationId={
                isPublishedMode
                  ? selectedPublication?.id ?? draftWithPublishedEntries.latestPublication?.id ?? null
                  : draftWithPublishedEntries.latestPublication?.id ?? null
              }
              slots={scheduledSlots(workspace)}
            />
          ) : null}
        </>
      )}
    </div>
  );
}

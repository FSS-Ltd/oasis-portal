import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { REGISTRATION_LEVELS, type TimetableRegistrationLevel } from '@oasis/domain';
import { api, type RouterOutputs } from '../../lib/trpc';
import { PortalMobileHeader } from '../core/portal-mobile-shell';
import { Badge, Card, ErrorText, InlineSpinner, MutedText, SectionTitle } from '../core/mobile-ui';
import { C } from '../core/mobile-theme';
import { MobileScheduleEditor, type MobileEditableScheduleSlot } from './mobile-schedule-editor';
import { MobileStudentTimetableEditor } from './mobile-student-timetable-editor';
import type { MobileTimetableSlot } from './mobile-timetable-grid';
import { saveOrShareTimetablePdf } from './mobile-timetable-pdf';

type TeachingTerm = RouterOutputs['timetable']['terms'][number];

interface MobileHeadTimetableScreenProps {
  onBack: () => void;
}

function currentTermKey(terms: readonly TeachingTerm[], now = new Date()): string {
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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The timetable action could not be completed.';
}

function confirmOpenLessons(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert('Publish with open lessons?', message, [
      {
        style: 'cancel',
        text: 'Keep editing',
        onPress: () => {
          resolve(false);
        },
      },
      {
        text: 'Publish anyway',
        onPress: () => {
          resolve(true);
        },
      },
    ]);
  });
}

export function MobileHeadTimetableScreen({ onBack }: MobileHeadTimetableScreenProps) {
  const utils = api.useUtils();
  const [termKey, setTermKey] = useState('');
  const [level, setLevel] = useState<TimetableRegistrationLevel>('ABC');
  const [studentId, setStudentId] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const termsQuery = api.timetable.terms.useQuery(undefined, { retry: false });
  const terms = termsQuery.data ?? [];

  useEffect(() => {
    if (!termKey && terms.length > 0) setTermKey(currentTermKey(terms));
  }, [termKey, terms]);

  const workspace = api.timetable.headWorkspace.useQuery(
    { registrationLevel: level, termKey },
    { enabled: termKey.length > 0, retry: false },
  );
  const children = useMemo(() => workspace.data?.children ?? [], [workspace.data?.children]);

  useEffect(() => {
    if (children.length === 0) {
      setStudentId('');
      return;
    }
    if (!children.some((child) => child.id === studentId)) setStudentId(children[0]?.id ?? '');
  }, [children, studentId]);

  const draft = api.timetable.studentDraft.useQuery(
    { studentId, termKey },
    { enabled: Boolean(studentId && termKey && workspace.data?.schedule), retry: false },
  );
  const publicationId = draft.data?.latestPublication?.id ?? '';
  const downloadPdf = api.timetable.downloadPdf.useQuery(
    { publicationId },
    { enabled: false, retry: false },
  );
  const saveSchedule = api.timetable.saveSchedule.useMutation();
  const saveDraft = api.timetable.saveDraft.useMutation();
  const createSubject = api.timetable.createAndAssignSubject.useMutation();
  const publish = api.timetable.publish.useMutation();

  const slots: MobileTimetableSlot[] =
    workspace.data?.schedule?.slots.map((slot) => ({
      id: slot.id,
      position: slot.position,
      kind: slot.kind,
      label: slot.label,
      startMinutes: slot.startMinutes,
      endMinutes: slot.endMinutes,
    })) ?? [];

  async function refreshWorkspace(): Promise<void> {
    await Promise.all([workspace.refetch(), studentId ? draft.refetch() : Promise.resolve()]);
  }

  async function handleSaveSchedule(slotsInput: MobileEditableScheduleSlot[]): Promise<void> {
    setError(null);
    setStatus(null);
    try {
      await saveSchedule.mutateAsync({ registrationLevel: level, termKey, slots: slotsInput });
      await utils.timetable.headWorkspace.invalidate({ registrationLevel: level, termKey });
      setStatus('Shared lesson and break times saved.');
    } catch (mutationError) {
      setError(errorMessage(mutationError));
      throw mutationError;
    }
  }

  async function handleSaveDraft(
    entries: Array<{
      day: 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday';
      slotId: string;
      subjectId: string;
    }>,
  ): Promise<void> {
    setError(null);
    setStatus(null);
    try {
      await saveDraft.mutateAsync({ entries, studentId, termKey });
      await Promise.all([
        utils.timetable.studentDraft.invalidate({ studentId, termKey }),
        utils.timetable.headWorkspace.invalidate({ registrationLevel: level, termKey }),
      ]);
      setStatus('Timetable draft saved.');
    } catch (mutationError) {
      setError(errorMessage(mutationError));
      throw mutationError;
    }
  }

  async function handleAddSubject(name: string): Promise<void> {
    setError(null);
    setStatus(null);
    try {
      const subject = await createSubject.mutateAsync({ name, studentId });
      await utils.timetable.studentDraft.invalidate({ studentId, termKey });
      setStatus(`${subject.name} added for this child.`);
    } catch (mutationError) {
      setError(errorMessage(mutationError));
      throw mutationError;
    }
  }

  async function completePublish(acknowledgeUnassigned: boolean): Promise<void> {
    const result = await publish.mutateAsync({ acknowledgeUnassigned, studentId, termKey });
    await Promise.all([
      utils.timetable.studentDraft.invalidate({ studentId, termKey }),
      utils.timetable.headWorkspace.invalidate({ registrationLevel: level, termKey }),
      utils.personalTask.list.invalidate(),
    ]);
    setStatus(`${result.publication.studentFirstName}’s timetable is published.`);
  }

  async function handlePublish(): Promise<void> {
    setError(null);
    setStatus(null);
    try {
      await completePublish(false);
    } catch (mutationError) {
      const message = errorMessage(mutationError);
      if (!message.includes('lesson periods have no subject')) {
        setError(message);
        return;
      }
      const acknowledgeUnassigned = await confirmOpenLessons(
        `${message} Missing subjects are suggestions only.`,
      );
      if (!acknowledgeUnassigned) return;
      try {
        await completePublish(acknowledgeUnassigned);
      } catch (retryError) {
        setError(errorMessage(retryError));
      }
    }
  }

  async function handleDownloadPdf(): Promise<void> {
    setError(null);
    setStatus(null);
    const result = await downloadPdf.refetch();
    if (!result.data) {
      setError(result.error?.message ?? 'The PDF could not be generated.');
      return;
    }
    try {
      await saveOrShareTimetablePdf(result.data);
      setStatus('PDF ready to print or save.');
    } catch (downloadError) {
      setError(errorMessage(downloadError));
    }
  }

  const pendingAction = createSubject.isPending
    ? 'subject'
    : saveDraft.isPending
      ? 'save'
      : publish.isPending
        ? 'publish'
        : downloadPdf.isFetching
          ? 'pdf'
          : null;

  return (
    <SafeAreaView style={styles.shell}>
      <PortalMobileHeader
        actionAccessibilityLabel="Return to staff home"
        actionLabel="Back"
        avatarLabel="H"
        eyebrow="Head workspace"
        onActionPress={onBack}
        subtitle="Timetable studio"
        title="Oasis Learning Centre"
        variant="dark"
      />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            onRefresh={() => {
              void refreshWorkspace();
            }}
            refreshing={workspace.isFetching || draft.isFetching}
          />
        }
      >
        <Card style={styles.hero}>
          <Text style={styles.eyebrow}>Learning &amp; progress</Text>
          <Text style={styles.title}>Timetable studio</Text>
          <Text style={styles.heroMuted}>
            Set shared age-group times, then publish each child’s timetable.
          </Text>
          <ScrollView
            contentContainerStyle={styles.pills}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {terms.map((term) => (
              <Pressable
                accessibilityRole="button"
                key={term.key}
                onPress={() => {
                  setTermKey(term.key);
                  setStudentId('');
                }}
              >
                <Badge variant={term.key === termKey ? 'blue' : 'neutral'}>
                  {term.academicYearLabel} · {term.label}
                </Badge>
              </Pressable>
            ))}
          </ScrollView>
          <View style={styles.levelTabs}>
            {REGISTRATION_LEVELS.map((registrationLevel) => (
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: registrationLevel === level }}
                key={registrationLevel}
                onPress={() => {
                  setLevel(registrationLevel);
                  setStudentId('');
                }}
                style={[
                  styles.levelTab,
                  registrationLevel === level ? styles.levelTabActive : null,
                ]}
              >
                <Text
                  style={[
                    styles.levelTabText,
                    registrationLevel === level ? styles.levelTabTextActive : null,
                  ]}
                >
                  {registrationLevel}
                </Text>
              </Pressable>
            ))}
          </View>
        </Card>

        {termsQuery.isLoading || workspace.isLoading ? (
          <InlineSpinner label="Loading timetable" />
        ) : null}
        {termsQuery.error || workspace.error ? (
          <ErrorText>{termsQuery.error?.message ?? workspace.error?.message}</ErrorText>
        ) : null}
        {status ? (
          <Card style={styles.statusCard}>
            <Text style={styles.statusText}>{status}</Text>
          </Card>
        ) : null}
        {error ? (
          <Card style={styles.errorCard}>
            <ErrorText>{error}</ErrorText>
          </Card>
        ) : null}

        {workspace.data ? (
          <>
            <Card style={styles.progressCard}>
              <View style={styles.progressHeading}>
                <SectionTitle>{level}</SectionTitle>
                <Badge variant="success">
                  {String(workspace.data.progress.done)}/{String(workspace.data.progress.total)}{' '}
                  done
                </Badge>
              </View>
              <MutedText>
                {String(workspace.data.children.length)} active children in this age group.
              </MutedText>
            </Card>
            <MobileScheduleEditor
              initialSlots={workspace.data.schedule?.slots ?? workspace.data.defaultSlots}
              key={`${termKey}-${level}-${workspace.data.schedule?.id ?? 'defaults'}`}
              onSave={handleSaveSchedule}
              pending={saveSchedule.isPending}
              saved={Boolean(workspace.data.schedule)}
            />
            <Card style={styles.childrenCard}>
              <SectionTitle>Choose a child</SectionTitle>
              {children.length === 0 ? (
                <MutedText>No active children are assigned to this age group.</MutedText>
              ) : (
                <ScrollView
                  contentContainerStyle={styles.pills}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                >
                  {children.map((child) => (
                    <Pressable
                      accessibilityRole="button"
                      key={child.id}
                      onPress={() => {
                        setStudentId(child.id);
                      }}
                    >
                      <Badge variant={child.id === studentId ? 'crimson' : 'neutral'}>
                        {child.firstName} ·{' '}
                        {child.status === 'NotStarted' ? 'Not started' : child.status}
                      </Badge>
                    </Pressable>
                  ))}
                </ScrollView>
              )}
            </Card>
          </>
        ) : null}

        {studentId && !workspace.data?.schedule ? (
          <Card>
            <MutedText>Save the shared {level} times before assigning subjects.</MutedText>
          </Card>
        ) : null}
        {draft.isLoading ? <InlineSpinner label="Loading child timetable" /> : null}
        {draft.error ? <ErrorText>{draft.error.message}</ErrorText> : null}
        {draft.data && workspace.data?.schedule ? (
          <MobileStudentTimetableEditor
            draft={draft.data}
            key={`${termKey}-${studentId}`}
            onAddSubject={handleAddSubject}
            onDownload={handleDownloadPdf}
            onPublish={handlePublish}
            onSave={handleSaveDraft}
            pendingAction={pendingAction}
            slots={slots}
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  childrenCard: {
    gap: 10,
    padding: 16,
  },
  content: {
    gap: 14,
    padding: 14,
    paddingBottom: 36,
  },
  errorCard: {
    backgroundColor: C.dangerBg,
    borderColor: C.dangerMid,
    padding: 14,
  },
  eyebrow: {
    color: '#AFC7E8',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  hero: {
    backgroundColor: C.navy,
    borderColor: C.navyMid,
    gap: 10,
    padding: 18,
  },
  heroMuted: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 13,
    lineHeight: 19,
  },
  levelTab: {
    alignItems: 'center',
    borderRadius: 8,
    flex: 1,
    minHeight: 36,
    justifyContent: 'center',
  },
  levelTabActive: {
    backgroundColor: C.surface,
  },
  levelTabText: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 11,
    fontWeight: '900',
  },
  levelTabTextActive: {
    color: C.navy,
  },
  levelTabs: {
    backgroundColor: C.navyLight,
    borderRadius: 10,
    flexDirection: 'row',
    gap: 3,
    padding: 3,
  },
  pills: {
    gap: 7,
    paddingRight: 12,
  },
  progressCard: {
    gap: 5,
    padding: 15,
  },
  progressHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  shell: {
    backgroundColor: C.bg,
    flex: 1,
  },
  statusCard: {
    backgroundColor: C.successBg,
    borderColor: C.successMid,
    padding: 13,
  },
  statusText: {
    color: C.success,
    fontSize: 12,
    fontWeight: '800',
  },
  title: {
    color: C.surface,
    fontSize: 27,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
});

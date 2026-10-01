import { displaySchoolYearLabel, formatPaceIdentifier, resolveReportPeriod } from '@oasis/domain';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api, type RouterOutputs } from '../../lib/trpc';
import { C } from '../core/mobile-theme';
import { Badge, Card, ErrorText, InlineSpinner, MutedText, SectionTitle } from '../core/mobile-ui';
import { ParentChildSwitcher } from './parent-child-switcher';
import { type ParentDashboardChild } from './parent-home-utils';

const PAGE_SIZE = 20;
const TERM_SEASONS = ['Autumn', 'Spring', 'Summer'] as const;

type PaceView = 'current' | 'history';
type HistoryPeriodKind = 'AcademicYear' | 'Term';
type TermSeason = (typeof TERM_SEASONS)[number];
type ParentPaceHistory = RouterOutputs['pace']['parentHistory'];

function currentAcademicYearStart(referenceDate = new Date()): number {
  return referenceDate.getUTCMonth() >= 8
    ? referenceDate.getUTCFullYear()
    : referenceDate.getUTCFullYear() - 1;
}

function currentTermSeason(referenceDate = new Date()): TermSeason {
  const month = referenceDate.getUTCMonth();
  if (month < 3) return 'Spring';
  if (month < 8) return 'Summer';
  return 'Autumn';
}

function academicYearLabel(startYear: number): string {
  return `${String(startYear)}/${String(startYear + 1).slice(-2)} Academic Year`;
}

function assessmentLabel(testType: ParentPaceHistory['rows'][number]['testType']): string {
  return testType === 'SelfTest' ? 'Self-Test' : 'PACE Test';
}

function formatHistoryDate(value: Date | string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value));
}

function SegmentedControl<T extends string>({
  accessibilityLabel,
  items,
  onChange,
  value,
}: {
  accessibilityLabel: string;
  items: readonly { label: string; value: T }[];
  onChange: (value: T) => void;
  value: T;
}) {
  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="tablist"
      style={styles.segmented}
    >
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <Pressable
            accessibilityLabel={item.label}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            key={item.value}
            onPress={() => {
              onChange(item.value);
            }}
            style={[styles.segment, selected ? styles.segmentSelected : null]}
          >
            <Text style={[styles.segmentText, selected ? styles.segmentTextSelected : null]}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function YearPicker({
  label,
  onChange,
  value,
  years,
}: {
  label: string;
  onChange: (year: number) => void;
  value: number;
  years: readonly number[];
}) {
  const [visible, setVisible] = useState(false);

  return (
    <View style={styles.pickerField}>
      <Text style={styles.controlLabel}>{label}</Text>
      <Pressable
        accessibilityLabel={`Choose ${label.toLowerCase()}`}
        accessibilityRole="button"
        onPress={() => {
          setVisible(true);
        }}
        style={styles.pickerTrigger}
      >
        <Text style={styles.pickerTriggerText}>{academicYearLabel(value)}</Text>
        <Text style={styles.pickerChevron}>⌄</Text>
      </Pressable>
      <Modal
        animationType="fade"
        onRequestClose={() => {
          setVisible(false);
        }}
        transparent
        visible={visible}
      >
        <View accessibilityViewIsModal style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>{label}</Text>
            {years.map((year) => {
              const selected = year === value;
              return (
                <Pressable
                  accessibilityLabel={academicYearLabel(year)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  key={year}
                  onPress={() => {
                    onChange(year);
                    setVisible(false);
                  }}
                  style={[styles.yearOption, selected ? styles.yearOptionSelected : null]}
                >
                  <Text
                    style={[styles.yearOptionText, selected ? styles.yearOptionTextSelected : null]}
                  >
                    {academicYearLabel(year)}
                  </Text>
                  <Text style={styles.yearOptionState}>{selected ? 'Selected' : ''}</Text>
                </Pressable>
              );
            })}
            <Pressable
              accessibilityLabel="Close academic year picker"
              accessibilityRole="button"
              onPress={() => {
                setVisible(false);
              }}
              style={styles.modalClose}
            >
              <Text style={styles.modalCloseText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function CurrentPaceSubjects({
  error,
  loading,
  subjects,
}: {
  error: string | null;
  loading: boolean;
  subjects: RouterOutputs['pace']['parentCurrent']['subjects'] | undefined;
}) {
  if (loading) return <InlineSpinner label="Loading current PACE subjects" />;
  if (error) return <ErrorText>{error}</ErrorText>;
  if (!subjects || subjects.length === 0) {
    return <MutedText>No active PACE subjects are assigned.</MutedText>;
  }

  return (
    <View style={styles.currentList}>
      {subjects.map((subject) => (
        <Card key={subject.subjectCode} style={styles.currentSubject}>
          <View style={styles.currentSubjectHeader}>
            <Text style={styles.currentSubjectLabel}>CURRENT SUBJECT</Text>
            <Text style={styles.subjectCode}>{subject.subjectCode}</Text>
          </View>
          <Text style={styles.subjectName}>{subject.subjectName}</Text>
          <View style={styles.paceProgress}>
            <Text style={styles.paceProgressLabel}>Current PACE</Text>
            <Text
              accessibilityLabel={`${subject.subjectName}, PACE ${formatPaceIdentifier(subject.currentPaceNumber)}`}
              style={styles.paceNumber}
            >
              {subject.gapContext
                ? `Gap PACE ${formatPaceIdentifier(subject.currentPaceNumber)}`
                : formatPaceIdentifier(subject.currentPaceNumber)}
            </Text>
            {subject.gapContext ? (
              <Text style={styles.paceProgressLabel}>
                Jump to PACE {formatPaceIdentifier(subject.gapContext.jumpToPaceNumber)}
              </Text>
            ) : null}
            {subject.gapReviewRequired ? (
              <Text style={styles.paceProgressLabel}>
                Needs Head review · advancement is paused
              </Text>
            ) : null}
          </View>
        </Card>
      ))}
    </View>
  );
}

function PACEHistory({
  error,
  history,
  loading,
  onNextPage,
  onPreviousPage,
}: {
  error: string | null;
  history: ParentPaceHistory | undefined;
  loading: boolean;
  onNextPage: () => void;
  onPreviousPage: () => void;
}) {
  if (loading) return <InlineSpinner label="Loading PACE history" />;
  if (error) return <ErrorText>{error}</ErrorText>;
  if (!history) return <MutedText>No PACE assessments were recorded in this period.</MutedText>;

  const start = history.totalRows > 0 ? (history.page - 1) * history.pageSize + 1 : 0;
  const end = Math.min(history.page * history.pageSize, history.totalRows);

  return (
    <View style={styles.historyList}>
      {history.rows.length === 0 ? (
        <MutedText>No PACE assessments were recorded in this period.</MutedText>
      ) : null}
      {history.rows.map((row) => {
        const passed = row.result === 'Passed';
        return (
          <Card key={row.id} style={styles.historyRow}>
            <View style={styles.historyRowHeader}>
              <View style={styles.historySubject}>
                <Text style={styles.subjectCode}>{row.subjectCode}</Text>
                <Text style={styles.subjectName}>{row.subjectName}</Text>
              </View>
              <Badge variant={passed ? 'success' : 'warning'}>
                {passed ? 'Passed' : 'Below pass mark'}
              </Badge>
            </View>
            <Text style={styles.historyPace}>PACE {formatPaceIdentifier(row.paceNumber)}</Text>
            <MutedText>
              {assessmentLabel(row.testType)} · {String(row.score)}% ·{' '}
              {formatHistoryDate(row.completedAt)}
            </MutedText>
          </Card>
        );
      })}
      <View accessibilityLiveRegion="polite" style={styles.pagination}>
        <Text style={styles.paginationSummary}>
          Showing {String(start)}–{String(end)} of {String(history.totalRows)}
        </Text>
        <View style={styles.paginationActions}>
          <Pressable
            accessibilityLabel="Previous PACE history page"
            accessibilityRole="button"
            disabled={history.page <= 1}
            onPress={onPreviousPage}
            style={[styles.pageButton, history.page <= 1 ? styles.disabled : null]}
          >
            <Text style={styles.pageButtonText}>Previous</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Next PACE history page"
            accessibilityRole="button"
            disabled={history.page >= history.totalPages}
            onPress={onNextPage}
            style={[styles.pageButton, history.page >= history.totalPages ? styles.disabled : null]}
          >
            <Text style={styles.pageButtonText}>Next</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export function ParentPaceScreen({
  children,
  onRefresh,
  onSelectChild,
  selectedChild,
}: {
  children: readonly ParentDashboardChild[];
  onRefresh: () => Promise<void>;
  onSelectChild: (studentId: string) => void;
  selectedChild: ParentDashboardChild | null;
}) {
  const selectedStudentId = selectedChild?.student.id ?? '';
  const [view, setView] = useState<PaceView>('current');
  const [periodKind, setPeriodKind] = useState<HistoryPeriodKind>('AcademicYear');
  const [academicYear, setAcademicYear] = useState(() => currentAcademicYearStart());
  const [termSeason, setTermSeason] = useState<TermSeason>(() => currentTermSeason());
  const [page, setPage] = useState(1);
  const academicYears = useMemo(
    () => Array.from({ length: 7 }, (_, index) => currentAcademicYearStart() - index),
    [],
  );
  const period = useMemo(
    () =>
      periodKind === 'AcademicYear'
        ? { type: 'AcademicYear' as const, startYear: academicYear }
        : { type: 'Term' as const, term: `${String(academicYear)}-${termSeason}` },
    [academicYear, periodKind, termSeason],
  );
  const resolvedPeriod = useMemo(() => resolveReportPeriod(period), [period]);
  const current = api.pace.parentCurrent.useQuery(
    { studentId: selectedStudentId },
    { enabled: Boolean(selectedStudentId), retry: false },
  );
  const history = api.pace.parentHistory.useQuery(
    { studentId: selectedStudentId, page, pageSize: PAGE_SIZE, period },
    { enabled: Boolean(selectedStudentId) && view === 'history', retry: false },
  );

  useEffect(() => {
    setPage(1);
  }, [academicYear, periodKind, selectedStudentId, termSeason, view]);

  async function refreshPACE() {
    await Promise.all([
      onRefresh(),
      selectedStudentId ? current.refetch() : Promise.resolve(),
      selectedStudentId && view === 'history' ? history.refetch() : Promise.resolve(),
    ]);
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          onRefresh={() => {
            void refreshPACE();
          }}
          refreshing={current.isFetching || history.isFetching}
        />
      }
      showsVerticalScrollIndicator={false}
      style={styles.scroller}
    >
      <View style={styles.intro}>
        <Text style={styles.eyebrow}>Parent Portal</Text>
        <Text style={styles.title}>PACE progress</Text>
        <Text style={styles.subtitle}>
          {selectedChild
            ? `Current PACE subjects and assessment history for ${selectedChild.student.fullName}.`
            : 'Choose a linked child to view PACE progress.'}
        </Text>
      </View>
      {!selectedChild ? (
        <Card>
          <SectionTitle>No linked child</SectionTitle>
          <MutedText>Link a child to view PACE progress.</MutedText>
        </Card>
      ) : (
        <>
          <View style={styles.paceHero}>
            <Text style={styles.paceHeroLabel}>VIEWING PROGRESS FOR</Text>
            <Text style={styles.paceHeroName}>{selectedChild.student.fullName}</Text>
            <Text style={styles.paceHeroMeta}>
              {displaySchoolYearLabel(selectedChild.student.yearGroup)}
            </Text>
            <ParentChildSwitcher
              children={children}
              onSelect={onSelectChild}
              selectedChildId={selectedStudentId}
            />
          </View>
          <SegmentedControl
            accessibilityLabel="PACE view"
            items={[
              { label: 'Current', value: 'current' },
              { label: 'History', value: 'history' },
            ]}
            onChange={setView}
            value={view}
          />
          {view === 'current' ? (
            <CurrentPaceSubjects
              error={current.error?.message ?? null}
              loading={current.isLoading}
              subjects={current.data?.subjects}
            />
          ) : (
            <Card style={styles.historyPanel}>
              <SegmentedControl
                accessibilityLabel="PACE history period"
                items={[
                  { label: 'Academic Year', value: 'AcademicYear' },
                  { label: 'Term', value: 'Term' },
                ]}
                onChange={setPeriodKind}
                value={periodKind}
              />
              <YearPicker
                label={periodKind === 'AcademicYear' ? 'Academic year' : 'Term year'}
                onChange={setAcademicYear}
                value={academicYear}
                years={academicYears}
              />
              {periodKind === 'Term' ? (
                <View style={styles.termControl}>
                  <Text style={styles.controlLabel}>Term</Text>
                  <SegmentedControl
                    accessibilityLabel="Term"
                    items={TERM_SEASONS.map((season) => ({ label: season, value: season }))}
                    onChange={setTermSeason}
                    value={termSeason}
                  />
                </View>
              ) : null}
              <Text style={styles.periodLabel}>Showing {resolvedPeriod.snapshot.label}</Text>
              <PACEHistory
                error={history.error?.message ?? null}
                history={history.data}
                loading={history.isLoading}
                onNextPage={() => {
                  setPage((currentPage) => currentPage + 1);
                }}
                onPreviousPage={() => {
                  setPage((currentPage) => Math.max(1, currentPage - 1));
                }}
              />
            </Card>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 14,
    padding: 16,
    paddingBottom: 36,
  },
  controlLabel: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },
  currentList: {
    gap: 10,
  },
  currentSubject: {
    gap: 10,
    padding: 18,
  },
  currentSubjectHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  currentSubjectLabel: {
    color: C.textMuted,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  disabled: {
    opacity: 0.45,
  },
  eyebrow: {
    color: C.crimson,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  historyList: {
    gap: 10,
  },
  historyPace: {
    color: C.crimson,
    fontSize: 14,
    fontWeight: '900',
  },
  historyPanel: {
    gap: 14,
    padding: 16,
  },
  historyRow: {
    gap: 6,
    padding: 14,
  },
  historyRowHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  historySubject: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  intro: {
    gap: 4,
  },
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(16, 24, 40, 0.48)',
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  modalClose: {
    alignItems: 'center',
    borderColor: C.border,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
  },
  modalCloseText: {
    color: C.navy,
    fontSize: 14,
    fontWeight: '900',
  },
  modalSheet: {
    backgroundColor: C.surface,
    borderRadius: 14,
    gap: 8,
    maxWidth: 420,
    padding: 16,
    width: '100%',
  },
  modalTitle: {
    color: C.navy,
    fontSize: 17,
    fontWeight: '900',
    marginBottom: 4,
  },
  paceNumber: {
    color: C.navy,
    fontSize: 22,
    fontWeight: '900',
  },
  paceHero: {
    backgroundColor: C.navy,
    borderColor: C.navyLight,
    borderRadius: 20,
    borderWidth: 1,
    gap: 5,
    overflow: 'hidden',
    padding: 18,
  },
  paceHeroLabel: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  paceHeroMeta: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  paceHeroName: {
    color: C.surface,
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 27,
  },
  paceProgress: {
    alignItems: 'flex-end',
    backgroundColor: C.bg,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  paceProgressLabel: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },
  pageButton: {
    alignItems: 'center',
    borderColor: C.border,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 14,
  },
  pageButtonText: {
    color: C.navy,
    fontSize: 13,
    fontWeight: '900',
  },
  pagination: {
    gap: 10,
    paddingTop: 2,
  },
  paginationActions: {
    flexDirection: 'row',
    gap: 8,
  },
  paginationSummary: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  periodLabel: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  pickerChevron: {
    color: C.textSecondary,
    fontSize: 18,
    fontWeight: '900',
  },
  pickerField: {
    gap: 6,
  },
  pickerTrigger: {
    alignItems: 'center',
    backgroundColor: C.bg,
    borderColor: C.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 44,
    paddingHorizontal: 12,
  },
  pickerTriggerText: {
    color: C.navy,
    fontSize: 14,
    fontWeight: '800',
  },
  scroller: {
    backgroundColor: C.bg,
    flex: 1,
  },
  segment: {
    alignItems: 'center',
    borderRadius: 8,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 8,
  },
  segmented: {
    backgroundColor: '#E4EAF4',
    borderColor: '#D4DDEA',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    padding: 4,
  },
  segmentSelected: {
    backgroundColor: C.surface,
    borderColor: 'rgba(255,255,255,0.88)',
    borderWidth: 1,
  },
  segmentText: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: '900',
  },
  segmentTextSelected: {
    color: C.navy,
  },
  subjectCode: {
    color: C.crimson,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  subjectName: {
    color: C.navy,
    fontSize: 15,
    fontWeight: '900',
  },
  subtitle: {
    color: C.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  termControl: {
    gap: 6,
  },
  title: {
    color: C.navy,
    fontSize: 23,
    fontWeight: '900',
    lineHeight: 28,
  },
  yearOption: {
    alignItems: 'center',
    borderColor: C.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 44,
    paddingHorizontal: 12,
  },
  yearOptionSelected: {
    backgroundColor: C.crimsonLight,
    borderColor: C.crimson,
  },
  yearOptionState: {
    color: C.crimson,
    fontSize: 11,
    fontWeight: '900',
  },
  yearOptionText: {
    color: C.navy,
    fontSize: 14,
    fontWeight: '800',
  },
  yearOptionTextSelected: {
    color: C.crimson,
  },
});

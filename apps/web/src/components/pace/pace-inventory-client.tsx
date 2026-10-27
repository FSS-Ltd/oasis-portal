'use client';

import { useEffect, useRef, useState } from 'react';
import { PackagePlus, Truck } from 'lucide-react';
import { availablePacesAhead, PACE_CATALOGUE, recommendedStartPace } from '@oasis/domain';
import type { RouterOutputs } from '@/lib/trpc';
import { api } from '@/lib/trpc';
import { friendlyErrorMessage, showErrorToast, showSuccessToast } from '@/lib/notifications';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { Field, SelectInput } from '@/components/ui/field';
import { ConfirmationDialog } from '@/components/admin/confirmation-dialog';
import { PaceCataloguePicker } from './pace-catalogue-picker';
import { PaceDiagnosticChart } from './pace-diagnostic-chart';
import { PaceDiagnosticForm, type PaceDiagnosticSubmission } from './pace-diagnostic-form';
import { PaceGapPlanPanel } from './pace-gap-plan-panel';
import {
  InventoryPagination,
  PaceInventoryTabs,
  type InventoryTab,
} from './pace-inventory-navigation';
import { PaceInventoryOrders } from './pace-inventory-orders';
import {
  PaceInventoryOrderModal,
  PartialOrderError,
  type PaceInventoryOrderRequest,
  type PaceInventoryOrderSubjectChoice,
} from './pace-inventory-order-modal';

type InventorySummary = RouterOutputs['academicInventory']['summary'];
type InventoryStudent = InventorySummary['students'][number];
type InventoryAssignment = InventoryStudent['subjects'][number];
type InventoryDiagnostic = InventorySummary['diagnostics'][number];
type InventoryAlert = InventorySummary['alerts'][number];

interface PaceSelectionState {
  assignmentKey: string;
  paceNumbers: number[];
}

const dateFormatter = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' });

function selectedStudent(students: InventoryStudent[], studentId: string): InventoryStudent | null {
  if (!studentId) return students[0] ?? null;
  return students.find((student) => student.id === studentId) ?? null;
}

function selectedAssignment(
  student: InventoryStudent | null,
  subjectId: string,
): InventoryAssignment | null {
  if (!student) return null;
  if (!subjectId) return student.subjects[0] ?? null;
  return student.subjects.find((assignment) => assignment.subjectId === subjectId) ?? null;
}

const diagnosticTestLabels = {
  Math: 'Math',
  English: 'English',
  WordBuilding: 'Word Building',
  Reading: 'Reading',
} as const;

function formatAssignment(assignment: InventoryAssignment | null): string {
  if (!assignment) return 'No assigned subject';
  return `${assignment.subject.code} · ${assignment.subject.name}`;
}

function formatDate(value: Date | string): string {
  return dateFormatter.format(new Date(value));
}

function paceLabel(paceNumber: number): string {
  return `PACE #${String(paceNumber)}`;
}

function formatPaceCount(count: number): string {
  return `${String(count)} ${count === 1 ? 'PACE' : 'PACEs'}`;
}

function groupAlertsByStudent(alerts: readonly InventoryAlert[]) {
  const alertsByStudent = new Map<string, InventoryAlert[]>();
  for (const alert of alerts) {
    const studentAlerts = alertsByStudent.get(alert.studentId) ?? [];
    studentAlerts.push(alert);
    alertsByStudent.set(alert.studentId, studentAlerts);
  }
  return [...alertsByStudent].map(([studentId, studentAlerts]) => ({
    studentId,
    alerts: studentAlerts,
  }));
}

function availableOrderPaces(
  summary: InventorySummary | undefined,
  studentId: string,
  subjectId: string,
): number[] {
  const unavailable = new Set([
    ...(summary?.supply ?? [])
      .filter((row) => row.studentId === studentId && row.subjectId === subjectId)
      .map((row) => row.paceNumber),
    ...(summary?.orders ?? [])
      .filter(
        (row) =>
          row.studentId === studentId && row.subjectId === subjectId && row.status !== 'Delivered',
      )
      .map((row) => row.paceNumber),
  ]);
  return PACE_CATALOGUE.filter((paceNumber) => !unavailable.has(paceNumber));
}

export function PaceInventoryClient() {
  const utils = api.useUtils();
  const summaryQuery = api.academicInventory.summary.useQuery(
    { includeHistory: false },
    { retry: false },
  );
  const [studentId, setStudentId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [paceSelection, setPaceSelection] = useState<PaceSelectionState>({
    assignmentKey: '',
    paceNumbers: [],
  });
  const [pendingDiagnosticId, setPendingDiagnosticId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<InventoryTab>('attention');
  const [alertPage, setAlertPage] = useState(1);
  const [alertPageSize, setAlertPageSize] = useState(10);
  const [diagnosticPage, setDiagnosticPage] = useState(1);
  const [diagnosticPageSize, setDiagnosticPageSize] = useState(10);
  const [diagnosticTab, setDiagnosticTab] = useState<'results' | 'gaps'>('results');
  const [gapPrefill, setGapPrefill] = useState<{
    studentId: string;
    subjectId: string;
    gaps: number[];
    jumpTo: number;
  } | null>(null);
  const [quickOrderTarget, setQuickOrderTarget] = useState<{ studentId: string } | null>(null);
  const quickOrderTriggerRef = useRef<HTMLButtonElement | null>(null);
  const diagnosticHistory = api.academicInventory.diagnosticsHistory.useQuery(
    { page: diagnosticPage, pageSize: diagnosticPageSize },
    { enabled: activeTab === 'diagnostics' && diagnosticTab === 'results', retry: false },
  );

  const summary = summaryQuery.data;
  const students = summary?.students ?? [];
  const student = selectedStudent(students, studentId);
  const assignment = selectedAssignment(student, subjectId);
  const quickOrderStudent = quickOrderTarget
    ? (students.find((row) => row.id === quickOrderTarget.studentId) ?? null)
    : null;
  const quickOrderStudentAlerts = (summary?.alerts ?? []).filter(
    (alert) => alert.studentId === quickOrderTarget?.studentId,
  );
  const quickOrderSubjects: PaceInventoryOrderSubjectChoice[] = quickOrderStudentAlerts.flatMap(
    (alert) => {
      const alertAssignment = quickOrderStudent?.subjects.find(
        (row) => row.subjectId === alert.subjectId,
      );
      return alertAssignment
        ? [
            {
              subjectId: alert.subjectId,
              subjectLabel: formatAssignment(alertAssignment),
              currentPaceNumber: alert.currentPaceNumber,
              availablePaceNumbers: availableOrderPaces(summary, alert.studentId, alert.subjectId),
            },
          ]
        : [];
    },
  );
  const groupedAlerts = groupAlertsByStudent(summary?.alerts ?? []).sort((left, right) => {
    const remainingDifference =
      Math.min(...left.alerts.map((alert) => alert.remainingPaceCount)) -
      Math.min(...right.alerts.map((alert) => alert.remainingPaceCount));
    const leftName = students.find((row) => row.id === left.studentId)?.fullName ?? '';
    const rightName = students.find((row) => row.id === right.studentId)?.fullName ?? '';
    return (
      remainingDifference ||
      leftName.localeCompare(rightName) ||
      left.studentId.localeCompare(right.studentId)
    );
  });
  useEffect(() => {
    const lastPage = Math.max(1, Math.ceil(groupedAlerts.length / alertPageSize));
    if (alertPage > lastPage) setAlertPage(lastPage);
  }, [alertPage, alertPageSize, groupedAlerts.length]);
  const selectedStudentId = student?.id ?? '';
  const selectedSubjectId = assignment?.subjectId ?? '';
  const prefillForGaps =
    gapPrefill?.studentId === selectedStudentId && gapPrefill.subjectId === selectedSubjectId
      ? gapPrefill
      : undefined;
  const selectionContextKey = `${selectedStudentId}:${selectedSubjectId}:${String(
    assignment?.currentPaceNumber ?? '',
  )}`;
  const selectedPaceNumbers =
    paceSelection.assignmentKey === selectionContextKey ? paceSelection.paceNumbers : [];
  const assignmentSupply = (summary?.supply ?? [])
    .filter(
      (supply) => supply.studentId === selectedStudentId && supply.subjectId === selectedSubjectId,
    )
    .map((supply) => supply.paceNumber)
    .sort((left, right) => left - right);
  const pendingOrderPaceNumbers = (summary?.orders ?? [])
    .filter(
      (order) =>
        order.studentId === selectedStudentId &&
        order.subjectId === selectedSubjectId &&
        order.status !== 'Delivered',
    )
    .map((order) => order.paceNumber);
  const unavailablePaceNumbers = new Set([...assignmentSupply, ...pendingOrderPaceNumbers]);
  const availablePaceNumbers = PACE_CATALOGUE.filter(
    (paceNumber) => !unavailablePaceNumbers.has(paceNumber),
  );
  const availableFutureSupply = assignment
    ? availablePacesAhead(assignment.currentPaceNumber, assignmentSupply)
    : [];
  const hasUnavailableSelection = selectedPaceNumbers.some((paceNumber) =>
    unavailablePaceNumbers.has(paceNumber),
  );
  const hasSelection = selectedPaceNumbers.length > 0 && !hasUnavailableSelection;

  useEffect(() => {
    setPaceSelection((current) =>
      current.assignmentKey === selectionContextKey
        ? current
        : { assignmentKey: selectionContextKey, paceNumbers: [] },
    );
  }, [selectionContextKey]);

  async function invalidateInventory(): Promise<void> {
    await Promise.all([
      utils.academicInventory.summary.invalidate(),
      utils.academicInventory.ordersForStudent.invalidate(),
      utils.academicInventory.diagnosticsHistory.invalidate(),
      utils.pace.forStudent.invalidate(),
      utils.pace.roster.invalidate(),
      utils.student.dashboard.invalidate(),
    ]);
  }

  const addCurrentSupply = api.academicInventory.addCurrentSupply.useMutation({
    async onSuccess(_, input) {
      setPaceSelection((current) => ({ ...current, paceNumbers: [] }));
      showSuccessToast(`${formatPaceCount(input.paceNumbers.length)} added to current supply.`);
      await invalidateInventory();
    },
    onError(error) {
      showErrorToast(error, 'Current PACE supply could not be updated.');
    },
  });
  const createOrders = api.academicInventory.createOrders.useMutation({
    async onSuccess(_, input) {
      showSuccessToast(
        input.paceNumbers.length === 1
          ? '1 PACE order created.'
          : `${String(input.paceNumbers.length)} PACE orders created.`,
      );
      await invalidateInventory();
    },
    onError(error) {
      showErrorToast(error, 'PACE orders could not be created.');
    },
  });
  const recordDiagnostic = api.academicInventory.recordDiagnostic.useMutation({
    async onSuccess() {
      showSuccessToast('Diagnostic result recorded.');
      await invalidateInventory();
    },
    onError(error) {
      showErrorToast(error, 'Diagnostic result could not be recorded.');
    },
  });
  const deleteDiagnostic = api.academicInventory.deleteDiagnostic.useMutation({
    async onSuccess() {
      setPendingDiagnosticId(null);
      setDiagnosticPage(1);
      showSuccessToast('Diagnostic result deleted.');
      await invalidateInventory();
    },
    onError(error) {
      showErrorToast(error, 'Diagnostic result could not be deleted.');
    },
  });
  const isBulkMutationPending = addCurrentSupply.isPending || createOrders.isPending;

  function chooseStudent(value: string): void {
    setStudentId(value);
    setSubjectId('');
    setPaceSelection((current) => ({ ...current, paceNumbers: [] }));
  }

  function chooseSubject(value: string): void {
    setSubjectId(value);
    setPaceSelection((current) => ({ ...current, paceNumbers: [] }));
  }

  function addSelectedSupply(): void {
    if (!student || !assignment || !hasSelection || isBulkMutationPending) return;
    addCurrentSupply.mutate({
      studentId: student.id,
      subjectId: assignment.subjectId,
      paceNumbers: selectedPaceNumbers,
    });
  }

  function createSelectedOrders(): void {
    if (!student || !assignment || !hasSelection || isBulkMutationPending) return;
    createOrders.mutate(
      {
        studentId: student.id,
        subjectId: assignment.subjectId,
        paceNumbers: selectedPaceNumbers,
      },
      {
        onSuccess: () => {
          setPaceSelection((current) => ({ ...current, paceNumbers: [] }));
        },
      },
    );
  }

  function closeQuickOrder(): void {
    setQuickOrderTarget(null);
    window.requestAnimationFrame(() => quickOrderTriggerRef.current?.focus());
  }

  async function submitQuickOrder(orders: PaceInventoryOrderRequest[]): Promise<void> {
    if (!quickOrderTarget || createOrders.isPending) return;
    const studentId = quickOrderTarget.studentId;
    // Check every subject before writing anything, so a stale pick fails the whole request.
    for (const { subjectId, paceNumbers } of orders) {
      const assignment = quickOrderStudent?.subjects.find((row) => row.subjectId === subjectId);
      const alert = quickOrderStudentAlerts.find((row) => row.subjectId === subjectId);
      if (!assignment || !alert) {
        throw new Error(
          'This subject assignment is no longer available. Refresh inventory and try again.',
        );
      }
      const orderable = availableOrderPaces(summary, studentId, subjectId);
      if (paceNumbers.some((paceNumber) => !orderable.includes(paceNumber))) {
        throw new Error(
          `One or more selected PACEs for ${formatAssignment(assignment)} are no longer available. Refresh your selection.`,
        );
      }
    }
    const completed: string[] = [];
    for (const { subjectId, paceNumbers } of orders) {
      try {
        await createOrders.mutateAsync({ studentId, subjectId, paceNumbers });
        completed.push(subjectId);
      } catch (error) {
        if (completed.length === 0) throw error;
        const label = formatAssignment(
          quickOrderStudent?.subjects.find((row) => row.subjectId === subjectId) ?? null,
        );
        throw new PartialOrderError(
          completed,
          `${label} could not be ordered: ${friendlyErrorMessage(error)} The other subjects were ordered.`,
        );
      }
    }
    closeQuickOrder();
  }

  function recordSelectedDiagnostic(submission: PaceDiagnosticSubmission): void {
    if (!student || recordDiagnostic.isPending) return;
    recordDiagnostic.mutate({ studentId: student.id, ...submission });
  }

  function openGapSetup(diagnostic: InventoryDiagnostic): void {
    const placement = diagnostic.placement;
    if (!diagnostic.subjectId || !placement || placement.performanceLevelPace === null) return;
    setStudentId(diagnostic.studentId);
    setSubjectId(diagnostic.subjectId);
    setPaceSelection((current) => ({ ...current, paceNumbers: [] }));
    setGapPrefill({
      studentId: diagnostic.studentId,
      subjectId: diagnostic.subjectId,
      gaps: placement.learningGaps,
      jumpTo: placement.performanceLevelPace,
    });
    setDiagnosticTab('gaps');
  }

  const diagnosticColumns: readonly DataTableColumn<InventoryDiagnostic>[] = [
    {
      id: 'student',
      header: 'Student',
      render: (diagnostic) =>
        students.find((row) => row.id === diagnostic.studentId)?.fullName ?? 'Unknown student',
    },
    {
      id: 'test',
      header: 'Test',
      render: (diagnostic) => {
        if (diagnostic.test) return diagnosticTestLabels[diagnostic.test];
        // Legacy rows predate the test field and are identified by their subject.
        const diagnosticStudent = students.find((row) => row.id === diagnostic.studentId);
        return formatAssignment(
          diagnosticStudent?.subjects.find((row) => row.subjectId === diagnostic.subjectId) ?? null,
        );
      },
    },
    {
      id: 'result',
      header: 'Result',
      render: (diagnostic) => {
        const placement = diagnostic.placement;
        if (placement) {
          return (
            <div className="pace-diagnostic-result">
              <span>
                <strong>Learning gaps:</strong>{' '}
                {placement.learningGaps.length > 0
                  ? `PACEs # ${placement.learningGaps.join(', ')}`
                  : 'None'}
              </span>
              <span>
                <strong>Advance from:</strong>{' '}
                {placement.performanceLevelPace === null
                  ? 'Passed every PACE'
                  : `PACE # ${String(placement.performanceLevelPace)}`}
              </span>
              <details>
                <summary>View chart</summary>
                <PaceDiagnosticChart
                  attempted={diagnostic.attemptedPaceNumbers}
                  circled={diagnostic.circledPaceNumbers}
                />
              </details>
            </div>
          );
        }
        const startPace =
          diagnostic.test === 'Reading' || diagnostic.test === 'WordBuilding'
            ? recommendedStartPace(diagnostic.test, diagnostic.level ?? 0, diagnostic.outcome)
            : null;
        return (
          <div className="pace-diagnostic-result">
            <span>
              {`Level ${String(diagnostic.level)} `}
              <Badge tone={diagnostic.outcome === 'Pass' ? 'green' : 'red'}>
                {diagnostic.outcome}
              </Badge>
            </span>
            {startPace !== null ? (
              <span>
                <strong>Recommended start:</strong> PACE # {String(startPace)} (provisional)
              </span>
            ) : null}
            {diagnostic.test === 'Reading' ? (
              <span className="muted">
                Informs Science, Social Studies, Bible Reading and Literature and Creative Writing.
              </span>
            ) : null}
            {diagnostic.test ? null : <span className="muted">Older result</span>}
          </div>
        );
      },
    },
    {
      id: 'recorded',
      header: 'Recorded',
      render: (diagnostic) => formatDate(diagnostic.recordedAt),
    },
    {
      id: 'action',
      header: 'Action',
      render: (diagnostic) => (
        <>
          {diagnostic.placement &&
          diagnostic.placement.learningGaps.length > 0 &&
          diagnostic.placement.performanceLevelPace !== null ? (
            <Button
              onClick={() => {
                openGapSetup(diagnostic);
              }}
              size="sm"
              type="button"
              variant="secondary"
            >
              Set up Gap PACEs
            </Button>
          ) : null}
          <Button
            disabled={deleteDiagnostic.isPending}
            onClick={() => {
              deleteDiagnostic.reset();
              setPendingDiagnosticId(diagnostic.id);
            }}
            size="sm"
            type="button"
            variant="danger"
          >
            Delete diagnostic
          </Button>
        </>
      ),
    },
  ];

  if (summaryQuery.isLoading) {
    return <EmptyState detail="Loading PACE inventory..." title="Loading" />;
  }
  if (summaryQuery.error) {
    return (
      <EmptyState
        detail={friendlyErrorMessage(summaryQuery.error)}
        title="PACE inventory unavailable"
      />
    );
  }

  return (
    <div className="motion-page pace-inventory">
      <PaceInventoryTabs
        activeTab={activeTab}
        attentionCount={groupedAlerts.length}
        onChange={setActiveTab}
      />
      <div
        aria-labelledby="pace-inventory-tab-attention"
        hidden={activeTab !== 'attention'}
        id="pace-inventory-panel-attention"
        role="tabpanel"
      >
        {groupedAlerts.length > 0 ? (
          <section
            className="panel pace-inventory__alerts"
            aria-labelledby="pace-inventory-alerts-title"
          >
            <div className="panel__body">
              <div className="section-title">
                <div>
                  <h2 id="pace-inventory-alerts-title">Needs attention</h2>
                  <p className="muted">
                    Subjects with fewer than three future PACEs in supply or on order. A student
                    leaves this list once everything they still need has been ordered.
                  </p>
                </div>
                <Badge tone="amber">
                  {String(groupedAlerts.length)}{' '}
                  {groupedAlerts.length === 1 ? 'student' : 'students'}
                </Badge>
              </div>
              <div className="academic-list academic-list--compact">
                {groupedAlerts
                  .slice((alertPage - 1) * alertPageSize, alertPage * alertPageSize)
                  .map((group) => {
                    const alertStudent = students.find((row) => row.id === group.studentId);
                    return (
                      <div className="pace-inventory-alert-row" key={group.studentId}>
                        <div className="pace-inventory-alert-row__details">
                          <strong>{alertStudent?.fullName ?? 'Student'}</strong>
                          <div
                            aria-label="Subjects needing attention"
                            className="pace-inventory-alert-row__subjects"
                          >
                            {group.alerts.map((alert) => {
                              const alertAssignment = alertStudent?.subjects.find(
                                (row) => row.subjectId === alert.subjectId,
                              );
                              return (
                                <span
                                  className="pace-inventory-alert-subject"
                                  key={alert.subjectId}
                                >
                                  <span>{formatAssignment(alertAssignment ?? null)}</span>
                                  <span>
                                    {alert.remainingPaceCount === 0
                                      ? 'No future supply recorded'
                                      : `${formatPaceCount(alert.remainingPaceCount)} in supply`}
                                  </span>
                                  {alert.pendingOrders.length > 0 ? (
                                    <span>
                                      {alert.pendingOrders
                                        .map(
                                          (order) =>
                                            `#${String(order.paceNumber)} ${order.status === 'InTransit' ? 'in transit' : 'ordered'}`,
                                        )
                                        .join(' · ')}
                                    </span>
                                  ) : null}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                        <Button
                          aria-label={`Create order for ${alertStudent?.fullName ?? 'student'}`}
                          onClick={(event) => {
                            quickOrderTriggerRef.current = event.currentTarget;
                            setQuickOrderTarget({
                              studentId: group.studentId,
                            });
                          }}
                          size="sm"
                          type="button"
                          variant="secondary"
                        >
                          <PackagePlus aria-hidden="true" size={14} />
                          Create order
                        </Button>
                      </div>
                    );
                  })}
              </div>
              <InventoryPagination
                label="Children needing PACEs"
                onPageChange={setAlertPage}
                onPageSizeChange={(size) => {
                  setAlertPageSize(size);
                  setAlertPage(1);
                }}
                page={alertPage}
                pageSize={alertPageSize}
                total={groupedAlerts.length}
              />
            </div>
          </section>
        ) : (
          <EmptyState
            title="No shortages"
            detail="All recorded PACE supply is above the reorder threshold."
          />
        )}
      </div>

      <div
        aria-labelledby="pace-inventory-tab-planner"
        hidden={activeTab !== 'planner'}
        id="pace-inventory-panel-planner"
        role="tabpanel"
      >
        {students.length === 0 ? (
          <EmptyState
            detail="Create active students with assigned subjects before managing their PACE supply."
            title="No students available"
          />
        ) : (
          <>
            <section
              className="panel pace-inventory__planner"
              aria-labelledby="pace-inventory-selection-title"
            >
              <div className="panel__body">
                <div className="pace-inventory__planner-heading">
                  <div>
                    <p className="pace-inventory__eyebrow">Student PACE supply</p>
                    <h2 id="pace-inventory-selection-title">Plan what this student needs next</h2>
                    <p className="muted">
                      Add PACEs already on hand, or create a tracking record for an order placed on
                      the A.C.E. site.
                    </p>
                  </div>
                </div>
                <div className="form-grid form-grid--two">
                  <Field label="Student">
                    <SelectInput
                      onChange={(event) => {
                        chooseStudent(event.target.value);
                      }}
                      value={selectedStudentId}
                    >
                      {students.map((row) => (
                        <option key={row.id} value={row.id}>
                          {row.fullName} · {row.yearGroup}
                        </option>
                      ))}
                    </SelectInput>
                  </Field>
                  <Field label="Assigned subject">
                    <SelectInput
                      disabled={!student || student.subjects.length === 0}
                      onChange={(event) => {
                        chooseSubject(event.target.value);
                      }}
                      value={selectedSubjectId}
                    >
                      {student?.subjects.map((row) => (
                        <option key={row.subjectId} value={row.subjectId}>
                          {formatAssignment(row)} · Current {paceLabel(row.currentPaceNumber)}
                        </option>
                      ))}
                    </SelectInput>
                  </Field>
                </div>

                {assignment ? (
                  <div className="pace-inventory-summary" aria-live="polite">
                    <div className="pace-inventory-summary__current">
                      <span>Current PACE</span>
                      <strong>{paceLabel(assignment.currentPaceNumber)}</strong>
                    </div>
                    <div>
                      <span>Available now</span>
                      {availableFutureSupply.length > 0 ? (
                        <span className="pace-number-list">
                          {availableFutureSupply.map((paceNumber) => (
                            <span className="pace-number-list__chip" key={paceNumber}>
                              {paceLabel(paceNumber)}
                            </span>
                          ))}
                        </span>
                      ) : (
                        <strong>No future supply recorded</strong>
                      )}
                    </div>
                    <div>
                      <span>Awaiting delivery</span>
                      {pendingOrderPaceNumbers.length > 0 ? (
                        <span className="pace-number-list">
                          {(summary?.orders ?? [])
                            .filter(
                              (order) =>
                                order.studentId === selectedStudentId &&
                                order.subjectId === selectedSubjectId &&
                                order.status !== 'Delivered',
                            )
                            .map((order) => (
                              <span className="pace-number-list__chip" key={order.id}>
                                {paceLabel(order.paceNumber)} ·{' '}
                                {order.status === 'InTransit' ? 'In transit' : 'Ordered'}
                              </span>
                            ))}
                        </span>
                      ) : (
                        <strong>No orders awaiting delivery</strong>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            </section>

            <section className="panel pace-inventory__planner pace-inventory__planner--selection">
              <div className="panel__body">
                {assignment ? (
                  <PaceCataloguePicker
                    availablePaceNumbers={availablePaceNumbers}
                    currentPaceNumber={assignment.currentPaceNumber}
                    disabled={isBulkMutationPending}
                    onChange={(paceNumbers) => {
                      setPaceSelection({ assignmentKey: selectionContextKey, paceNumbers });
                    }}
                    selectedPaceNumbers={selectedPaceNumbers}
                    subjectLabel={`${student?.fullName ?? 'Selected student'} · ${formatAssignment(assignment)}`}
                  />
                ) : (
                  <p className="field__hint">Choose an assigned subject to plan PACEs.</p>
                )}
                <div className="pace-inventory-actions">
                  <Button
                    disabled={!assignment || !hasSelection || isBulkMutationPending}
                    onClick={addSelectedSupply}
                    pending={addCurrentSupply.isPending}
                    type="button"
                  >
                    <PackagePlus aria-hidden="true" size={16} />
                    Add to current supply
                  </Button>
                  <Button
                    disabled={!assignment || !hasSelection || isBulkMutationPending}
                    onClick={createSelectedOrders}
                    pending={createOrders.isPending}
                    type="button"
                    variant="secondary"
                  >
                    <Truck aria-hidden="true" size={16} />
                    Create order
                  </Button>
                  <span className="field__hint">
                    Current supply is ready to use now. Orders stay tracked until marked delivered.
                  </span>
                </div>
              </div>
            </section>
          </>
        )}
      </div>

      {activeTab === 'orders' ? (
        <div
          aria-labelledby="pace-inventory-tab-orders"
          id="pace-inventory-panel-orders"
          role="tabpanel"
        >
          <PaceInventoryOrders
            invalidateInventory={invalidateInventory}
            refreshSummary={() => summaryQuery.refetch()}
            summary={summary}
          />
        </div>
      ) : null}

      <div
        aria-labelledby="pace-inventory-tab-diagnostics"
        hidden={activeTab !== 'diagnostics'}
        id="pace-inventory-panel-diagnostics"
        role="tabpanel"
      >
        <section className="panel pace-inventory__secondary" aria-labelledby="diagnostics-title">
          <div className="panel__body">
            <div className="section-title">
              <div>
                <h2 id="diagnostics-title">Diagnostic Results</h2>
                <p className="muted">
                  For the Head&apos;s reference only; it never changes current PACE.
                </p>
              </div>
            </div>
            <div
              className="pace-gap-tabs"
              role="tablist"
              aria-label="Diagnostic results and gap PACE views"
              onKeyDown={(event) => {
                if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                event.preventDefault();
                const next = event.key === 'Home' || event.key === 'ArrowLeft' ? 'results' : 'gaps';
                setDiagnosticTab(next);
                document.getElementById(`diagnostic-tab-${next}`)?.focus();
              }}
            >
              <button
                id="diagnostic-tab-results"
                type="button"
                role="tab"
                aria-selected={diagnosticTab === 'results'}
                aria-controls="diagnostic-panel-results"
                tabIndex={diagnosticTab === 'results' ? 0 : -1}
                onClick={() => {
                  setDiagnosticTab('results');
                }}
              >
                Results
              </button>
              <button
                id="diagnostic-tab-gaps"
                type="button"
                role="tab"
                aria-selected={diagnosticTab === 'gaps'}
                aria-controls="diagnostic-panel-gaps"
                tabIndex={diagnosticTab === 'gaps' ? 0 : -1}
                onClick={() => {
                  setDiagnosticTab('gaps');
                }}
              >
                Gap PACEs
              </button>
            </div>
            <div
              id="diagnostic-panel-results"
              role="tabpanel"
              aria-labelledby="diagnostic-tab-results"
              tabIndex={0}
              hidden={diagnosticTab !== 'results'}
            >
              <Field label="Student">
                <SelectInput
                  value={selectedStudentId}
                  onChange={(event) => {
                    chooseStudent(event.target.value);
                  }}
                >
                  {students.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.fullName} · {row.yearGroup}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <PaceDiagnosticForm
                disabled={!student}
                onSubmit={recordSelectedDiagnostic}
                pending={recordDiagnostic.isPending}
                selectionLabel={student?.fullName ?? 'Select a student'}
              />
              <DataTable
                columns={diagnosticColumns}
                empty="No diagnostic results have been recorded yet."
                getRowKey={(diagnostic) => diagnostic.id}
                loading={diagnosticHistory.isLoading}
                errorMessage={
                  diagnosticHistory.error
                    ? friendlyErrorMessage(diagnosticHistory.error)
                    : undefined
                }
                rows={diagnosticHistory.data?.rows ?? []}
              />
              {diagnosticHistory.data ? (
                <InventoryPagination
                  label="Diagnostic results"
                  onPageChange={setDiagnosticPage}
                  onPageSizeChange={(size) => {
                    setDiagnosticPageSize(size);
                    setDiagnosticPage(1);
                  }}
                  page={diagnosticPage}
                  pageSize={diagnosticPageSize}
                  total={diagnosticHistory.data.totalRows}
                />
              ) : null}
            </div>
            <div
              id="diagnostic-panel-gaps"
              role="tabpanel"
              aria-labelledby="diagnostic-tab-gaps"
              tabIndex={0}
              hidden={diagnosticTab !== 'gaps'}
            >
              <div className="form-grid form-grid--two">
                <Field label="Student">
                  <SelectInput
                    value={selectedStudentId}
                    onChange={(event) => {
                      chooseStudent(event.target.value);
                    }}
                  >
                    {students.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.fullName} · {row.yearGroup}
                      </option>
                    ))}
                  </SelectInput>
                </Field>
                <Field label="Assigned subject">
                  <SelectInput
                    value={selectedSubjectId}
                    disabled={!student || student.subjects.length === 0}
                    onChange={(event) => {
                      chooseSubject(event.target.value);
                    }}
                  >
                    {student?.subjects.map((row) => (
                      <option key={row.subjectId} value={row.subjectId}>
                        {formatAssignment(row)} · Current {paceLabel(row.currentPaceNumber)}
                      </option>
                    ))}
                  </SelectInput>
                </Field>
              </div>
              {activeTab === 'diagnostics' && diagnosticTab === 'gaps' ? (
                <PaceGapPlanPanel
                  initialGaps={prefillForGaps?.gaps}
                  initialJumpTo={prefillForGaps?.jumpTo}
                  studentId={selectedStudentId}
                  subjectId={selectedSubjectId}
                />
              ) : null}
            </div>
          </div>
        </section>
      </div>

      {pendingDiagnosticId ? (
        <ConfirmationDialog
          confirmLabel="Delete diagnostic"
          errorMessage={
            deleteDiagnostic.error ? friendlyErrorMessage(deleteDiagnostic.error) : undefined
          }
          onCancel={() => {
            setPendingDiagnosticId(null);
          }}
          onConfirm={() => {
            deleteDiagnostic.mutate({ diagnosticId: pendingDiagnosticId });
          }}
          open
          pending={deleteDiagnostic.isPending}
          title="Delete diagnostic result?"
          variant="danger"
        >
          This removes the diagnostic reference only. It does not change the student&apos;s current
          PACE.
        </ConfirmationDialog>
      ) : null}
      {quickOrderTarget ? (
        <PaceInventoryOrderModal
          onClose={closeQuickOrder}
          onSubmit={submitQuickOrder}
          pending={createOrders.isPending}
          studentName={quickOrderStudent?.fullName ?? 'Student unavailable'}
          subjects={quickOrderSubjects}
        />
      ) : null}
    </div>
  );
}

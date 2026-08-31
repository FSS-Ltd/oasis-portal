'use client';

import { useState } from 'react';
import { PackagePlus, RefreshCw, Truck } from 'lucide-react';
import { availablePacesAhead, PACE_CATALOGUE } from '@oasis/domain';
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
import { PaceDiagnosticForm, type PaceDiagnosticSelection } from './pace-diagnostic-form';

type InventorySummary = RouterOutputs['academicInventory']['summary'];
type InventoryStudent = InventorySummary['students'][number];
type InventoryAssignment = InventoryStudent['subjects'][number];
type InventoryOrder = InventorySummary['orders'][number];
type InventoryDiagnostic = InventorySummary['diagnostics'][number];

const dateFormatter = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' });

function selectedStudent(students: InventoryStudent[], studentId: string): InventoryStudent | null {
  return students.find((student) => student.id === studentId) ?? students[0] ?? null;
}

function selectedAssignment(
  student: InventoryStudent | null,
  subjectId: string,
): InventoryAssignment | null {
  if (!student) return null;

  return (
    student.subjects.find((assignment) => assignment.subjectId === subjectId) ??
    student.subjects[0] ??
    null
  );
}

function nextOrderStatus(status: InventoryOrder['status']): 'Delivered' | 'InTransit' | null {
  if (status === 'Ordered') return 'InTransit';
  return status === 'InTransit' ? 'Delivered' : null;
}

function formatAssignment(assignment: InventoryAssignment | null): string {
  if (!assignment) return 'No assigned subject';
  return `${assignment.subject.code} · ${assignment.subject.name}`;
}

function formatDate(value: Date | string): string {
  return dateFormatter.format(new Date(value));
}

function orderStatusTone(status: InventoryOrder['status']): 'blue' | 'green' | 'grey' {
  if (status === 'Delivered') return 'green';
  return status === 'InTransit' ? 'blue' : 'grey';
}

function paceLabel(paceNumber: number): string {
  return `PACE #${String(paceNumber)}`;
}

function formatPaceCount(count: number): string {
  return `${String(count)} ${count === 1 ? 'PACE' : 'PACEs'}`;
}

export function PaceInventoryClient() {
  const utils = api.useUtils();
  const summaryQuery = api.academicInventory.summary.useQuery(undefined, { retry: false });
  const [studentId, setStudentId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [selectedPaceNumbers, setSelectedPaceNumbers] = useState<number[]>([]);
  const [pendingDiagnosticId, setPendingDiagnosticId] = useState<string | null>(null);

  const summary = summaryQuery.data;
  const students = summary?.students ?? [];
  const student = selectedStudent(students, studentId);
  const assignment = selectedAssignment(student, subjectId);
  const selectedStudentId = student?.id ?? '';
  const selectedSubjectId = assignment?.subjectId ?? '';
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

  async function invalidateInventory(): Promise<void> {
    await Promise.all([
      utils.academicInventory.summary.invalidate(),
      utils.pace.forStudent.invalidate(),
      utils.pace.roster.invalidate(),
      utils.student.dashboard.invalidate(),
    ]);
  }

  const addCurrentSupply = api.academicInventory.addCurrentSupply.useMutation({
    async onSuccess(_, input) {
      setSelectedPaceNumbers([]);
      showSuccessToast(`${formatPaceCount(input.paceNumbers.length)} added to current supply.`);
      await invalidateInventory();
    },
    onError(error) {
      showErrorToast(error, 'Current PACE supply could not be updated.');
    },
  });
  const createOrders = api.academicInventory.createOrders.useMutation({
    async onSuccess(_, input) {
      setSelectedPaceNumbers([]);
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
  const updateOrderStatus = api.academicInventory.updateOrderStatus.useMutation({
    async onSuccess(_, input) {
      showSuccessToast(`Order marked ${input.status}.`);
      await invalidateInventory();
    },
    onError(error) {
      showErrorToast(error, 'PACE order status could not be updated.');
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
    setSelectedPaceNumbers([]);
  }

  function chooseSubject(value: string): void {
    setSubjectId(value);
    setSelectedPaceNumbers([]);
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
    createOrders.mutate({
      studentId: student.id,
      subjectId: assignment.subjectId,
      paceNumbers: selectedPaceNumbers,
    });
  }

  function recordSelectedDiagnostic(selection: PaceDiagnosticSelection): void {
    if (!student || !assignment || recordDiagnostic.isPending) return;
    recordDiagnostic.mutate({
      studentId: student.id,
      subjectId: assignment.subjectId,
      ...selection,
    });
  }

  const orderColumns: readonly DataTableColumn<InventoryOrder>[] = [
    {
      id: 'student',
      header: 'Student',
      render: (order) =>
        students.find((row) => row.id === order.studentId)?.fullName ?? 'Unknown student',
    },
    {
      id: 'subject',
      header: 'Subject',
      render: (order) => {
        const orderStudent = students.find((row) => row.id === order.studentId);
        return formatAssignment(
          orderStudent?.subjects.find((row) => row.subjectId === order.subjectId) ?? null,
        );
      },
    },
    { id: 'pace', header: 'PACE', render: (order) => paceLabel(order.paceNumber) },
    {
      id: 'status',
      header: 'Status',
      render: (order) => <Badge tone={orderStatusTone(order.status)}>{order.status}</Badge>,
    },
    { id: 'ordered', header: 'Ordered', render: (order) => formatDate(order.orderedAt) },
    {
      id: 'action',
      header: 'Next action',
      render: (order) => {
        const nextStatus = nextOrderStatus(order.status);
        if (!nextStatus) return 'Complete';

        return (
          <Button
            onClick={() => {
              updateOrderStatus.mutate({ orderId: order.id, status: nextStatus });
            }}
            pending={updateOrderStatus.isPending}
            size="sm"
            type="button"
            variant="secondary"
          >
            <Truck aria-hidden="true" size={14} />
            Mark {nextStatus}
          </Button>
        );
      },
    },
  ];

  const diagnosticColumns: readonly DataTableColumn<InventoryDiagnostic>[] = [
    {
      id: 'student',
      header: 'Student',
      render: (diagnostic) =>
        students.find((row) => row.id === diagnostic.studentId)?.fullName ?? 'Unknown student',
    },
    {
      id: 'subject',
      header: 'Subject',
      render: (diagnostic) => {
        const diagnosticStudent = students.find((row) => row.id === diagnostic.studentId);
        return formatAssignment(
          diagnosticStudent?.subjects.find((row) => row.subjectId === diagnostic.subjectId) ?? null,
        );
      },
    },
    { id: 'level', header: 'Level', render: (diagnostic) => `Level ${String(diagnostic.level)}` },
    {
      id: 'outcome',
      header: 'Result',
      render: (diagnostic) => (
        <Badge tone={diagnostic.outcome === 'Pass' ? 'green' : 'red'}>{diagnostic.outcome}</Badge>
      ),
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
    <div className="motion-page">
      {summary && summary.alerts.length > 0 ? (
        <section className="panel" aria-labelledby="pace-inventory-alerts-title">
          <div className="panel__body">
            <div className="section-title">
              <h2 id="pace-inventory-alerts-title">Supply alerts</h2>
              <Badge tone="amber">{String(summary.alerts.length)} require attention</Badge>
            </div>
            <div className="academic-list">
              {summary.alerts.map((alert) => {
                const alertStudent = students.find((row) => row.id === alert.studentId);
                const alertAssignment = alertStudent?.subjects.find(
                  (row) => row.subjectId === alert.subjectId,
                );

                return (
                  <div
                    className="academic-row academic-row--stack"
                    key={`${alert.studentId}-${alert.subjectId}`}
                  >
                    <div>
                      <strong>{alertStudent?.fullName ?? 'Student'}</strong>
                      <span>{formatAssignment(alertAssignment ?? null)}</span>
                    </div>
                    <Badge tone="amber">Current {paceLabel(alert.currentPaceNumber)}</Badge>
                    <Badge tone="grey">{formatPaceCount(alert.remainingPaceCount)} available</Badge>
                    <span className="pace-number-list" aria-label="Available PACE numbers">
                      {alert.availablePaceNumbers.map((paceNumber) => (
                        <span className="pace-number-list__chip" key={paceNumber}>
                          {paceLabel(paceNumber)}
                        </span>
                      ))}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      {students.length === 0 ? (
        <EmptyState
          detail="Create active students with assigned subjects before managing their PACE supply."
          title="No students available"
        />
      ) : (
        <>
          <section className="panel" aria-labelledby="pace-inventory-selection-title">
            <div className="panel__body">
              <div className="section-title">
                <h2 id="pace-inventory-selection-title">Student and subject</h2>
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
                  <div>
                    <span>Current PACE</span>
                    <strong>{paceLabel(assignment.currentPaceNumber)}</strong>
                  </div>
                  <div>
                    <span>Available future PACE numbers</span>
                    {availableFutureSupply.length > 0 ? (
                      <span className="pace-number-list">
                        {availableFutureSupply.map((paceNumber) => (
                          <span className="pace-number-list__chip" key={paceNumber}>
                            {paceLabel(paceNumber)}
                          </span>
                        ))}
                      </span>
                    ) : (
                      <strong>No future PACEs currently supplied</strong>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </section>

          <section className="panel">
            <div className="panel__body">
              <PaceCataloguePicker
                availablePaceNumbers={availablePaceNumbers}
                disabled={!assignment || isBulkMutationPending}
                onChange={setSelectedPaceNumbers}
                selectedPaceNumbers={selectedPaceNumbers}
                subjectLabel={`${student?.fullName ?? 'Selected student'} · ${formatAssignment(assignment)}`}
              />
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

      <section className="panel" aria-labelledby="pace-orders-title">
        <div className="panel__body">
          <div className="section-title">
            <h2 id="pace-orders-title">PACE order history</h2>
            <Button
              onClick={() => {
                void summaryQuery.refetch();
              }}
              pending={summaryQuery.isFetching}
              size="sm"
              type="button"
              variant="secondary"
            >
              <RefreshCw aria-hidden="true" size={14} />
              Refresh
            </Button>
          </div>
          <DataTable
            columns={orderColumns}
            empty="No PACE orders have been created yet."
            getRowKey={(order) => order.id}
            rows={summary?.orders ?? []}
          />
        </div>
      </section>

      <section className="panel" aria-labelledby="diagnostics-title">
        <div className="panel__body">
          <div className="section-title">
            <h2 id="diagnostics-title">Diagnostic reference</h2>
          </div>
          <PaceDiagnosticForm
            disabled={!student || !assignment}
            onSubmit={recordSelectedDiagnostic}
            pending={recordDiagnostic.isPending}
            selectionLabel={`${student?.fullName ?? 'Select a student'} · ${formatAssignment(assignment)}`}
          />
          <DataTable
            columns={diagnosticColumns}
            empty="No diagnostic results have been recorded yet."
            getRowKey={(diagnostic) => diagnostic.id}
            rows={summary?.diagnostics ?? []}
          />
        </div>
      </section>

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
    </div>
  );
}

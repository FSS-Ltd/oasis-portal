'use client';

import { useMemo, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { api } from '@/lib/trpc';
import { MotionList, MotionTableRow } from '@/components/admin/motion';
import { Button } from '@/components/ui/button';
import { TextInput } from '@/components/ui/field';

const attendanceStatuses = ['Present', 'Absent', 'Late'] as const;

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function asDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function downloadCsv(filename: string, csv: string, contentType: string): void {
  const blob = new Blob([csv], { type: contentType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function AttendanceRoster() {
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const date = useMemo(() => asDate(selectedDate), [selectedDate]);
  const utils = api.useUtils();

  const attendanceQuery = api.attendance.forDate.useQuery({ date }, { retry: false });
  const exportQuery = api.attendance.exportStudentsCsv.useQuery(
    { from: date, to: date },
    { enabled: false, retry: false },
  );
  const markMutation = api.attendance.mark.useMutation({
    onSuccess: async () => {
      await utils.attendance.forDate.invalidate({ date });
    },
  });

  const rows = attendanceQuery.data ?? [];

  return (
    <section>
      <div className="toolbar attendance-toolbar">
        <div className="toolbar__search attendance-toolbar__date">
          <TextInput
            aria-label="Attendance date"
            onChange={(event) => setSelectedDate(event.target.value)}
            type="date"
            value={selectedDate}
          />
          <Button
            onClick={() => attendanceQuery.refetch()}
            pending={attendanceQuery.isFetching}
            type="button"
            variant="secondary"
          >
            <RefreshCw aria-hidden="true" size={16} />
            Refresh
          </Button>
        </div>
        <Button
          onClick={async () => {
            const result = await exportQuery.refetch();
            if (result.data) {
              downloadCsv(result.data.filename, result.data.csv, result.data.contentType);
            }
          }}
          pending={exportQuery.isFetching}
          type="button"
          variant="secondary"
        >
          <Download aria-hidden="true" size={16} />
          Export CSV
        </Button>
      </div>

      <div className="panel panel--scroll">
        {attendanceQuery.isLoading ? (
          <div className="empty-state">Loading attendance...</div>
        ) : attendanceQuery.error ? (
          <div className="empty-state status--error">{attendanceQuery.error.message}</div>
        ) : rows.length === 0 ? (
          <div className="empty-state">
            <strong>No active students found</strong>
            <span>Create active students before recording attendance.</span>
          </div>
        ) : (
          <MotionList>
            <table className="table attendance-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Year</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Recorded</th>
                  <th>
                    <span className="sr-only">Mark attendance</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <MotionTableRow key={row.studentId}>
                    <td>
                      <div className="student-row">
                        <span className="student-row__avatar">{initials(row.studentName)}</span>
                        <span className="student-row__text">
                          <strong>{row.studentName}</strong>
                          <span>{row.studentId}</span>
                        </span>
                      </div>
                    </td>
                    <td>{row.yearGroup}</td>
                    <td>{row.date}</td>
                    <td>
                      <span className={row.status ? 'badge badge--green' : 'badge badge--amber'}>
                        {row.status ?? 'Unmarked'}
                      </span>
                    </td>
                    <td>
                      {row.recordedAt ? (
                        row.recordedAt.toLocaleString()
                      ) : (
                        <span className="muted">Not recorded</span>
                      )}
                    </td>
                    <td>
                      <div className="segmented-actions">
                        {attendanceStatuses.map((status) => (
                          <Button
                            className={row.status === status ? 'is-selected' : undefined}
                            disabled={markMutation.isPending}
                            key={status}
                            onClick={() =>
                              markMutation.mutate({
                                studentId: row.studentId,
                                date,
                                status,
                              })
                            }
                            size="sm"
                            type="button"
                            variant={row.status === status ? 'primary' : 'secondary'}
                          >
                            {status}
                          </Button>
                        ))}
                      </div>
                    </td>
                  </MotionTableRow>
                ))}
              </tbody>
            </table>
          </MotionList>
        )}
      </div>

      {markMutation.error ? (
        <p className="status--error attendance-error">{markMutation.error.message}</p>
      ) : null}
      {exportQuery.error ? (
        <p className="status--error attendance-error">{exportQuery.error.message}</p>
      ) : null}
    </section>
  );
}

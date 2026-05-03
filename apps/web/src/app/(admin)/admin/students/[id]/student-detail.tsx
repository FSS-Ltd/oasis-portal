'use client';

import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { StudentDrillThroughContent } from '@/components/student-drillthrough/student-drillthrough-content';
import { api } from '@/lib/trpc';
import { StudentAdminEditor } from './student-admin-editor';

interface StudentDetailProps {
  canEdit: boolean;
  studentId: string;
}

export function StudentDetail({ canEdit, studentId }: StudentDetailProps) {
  const router = useRouter();
  const utils = api.useUtils();
  const [editing, setEditing] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveConfirmation, setArchiveConfirmation] = useState('');
  const archiveStudent = api.admin.archiveStudent.useMutation({
    async onSuccess() {
      await Promise.all([
        utils.childLog.listAccessibleStudents.invalidate(),
        utils.childLog.drillThrough.invalidate({ studentId }),
        utils.student.list.invalidate(),
        utils.student.byId.invalidate({ id: studentId }),
      ]);
      setArchiveOpen(false);
      setArchiveConfirmation('');
      router.push('/admin/students/archive');
    },
  });

  if (editing && canEdit) {
    return (
      <div className="student-profile-edit">
        <div className="student-profile-edit__toolbar">
          <Button
            onClick={() => {
              setEditing(false);
            }}
            type="button"
            variant="ghost"
          >
            <ArrowLeft aria-hidden="true" size={14} />
            Back to overview
          </Button>
        </div>
        <StudentAdminEditor studentId={studentId} />
      </div>
    );
  }

  return (
    <>
      <StudentDrillThroughContent
        archivePending={archiveStudent.isPending}
        backHref="/admin/students"
        backLabel="Back to Students"
        onArchive={
          canEdit
            ? () => {
                setArchiveOpen(true);
              }
            : undefined
        }
        onEdit={
          canEdit
            ? () => {
                setEditing(true);
              }
            : undefined
        }
        studentId={studentId}
      />
      {archiveOpen ? (
        <ConfirmationDialog
          body={
            <>
              <p>
                This will remove the student from active rosters and preserve their attendance,
                behaviour, PACE, notes, merit, report, guardian, and shop records.
              </p>
              <p>If the student has a login, their sign-in access will be deleted.</p>
            </>
          }
          confirmLabel="Archive Student"
          confirmation={archiveConfirmation}
          errorMessage={archiveStudent.error?.message}
          expectedConfirmation="ARCHIVE"
          onCancel={() => {
            setArchiveOpen(false);
            setArchiveConfirmation('');
          }}
          onConfirm={() => {
            archiveStudent.mutate({ studentId, confirmation: 'ARCHIVE' });
          }}
          onConfirmationChange={setArchiveConfirmation}
          pending={archiveStudent.isPending}
          title="Archive Student"
        />
      ) : null}
    </>
  );
}

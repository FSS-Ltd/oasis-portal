'use client';

import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { StudentDrillThroughContent } from '@/components/student-drillthrough/student-drillthrough-content';
import { StudentAdminEditor } from './student-admin-editor';

interface StudentDetailProps {
  canEdit: boolean;
  studentId: string;
}

export function StudentDetail({ canEdit, studentId }: StudentDetailProps) {
  const [editing, setEditing] = useState(false);

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
    <StudentDrillThroughContent
      backHref="/admin/students"
      backLabel="Back to Students"
      onEdit={canEdit ? () => {
        setEditing(true);
      } : undefined}
      studentId={studentId}
    />
  );
}

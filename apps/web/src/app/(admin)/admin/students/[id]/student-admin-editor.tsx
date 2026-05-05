'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Archive, Link2, RotateCcw, Save } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  STANDARD_SCHOOL_YEARS,
  canonicalSchoolYear,
  displaySchoolYearLabel,
  type StandardSchoolYear,
} from '@oasis/domain';
import { api } from '@/lib/trpc';
import { roleLabel } from '@/lib/profile-display';
import { deriveSchoolYearFromDateInput } from '@/lib/school-year-form';
import { ConfirmationDialog } from '@/components/admin/confirmation-dialog';
import { MotionItem } from '@/components/admin/motion';
import { Button } from '@/components/ui/button';
import { Field, SelectInput, TextInput } from '@/components/ui/field';
import { StudentRegistrationPanel } from './student-registration-panel';

function isStandardSchoolYear(value: string): value is StandardSchoolYear {
  return STANDARD_SCHOOL_YEARS.includes(value as StandardSchoolYear);
}

function parseStandardSchoolYear(value: string): StandardSchoolYear {
  if (!isStandardSchoolYear(value)) throw new Error('Choose a standard year group');
  return value;
}

const editSchema = z.object({
  fullName: z.string().trim().min(1, 'Enter the student name'),
  dob: z.string().min(1, 'Enter the date of birth'),
  yearGroup: z.string().refine(isStandardSchoolYear, 'Choose a standard year group'),
  enrolmentDate: z.string().min(1, 'Enter the enrolment date'),
  address: z.string().trim().optional(),
});

type EditValues = z.input<typeof editSchema>;

interface StudentAdminEditorProps {
  studentId: string;
}

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export function StudentAdminEditor({ studentId }: StudentAdminEditorProps) {
  const utils = api.useUtils();
  const studentQuery = api.student.byId.useQuery({ id: studentId }, { retry: false });
  const subjectsQuery = api.admin.listActiveSubjects.useQuery(undefined, { retry: false });
  const [statusAction, setStatusAction] = useState<'archive' | 'restore' | null>(null);
  const updateStudent = api.student.update.useMutation({
    async onSuccess() {
      await Promise.all([
        utils.student.byId.invalidate({ id: studentId }),
        utils.student.list.invalidate(),
      ]);
    },
  });
  const updateStudentStatus = api.student.update.useMutation({
    async onSuccess() {
      await Promise.all([
        utils.student.byId.invalidate({ id: studentId }),
        utils.student.list.invalidate(),
        utils.childLog.listAccessibleStudents.invalidate(),
        utils.childLog.drillThrough.invalidate({ studentId }),
      ]);
      setStatusAction(null);
    },
  });
  const assignSubject = api.student.assignSubject.useMutation({
    async onSuccess() {
      await utils.student.byId.invalidate({ id: studentId });
    },
  });
  const setCurrentPace = api.student.setCurrentPace.useMutation({
    async onSuccess() {
      await utils.student.byId.invalidate({ id: studentId });
    },
  });
  const linkGuardian = api.admin.linkGuardian.useMutation();
  const [subjectId, setSubjectId] = useState('');
  const [paceNumber, setPaceNumber] = useState('1001');
  const [paceDrafts, setPaceDrafts] = useState<Record<string, string>>({});
  const [guardianEmail, setGuardianEmail] = useState('');
  const [selectedGuardianId, setSelectedGuardianId] = useState('');
  const [updatedSubjectId, setUpdatedSubjectId] = useState<string | null>(null);
  const guardianLookup = api.admin.searchGuardianAccounts.useQuery(
    { search: guardianEmail.trim() || 'none', limit: 5 },
    { enabled: false, retry: false },
  );

  const {
    formState: { errors },
    handleSubmit,
    register,
    reset,
    setValue,
    watch,
  } = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      fullName: '',
      dob: '',
      yearGroup: '',
      enrolmentDate: '',
      address: '',
    },
  });
  const lastAutoYear = useRef<StandardSchoolYear | null>(null);
  const dobValue = watch('dob');
  const yearGroupValue = watch('yearGroup');

  useEffect(() => {
    const student = studentQuery.data;
    if (!student) return;
    const derived = deriveSchoolYearFromDateInput(student.dob);
    lastAutoYear.current = derived && student.yearGroup === derived ? derived : null;
    reset({
      fullName: student.fullName,
      dob: student.dob,
      yearGroup: canonicalSchoolYear(student.yearGroup) ?? '',
      enrolmentDate: new Date(student.enrolmentDate).toISOString().slice(0, 10),
      address: student.address ?? '',
    });
    setPaceDrafts(
      Object.fromEntries(
        student.subjects.map((subject) => [subject.subjectId, String(subject.currentPaceNumber)]),
      ),
    );
    setStatusAction(null);
  }, [reset, studentQuery.data]);

  useEffect(() => {
    const derived = deriveSchoolYearFromDateInput(dobValue);
    if (!derived) return;
    if (!yearGroupValue || yearGroupValue === lastAutoYear.current) {
      setValue('yearGroup', derived, { shouldDirty: true, shouldValidate: true });
      lastAutoYear.current = derived;
    }
  }, [dobValue, setValue, yearGroupValue]);

  if (studentQuery.isLoading) {
    return <div className="empty-state">Loading student...</div>;
  }

  if (studentQuery.error || !studentQuery.data) {
    return (
      <div className="empty-state status--error">
        {studentQuery.error?.message ?? 'Student not found'}
      </div>
    );
  }

  const student = studentQuery.data;
  const guardianRows = guardianLookup.data ?? [];

  return (
    <>
      <div className="page-header">
        <div className="student-row">
          <span className="student-row__avatar">{initials(student.fullName)}</span>
          <div className="student-row__text">
            <p>Student profile</p>
            <h1>{student.fullName}</h1>
            <p>
              Edit the student record, assign active ACE subjects, and connect guardian accounts.
            </p>
          </div>
        </div>
        <span className={student.active ? 'badge badge--green' : 'badge badge--amber'}>
          {student.active ? 'Active' : 'Archived'}
        </span>
      </div>

      <div className="grid grid--two student-profile-layout">
        <MotionItem>
          <div className="grid student-profile-main">
            <form
              className="panel"
              onSubmit={(event) => {
                void handleSubmit((values) => {
                  updateStudent.mutate({
                    id: student.id,
                    fullName: values.fullName,
                    dob: new Date(values.dob),
                    yearGroup: parseStandardSchoolYear(values.yearGroup),
                    enrolmentDate: new Date(values.enrolmentDate),
                    address: values.address || null,
                  });
                })(event);
              }}
            >
              <div className="panel__body form-grid">
                <div className="section-title">
                  <h2>Student details</h2>
                  {updateStudent.isSuccess ? <span className="status--success">Saved</span> : null}
                </div>
                <div className="form-grid form-grid--two">
                  <Field error={errors.fullName?.message} label="Full name">
                    <TextInput {...register('fullName')} />
                  </Field>
                  <Field error={errors.yearGroup?.message} label="Year group">
                    <SelectInput {...register('yearGroup')}>
                      <option value="">Choose year group</option>
                      {STANDARD_SCHOOL_YEARS.map((year) => (
                        <option key={year} value={year}>
                          {displaySchoolYearLabel(year)}
                        </option>
                      ))}
                    </SelectInput>
                  </Field>
                  <Field error={errors.dob?.message} label="Date of birth">
                    <TextInput type="date" {...register('dob')} />
                  </Field>
                  <Field error={errors.enrolmentDate?.message} label="Enrolment date">
                    <TextInput type="date" {...register('enrolmentDate')} />
                  </Field>
                </div>
                <Field error={errors.address?.message} label="Address">
                  <TextInput {...register('address')} />
                </Field>
                {updateStudent.error ? (
                  <p className="status--error" role="alert">
                    {updateStudent.error.message}
                  </p>
                ) : null}
                <div>
                  <Button pending={updateStudent.isPending} type="submit">
                    <Save aria-hidden="true" size={16} />
                    Save changes
                  </Button>
                </div>
              </div>
            </form>

            <StudentRegistrationPanel studentId={studentId} />
          </div>
        </MotionItem>

        <div className="grid student-profile-side">
          <MotionItem>
            <section className="panel">
              <div className="panel__body">
                <div className="section-title">
                  <h2>Subjects</h2>
                </div>
                <div className="badge-list">
                  {student.subjects.length > 0 ? (
                    student.subjects.map((subject) => (
                      <span className="badge" key={subject.subjectId}>
                        {subject.code} PACE {subject.currentPaceNumber}
                      </span>
                    ))
                  ) : (
                    <span className="muted">No subjects assigned</span>
                  )}
                </div>
                {student.subjects.length > 0 ? (
                  <div className="academic-list academic-list--compact">
                    {student.subjects.map((subject) => (
                      <form
                        className="academic-row"
                        key={subject.subjectId}
                        onSubmit={(event) => {
                          event.preventDefault();
                          setUpdatedSubjectId(subject.subjectId);
                          setCurrentPace.mutate({
                            studentId,
                            subjectId: subject.subjectId,
                            currentPaceNumber: Number(paceDrafts[subject.subjectId]),
                          });
                        }}
                      >
                        <div>
                          <strong>{subject.code}</strong>
                          <span>{subject.name}</span>
                        </div>
                        <TextInput
                          aria-label={`${subject.code} current PACE`}
                          min={1}
                          onChange={(event) => {
                            setPaceDrafts((drafts) => ({
                              ...drafts,
                              [subject.subjectId]: event.target.value,
                            }));
                          }}
                          type="number"
                          value={paceDrafts[subject.subjectId] ?? String(subject.currentPaceNumber)}
                        />
                        <Button
                          pending={
                            setCurrentPace.isPending && updatedSubjectId === subject.subjectId
                          }
                          size="sm"
                          type="submit"
                          variant="secondary"
                        >
                          Update PACE
                        </Button>
                      </form>
                    ))}
                  </div>
                ) : null}
                {setCurrentPace.error ? (
                  <p className="status--error">{setCurrentPace.error.message}</p>
                ) : null}
                {setCurrentPace.isSuccess ? (
                  <p className="status--success">Current PACE updated</p>
                ) : null}
                <div className="divider" />
                <form
                  className="form-grid"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!subjectId) return;
                    assignSubject.mutate({
                      studentId,
                      subjectId,
                      currentPaceNumber: Number(paceNumber),
                    });
                  }}
                >
                  <Field label="Assign subject">
                    <SelectInput
                      onChange={(event) => {
                        setSubjectId(event.target.value);
                      }}
                      value={subjectId}
                    >
                      <option value="">Choose subject</option>
                      {(subjectsQuery.data ?? []).map((subject) => (
                        <option key={subject.id} value={subject.id}>
                          {subject.code} - {subject.name}
                        </option>
                      ))}
                    </SelectInput>
                  </Field>
                  <Field label="Current PACE number">
                    <TextInput
                      min={1}
                      onChange={(event) => {
                        setPaceNumber(event.target.value);
                      }}
                      type="number"
                      value={paceNumber}
                    />
                  </Field>
                  {assignSubject.error ? (
                    <p className="status--error">{assignSubject.error.message}</p>
                  ) : null}
                  {assignSubject.isSuccess ? (
                    <p className="status--success">Subject assignment updated</p>
                  ) : null}
                  <Button pending={assignSubject.isPending} type="submit">
                    Assign subject
                  </Button>
                </form>
              </div>
            </section>
          </MotionItem>

          <MotionItem>
            <section className="panel">
              <div className="panel__body">
                <div className="section-title">
                  <h2>Guardian link</h2>
                </div>
                <form
                  className="form-grid"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!guardianEmail.trim()) return;
                    void guardianLookup.refetch();
                  }}
                >
                  <Field hint="Search by exact account email." label="Guardian account email">
                    <TextInput
                      autoComplete="email"
                      onChange={(event) => {
                        setGuardianEmail(event.target.value);
                      }}
                      type="email"
                      value={guardianEmail}
                    />
                  </Field>
                  <Button pending={guardianLookup.isFetching} type="submit" variant="secondary">
                    Search account
                  </Button>
                </form>
                {guardianLookup.error ? (
                  <p className="status--error">{guardianLookup.error.message}</p>
                ) : null}
                {guardianRows.length > 0 ? (
                  <form
                    className="form-grid"
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (!selectedGuardianId) return;
                      linkGuardian.mutate({ studentId, userId: selectedGuardianId });
                    }}
                  >
                    <div className="divider" />
                    <Field label="Matched account">
                      <SelectInput
                        onChange={(event) => {
                          setSelectedGuardianId(event.target.value);
                        }}
                        value={selectedGuardianId}
                      >
                        <option value="">Choose account</option>
                        {guardianRows.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.fullName} - {account.email} - {roleLabel(account.role)}
                          </option>
                        ))}
                      </SelectInput>
                    </Field>
                    {linkGuardian.error ? (
                      <p className="status--error">{linkGuardian.error.message}</p>
                    ) : null}
                    {linkGuardian.isSuccess ? (
                      <p className="status--success">
                        {linkGuardian.data.created ? 'Guardian linked' : 'Guardian already linked'}
                      </p>
                    ) : null}
                    <Button pending={linkGuardian.isPending} type="submit">
                      <Link2 aria-hidden="true" size={16} />
                      Link guardian
                    </Button>
                  </form>
                ) : null}
              </div>
            </section>
          </MotionItem>

          <MotionItem>
            <section className="panel">
              <div className="panel__body form-grid">
                <div className="section-title">
                  <div>
                    <h2>Student archive</h2>
                    <p className="muted">
                      Archived students are hidden from active workflows but retained for records.
                    </p>
                  </div>
                </div>
                <div className="profile-field-list">
                  <div className="profile-field-row">
                    <span>Status</span>
                    <strong>{student.active ? 'Active' : 'Archived'}</strong>
                  </div>
                </div>
                <div className="lifecycle-actions">
                  {student.active ? (
                    <Button
                      onClick={() => {
                        setStatusAction('archive');
                      }}
                      pending={updateStudentStatus.isPending}
                      type="button"
                      variant="danger"
                    >
                      <Archive aria-hidden="true" size={16} />
                      Archive student
                    </Button>
                  ) : (
                    <Button
                      onClick={() => {
                        setStatusAction('restore');
                      }}
                      pending={updateStudentStatus.isPending}
                      type="button"
                      variant="secondary"
                    >
                      <RotateCcw aria-hidden="true" size={16} />
                      Restore student
                    </Button>
                  )}
                </div>
              </div>
            </section>
          </MotionItem>
        </div>
      </div>
      <ConfirmationDialog
        confirmLabel={statusAction === 'archive' ? 'Archive student' : 'Restore student'}
        errorMessage={updateStudentStatus.error?.message}
        onCancel={() => {
          if (!updateStudentStatus.isPending) setStatusAction(null);
        }}
        onConfirm={() => {
          if (!statusAction) return;
          updateStudentStatus.mutate({ id: student.id, active: statusAction === 'restore' });
        }}
        open={statusAction !== null}
        pending={updateStudentStatus.isPending}
        title={
          statusAction === 'archive'
            ? `Archive ${student.fullName}?`
            : `Restore ${student.fullName}?`
        }
        variant={statusAction === 'restore' ? 'primary' : 'danger'}
      >
        <p>
          {statusAction === 'archive'
            ? 'This will remove the student from active workflows while keeping their profile, history, and audit records.'
            : 'This will return the student to active workflows and student directories.'}
        </p>
      </ConfirmationDialog>
    </>
  );
}

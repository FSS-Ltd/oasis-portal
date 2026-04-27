'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Link2, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { api } from '@/lib/trpc';
import { MotionItem } from '@/components/admin/motion';
import { Button } from '@/components/ui/button';
import { Field, SelectInput, TextInput } from '@/components/ui/field';

const editSchema = z.object({
  fullName: z.string().trim().min(1, 'Enter the student name'),
  dob: z.string().min(1, 'Enter the date of birth'),
  yearGroup: z.string().trim().min(1, 'Enter the year group'),
  enrolmentDate: z.string().min(1, 'Enter the enrolment date'),
  address: z.string().trim().optional(),
  active: z.boolean(),
});

type EditValues = z.infer<typeof editSchema>;

interface StudentDetailProps {
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

export function StudentDetail({ studentId }: StudentDetailProps) {
  const utils = api.useUtils();
  const studentQuery = api.student.byId.useQuery({ id: studentId }, { retry: false });
  const subjectsQuery = api.admin.listActiveSubjects.useQuery(undefined, { retry: false });
  const updateStudent = api.student.update.useMutation({
    async onSuccess() {
      await Promise.all([
        utils.student.byId.invalidate({ id: studentId }),
        utils.student.list.invalidate(),
      ]);
    },
  });
  const assignSubject = api.student.assignSubject.useMutation({
    async onSuccess() {
      await utils.student.byId.invalidate({ id: studentId });
    },
  });
  const linkGuardian = api.admin.linkGuardian.useMutation();
  const [subjectId, setSubjectId] = useState('');
  const [paceNumber, setPaceNumber] = useState('1001');
  const [parentEmail, setParentEmail] = useState('');
  const [selectedParentId, setSelectedParentId] = useState('');
  const parentLookup = api.admin.searchParents.useQuery(
    { search: parentEmail.trim() || 'none', limit: 5 },
    { enabled: false, retry: false },
  );

  const {
    formState: { errors },
    handleSubmit,
    register,
    reset,
  } = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      fullName: '',
      dob: '',
      yearGroup: '',
      enrolmentDate: '',
      address: '',
      active: true,
    },
  });

  useEffect(() => {
    const student = studentQuery.data;
    if (!student) return;
    reset({
      fullName: student.fullName,
      dob: student.dob,
      yearGroup: student.yearGroup,
      enrolmentDate: new Date(student.enrolmentDate).toISOString().slice(0, 10),
      address: student.address ?? '',
      active: student.active,
    });
  }, [reset, studentQuery.data]);

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
  const parentRows = parentLookup.data ?? [];

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
          {student.active ? 'Active' : 'Inactive'}
        </span>
      </div>

      <div className="grid grid--two">
        <MotionItem>
          <form
            className="panel"
            onSubmit={handleSubmit((values) =>
              updateStudent.mutate({
                id: student.id,
                fullName: values.fullName,
                dob: new Date(values.dob),
                yearGroup: values.yearGroup,
                enrolmentDate: new Date(values.enrolmentDate),
                active: values.active,
                address: values.address || null,
              }),
            )}
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
                  <TextInput {...register('yearGroup')} />
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
              <label className="field">
                <span className="field__label">Active</span>
                <input className="switch-input" type="checkbox" {...register('active')} />
              </label>
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
        </MotionItem>

        <div className="grid">
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
                    <SelectInput onChange={(event) => setSubjectId(event.target.value)} value={subjectId}>
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
                      onChange={(event) => setPaceNumber(event.target.value)}
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
                    if (!parentEmail.trim()) return;
                    void parentLookup.refetch();
                  }}
                >
                  <Field hint="Search by exact parent email." label="Parent email">
                    <TextInput
                      autoComplete="email"
                      onChange={(event) => setParentEmail(event.target.value)}
                      type="email"
                      value={parentEmail}
                    />
                  </Field>
                  <Button pending={parentLookup.isFetching} type="submit" variant="secondary">
                    Search parent
                  </Button>
                </form>
                {parentLookup.error ? (
                  <p className="status--error">{parentLookup.error.message}</p>
                ) : null}
                {parentRows.length > 0 ? (
                  <form
                    className="form-grid"
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (!selectedParentId) return;
                      linkGuardian.mutate({ studentId, userId: selectedParentId });
                    }}
                  >
                    <div className="divider" />
                    <Field label="Matched parent">
                      <SelectInput
                        onChange={(event) => setSelectedParentId(event.target.value)}
                        value={selectedParentId}
                      >
                        <option value="">Choose parent</option>
                        {parentRows.map((parent) => (
                          <option key={parent.id} value={parent.id}>
                            {parent.fullName} - {parent.email}
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
        </div>
      </div>
    </>
  );
}

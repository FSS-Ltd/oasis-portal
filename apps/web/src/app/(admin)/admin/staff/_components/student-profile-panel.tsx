'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, GraduationCap } from 'lucide-react';
import { displaySchoolYearLabel } from '@oasis/domain';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import {
  formatDate,
  studentTabs,
  type StudentProfileTab,
  type StudentRow,
} from './people-profile-model';

export function StudentProfilePanel({ student }: { student: StudentRow }) {
  const [activeTab, setActiveTab] = useState<StudentProfileTab>('personal');

  useEffect(() => {
    setActiveTab('personal');
  }, [student]);

  return (
    <div className="person-profile person-profile--student">
      <section className="profile-hero">
        <Avatar className="profile-hero__avatar" name={student.fullName} />
        <div className="profile-hero__body">
          <div>
            <h2>{student.fullName}</h2>
            <p>{displaySchoolYearLabel(student.yearGroup)} · Enrolled {formatDate(student.enrolmentDate)}</p>
          </div>
          <div className="profile-hero__badges">
            <span>Student</span>
            <span>{student.active ? 'Active' : 'Inactive'}</span>
            <span>{student.subjects.length} subjects</span>
          </div>
        </div>
        <div className="profile-hero__actions">
          <Link className="button button--secondary" href={`/admin/students/${student.id}`}>
            <ExternalLink aria-hidden="true" size={16} />
            Open Student Record
          </Link>
        </div>
      </section>

      <div className="profile-tabs" role="tablist">
        {studentTabs.map((tab) => (
          <button
            aria-selected={activeTab === tab.id}
            className={activeTab === tab.id ? 'is-selected' : undefined}
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
            }}
            role="tab"
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'personal' ? (
        <section className="panel">
          <div className="panel__body profile-field-list">
            <div className="profile-field-row">
              <span>Full name</span>
              <strong>{student.fullName}</strong>
            </div>
            <div className="profile-field-row">
              <span>Date of birth</span>
              <strong>{student.dob}</strong>
            </div>
            <div className="profile-field-row">
              <span>Year group</span>
              <strong>{displaySchoolYearLabel(student.yearGroup)}</strong>
            </div>
            <div className="profile-field-row">
              <span>Enrolment date</span>
              <strong>{formatDate(student.enrolmentDate)}</strong>
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === 'academic' ? (
        <section className="panel">
          <div className="panel__body people-linked-list">
            {student.subjects.length === 0 ? (
              <EmptyState detail="Assign subjects from the student record." title="No subjects assigned" />
            ) : (
              student.subjects.map((subject) => (
                <div className="people-linked-row" key={subject.subjectId}>
                  <span className="people-linked-row__icon">
                    <GraduationCap aria-hidden="true" size={18} />
                  </span>
                  <span>
                    <strong>{subject.name}</strong>
                    <small>
                      {subject.code} · PACE {subject.currentPaceNumber}
                    </small>
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      ) : null}

      {activeTab === 'contact' ? (
        <section className="panel">
          <div className="panel__body profile-field-list">
            <div className="profile-field-row">
              <span>Address</span>
              <strong>{student.address ?? 'No address recorded'}</strong>
            </div>
            <div className="profile-field-row">
              <span>Student login</span>
              <strong>{student.userId ? 'Enabled' : 'Not issued'}</strong>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}

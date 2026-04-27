import Link from 'next/link';
import type { CSSProperties } from 'react';
import { MessageSquare, Plus, ShieldCheck, UserPlus } from 'lucide-react';
import { MotionPage } from '@/components/admin/motion';

export default function AdminIndexPage() {
  return (
    <MotionPage>
      <div className="page-header">
        <div>
          <p>Monday, 27 April 2026 · Phase 1</p>
          <h1>Good morning, Head of Centre</h1>
          <p>Run student onboarding, account invitations, and guardian linking from one staff portal.</p>
        </div>
      </div>

      <section className="dashboard-grid" aria-label="Admin dashboard summary">
        <div className="panel panel__body stat-card" style={{ '--accent': '#166534' } as CSSProperties}>
          <p className="stat-card__label">Onboarding scope</p>
          <p className="stat-card__value">3</p>
          <p className="stat-card__sub">students, staff, guardians</p>
        </div>
        <div className="panel panel__body stat-card" style={{ '--accent': '#5B90C5' } as CSSProperties}>
          <p className="stat-card__label">Available actions</p>
          <p className="stat-card__value">5</p>
          <p className="stat-card__sub">create, edit, assign, invite, link</p>
        </div>
        <div className="panel panel__body stat-card" style={{ '--accent': '#92400E' } as CSSProperties}>
          <p className="stat-card__label">Audit baseline</p>
          <p className="stat-card__value">On</p>
          <p className="stat-card__sub">mutations and PII decrypts</p>
        </div>
        <div className="panel panel__body stat-card" style={{ '--accent': '#7D1C2C' } as CSSProperties}>
          <p className="stat-card__label">Next PR</p>
          <p className="stat-card__value">1.8</p>
          <p className="stat-card__sub">audit viewer and verification</p>
        </div>
      </section>

      <div className="grid grid--two">
        <section className="panel">
          <div className="panel__body">
            <div className="section-title">
              <h2>Quick actions</h2>
            </div>
            <div className="grid">
              <Link className="button button--secondary button--md" href="/admin/students/new">
                <Plus aria-hidden="true" size={16} />
                Add student
              </Link>
              <Link className="button button--secondary button--md" href="/admin/students">
                <ShieldCheck aria-hidden="true" size={16} />
                Review students
              </Link>
              <Link className="button button--secondary button--md" href="/admin/staff">
                <UserPlus aria-hidden="true" size={16} />
                Invite staff or parent
              </Link>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel__body">
            <div className="section-title">
              <h2>Staff messages</h2>
              <span className="badge badge--red">2 unread</span>
            </div>
            <div className="student-row">
              <span className="avatar">OL</span>
              <div className="student-row__text">
                <strong>Phase 1 build status</strong>
                <span>PR-1.7 is merged. PR-1.7.5 is the design conversion pass.</span>
              </div>
              <MessageSquare aria-hidden="true" color="#5B90C5" size={18} />
            </div>
          </div>
        </section>
      </div>
    </MotionPage>
  );
}

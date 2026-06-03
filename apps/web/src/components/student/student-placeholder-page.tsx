import type { ReactNode } from 'react';

interface StudentPlaceholderPageProps {
  children: ReactNode;
  eyebrow: string;
  title: string;
}

export function StudentPlaceholderPage({ children, eyebrow, title }: StudentPlaceholderPageProps) {
  return (
    <section className="student-page student-placeholder-page">
      <div className="student-placeholder-page__header">
        <p>{eyebrow}</p>
        <h1>{title}</h1>
      </div>
      <div className="student-shell-card student-shell-card--wide">{children}</div>
    </section>
  );
}

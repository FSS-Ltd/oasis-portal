'use client';

import { BookOpenText, Sparkles } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { friendlyErrorMessage } from '@/lib/notifications';
import { api } from '@/lib/trpc';

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(value);
}

export function StudentFaithClient() {
  const faith = api.faithCorner.currentForStudent.useQuery(undefined, { retry: false });

  if (faith.isLoading) {
    return <div className="student-inline-state">Loading Faith Corner...</div>;
  }

  if (faith.error) {
    return <EmptyState detail={friendlyErrorMessage(faith.error)} title="Faith Corner unavailable" />;
  }

  if (!faith.data?.ready || !faith.data.memoryVerse) {
    return (
      <EmptyState
        detail="Managed Faith Corner content will appear here when it is published."
        title="Faith Corner is not ready"
      />
    );
  }

  return (
    <div className="student-page student-faith-page">
      <section className="student-wallet-hero student-faith-hero">
        <div>
          <p>Faith Corner</p>
          <h1>{faith.data.weeklyTheme}</h1>
          <span>Weekly Scripture memory and reflection for the Learning Centre.</span>
        </div>
        <div className="student-faith-hero__meta">
          <Sparkles aria-hidden="true" size={18} />
          <small>Published</small>
          <strong>{faith.data.publishedAt ? formatDate(faith.data.publishedAt) : 'Current'}</strong>
        </div>
      </section>

      <div className="student-faith-layout">
        <section className="student-faith-card" aria-labelledby="student-memory-verse-title">
          <div className="student-dashboard-panel__head">
            <div>
              <p>Memory verse</p>
              <h2 id="student-memory-verse-title">{faith.data.memoryVerse.reference}</h2>
            </div>
            <BookOpenText aria-hidden="true" size={20} />
          </div>
          <blockquote>{faith.data.memoryVerse.text}</blockquote>
          <small>{faith.data.memoryVerse.translation}</small>
        </section>

        <section className="student-faith-card" aria-labelledby="student-reflection-title">
          <div className="student-dashboard-panel__head">
            <div>
              <p>Reflection</p>
              <h2 id="student-reflection-title">Prompt</h2>
            </div>
          </div>
          <p>{faith.data.reflectionPrompt}</p>
        </section>

        {faith.data.verseOfDay ? (
          <section className="student-faith-card student-faith-card--wide" aria-labelledby="student-verse-day-title">
            <div className="student-dashboard-panel__head">
              <div>
                <p>Verse of the day</p>
                <h2 id="student-verse-day-title">{faith.data.verseOfDay.reference}</h2>
              </div>
            </div>
            <blockquote>{faith.data.verseOfDay.text}</blockquote>
            <small>{faith.data.verseOfDay.translation}</small>
          </section>
        ) : (
          <section className="student-faith-card student-faith-card--wide" aria-labelledby="student-verse-day-title">
            <div className="student-dashboard-panel__head">
              <div>
                <p>Verse of the day</p>
                <h2 id="student-verse-day-title">Not set</h2>
              </div>
            </div>
            <p>A verse of the day has not been published for this week.</p>
          </section>
        )}
      </div>
    </div>
  );
}

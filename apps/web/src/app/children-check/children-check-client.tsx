'use client';

import { useRouter } from 'next/navigation';
import { UserRoundCheck, UsersRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/trpc';

export function ChildrenCheckClient() {
  const router = useRouter();
  const answerPrompt = api.registration.answerChildRegistrationPrompt.useMutation({
    onSuccess(data) {
      router.replace(
        data.childRegistrationPromptStatus === 'HasChildren'
          ? '/registration'
          : '/post-sign-in/resolve',
      );
    },
  });
  const pendingYes = answerPrompt.isPending && answerPrompt.variables.hasChildren;
  const pendingNo = answerPrompt.isPending && !answerPrompt.variables.hasChildren;

  return (
    <section className="panel">
      <div className="panel__body form-grid">
        <div className="section-title">
          <div>
            <p className="muted">One-time account check</p>
            <h2>Do you have children at Oasis?</h2>
          </div>
        </div>
        <p className="muted">
          This lets Oasis prepare child records and show linked children from your account when
          needed.
        </p>
        {answerPrompt.error ? <p className="status--error">{answerPrompt.error.message}</p> : null}
        <div className="profile-actions">
          <Button
            disabled={answerPrompt.isPending}
            onClick={() => {
              answerPrompt.mutate({ hasChildren: true });
            }}
            pending={pendingYes}
            type="button"
          >
            <UsersRound aria-hidden="true" size={16} />
            Yes, open registration
          </Button>
          <Button
            disabled={answerPrompt.isPending}
            onClick={() => {
              answerPrompt.mutate({ hasChildren: false });
            }}
            pending={pendingNo}
            type="button"
            variant="secondary"
          >
            <UserRoundCheck aria-hidden="true" size={16} />
            No, continue
          </Button>
        </div>
      </div>
    </section>
  );
}

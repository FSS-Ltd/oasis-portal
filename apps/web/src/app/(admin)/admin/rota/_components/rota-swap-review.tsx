import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDateTime } from './rota-utils';

type PendingSwap = {
  fromShift: { date: string; startsAt: Date };
  id: string;
  requester: { fullName: string };
  targetUser: { fullName: string };
  toShift: { date: string; startsAt: Date };
};

type RotaSwapReviewProps = {
  errorMessage?: string | undefined;
  isApproving: boolean;
  isLoading: boolean;
  isRejecting: boolean;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  swaps: readonly PendingSwap[];
};

export function RotaSwapReview({
  errorMessage,
  isApproving,
  isLoading,
  isRejecting,
  onApprove,
  onReject,
  swaps,
}: RotaSwapReviewProps) {
  return (
    <section aria-labelledby="rota-swap-review-title" className="panel">
      <div className="panel__body">
        <div className="section-title">
          <div>
            <p className="staff-rota-eyebrow">Approval queue</p>
            <h2 id="rota-swap-review-title">Shift swaps</h2>
          </div>
          <span className="badge">{swaps.length} pending</span>
        </div>
        <p className="muted">Review the two shifts before confirming a change to the rota.</p>
        {isLoading ? <div className="empty-state">Loading swaps...</div> : null}
        {errorMessage ? <p className="status--error">{errorMessage}</p> : null}
        {!isLoading && swaps.length === 0 ? (
          <div className="empty-state">No pending shift swaps</div>
        ) : null}
        <div className="swap-list">
          {swaps.map((swap) => (
            <article className="swap-card" key={swap.id}>
              <strong>
                {swap.requester.fullName} with {swap.targetUser.fullName}
              </strong>
              <span>
                {swap.fromShift.date} {formatDateTime(swap.fromShift.startsAt)} for{' '}
                {swap.toShift.date} {formatDateTime(swap.toShift.startsAt)}
              </span>
              <div className="row-actions">
                <Button
                  onClick={() => {
                    onReject(swap.id);
                  }}
                  pending={isRejecting}
                  type="button"
                  variant="secondary"
                >
                  <X aria-hidden="true" size={16} />
                  Reject
                </Button>
                <Button
                  onClick={() => {
                    onApprove(swap.id);
                  }}
                  pending={isApproving}
                  type="button"
                >
                  <Check aria-hidden="true" size={16} />
                  Approve
                </Button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

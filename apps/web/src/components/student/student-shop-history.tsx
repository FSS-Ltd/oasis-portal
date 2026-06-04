import { History } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ShopTile, formatMerits } from '@/components/shop/shop-shared';
import type { StudentShopHistory } from './student-shop-types';

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(value);
}

export function StudentShopHistoryPanel({ history }: { history: StudentShopHistory | undefined }) {
  const purchases = history?.purchases ?? [];
  const reservations = history?.reservations ?? [];

  return (
    <aside className="panel panel__body student-shop-history" aria-labelledby="student-shop-history">
      <div className="section-title">
        <div>
          <h2 id="student-shop-history">History</h2>
          <p className="muted">Purchases and pickup holds.</p>
        </div>
        <History aria-hidden="true" size={18} />
      </div>

      <div className="student-shop-history__section">
        <h3>Purchases</h3>
        {purchases.length === 0 ? (
          <p className="student-shop-history__empty">No completed purchases yet.</p>
        ) : (
          purchases.slice(0, 4).map((purchase) => (
            <article className="student-shop-history-row" key={purchase.id}>
              <ShopTile
                item={{
                  name: purchase.itemName,
                  photoUrl: purchase.itemPhotoUrl,
                  category: purchase.category,
                  categoryLabel: purchase.categoryLabel,
                  categoryTint: purchase.categoryTint,
                  categoryInk: purchase.categoryInk,
                }}
                size="sm"
              />
              <div>
                <strong>{purchase.itemName}</strong>
                <span>
                  {formatDate(purchase.createdAt)} · {formatMerits(purchase.totalPriceMerits)} merits
                </span>
              </div>
            </article>
          ))
        )}
      </div>

      <div className="student-shop-history__section">
        <h3>Pickup holds</h3>
        {reservations.length === 0 ? (
          <p className="student-shop-history__empty">No pickup holds yet.</p>
        ) : (
          reservations.slice(0, 4).map((reservation) => (
            <article className="student-shop-hold-row" key={reservation.id}>
              <Badge tone={reservation.status === 'Ready' ? 'amber' : 'grey'}>
                {reservation.status}
              </Badge>
              <div>
                <strong>{formatMerits(reservation.totalPriceMerits)} merits</strong>
                <span>
                  {formatDate(reservation.createdAt)} ·{' '}
                  {reservation.lines
                    .map((line) => `${String(line.unitsReserved)} x ${line.itemName}`)
                    .join(', ')}
                </span>
              </div>
            </article>
          ))
        )}
      </div>
    </aside>
  );
}

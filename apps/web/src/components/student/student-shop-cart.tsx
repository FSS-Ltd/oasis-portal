import { CheckCircle2, ShoppingCart } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  QuantityStepper,
  RemoveLineButton,
  ShopTile,
  formatMerits,
} from '@/components/shop/shop-shared';
import { friendlyErrorMessage } from '@/lib/notifications';
import type { CartLineWithItem } from './student-shop-types';

export function StudentShopCart({
  balanceAfter,
  canReserve,
  cartCount,
  cartLines,
  cartTotal,
  error,
  localError,
  onReserve,
  onSetLineQuantity,
  pending,
  spendBalance,
}: {
  balanceAfter: number;
  canReserve: boolean;
  cartCount: number;
  cartLines: readonly CartLineWithItem[];
  cartTotal: number;
  error: unknown;
  localError: string | null;
  onReserve: () => void;
  onSetLineQuantity: (itemId: string, quantity: number) => void;
  pending: boolean;
  spendBalance: number;
}) {
  return (
    <aside className="panel panel__body parent-shop-cart" aria-labelledby="student-shop-cart-title">
      <div className="section-title">
        <div>
          <h2 id="student-shop-cart-title">My Cart</h2>
          <p className="muted">Pickup at the shopkeeper counter.</p>
        </div>
        <Badge tone="blue">
          <ShoppingCart aria-hidden="true" size={13} />
          {formatMerits(cartCount)}
        </Badge>
      </div>
      {cartLines.length === 0 ? (
        <div className="parent-shop-cart__empty">
          <p>Your cart is empty.</p>
          <span>Add a reward to reserve it for pickup.</span>
        </div>
      ) : (
        <div className="parent-shop-cart__lines">
          {cartLines.map((line) => (
            <article className="parent-shop-cart-line" key={line.item.id}>
              <ShopTile item={line.item} size="sm" />
              <div>
                <strong>{line.item.name}</strong>
                <span>{formatMerits(line.item.priceIncVat)} merits each</span>
              </div>
              <QuantityStepper
                disabled={pending}
                max={line.item.stockCount}
                onChange={(next) => {
                  onSetLineQuantity(line.item.id, next);
                }}
                value={line.quantity}
              />
              <RemoveLineButton
                disabled={pending}
                label={`Remove ${line.item.name}`}
                onClick={() => {
                  onSetLineQuantity(line.item.id, 0);
                }}
              />
            </article>
          ))}
        </div>
      )}

      <div className="parent-shop-summary" aria-live="polite">
        <span>
          <small>Spend balance</small>
          <strong>{formatMerits(spendBalance)}</strong>
        </span>
        <span>
          <small>Cart total</small>
          <strong>{formatMerits(cartTotal)}</strong>
        </span>
        <span>
          <small>After reserve</small>
          <strong className={balanceAfter < 0 ? 'is-danger' : undefined}>
            {formatMerits(balanceAfter)}
          </strong>
        </span>
      </div>
      <Button
        className="parent-shop-cart__reserve"
        disabled={!canReserve}
        onClick={onReserve}
        pending={pending}
        type="button"
      >
        <CheckCircle2 aria-hidden="true" size={16} />
        {balanceAfter < 0 ? `Need ${formatMerits(Math.abs(balanceAfter))} more` : 'Reserve'}
      </Button>
      <p className="parent-shop-cart__hint">
        Merits are held immediately, then moved to Given when the shopkeeper marks pickup collected.
      </p>
      {localError ? <p className="status--error">{localError}</p> : null}
      {error ? <p className="status--error">{friendlyErrorMessage(error)}</p> : null}
    </aside>
  );
}

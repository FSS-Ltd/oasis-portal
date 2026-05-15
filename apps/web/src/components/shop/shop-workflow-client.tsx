'use client';

import { type FormEvent, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Package,
  Pencil,
  Plus,
  Power,
  PowerOff,
  ReceiptText,
  Save,
  ShoppingBag,
  X,
} from 'lucide-react';
import { api, type RouterInputs, type RouterOutputs } from '@/lib/trpc';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, SelectInput, TextInput } from '@/components/ui/field';

type ShopItem = RouterOutputs['shop']['listItems'][number];
type ShopPurchaser = RouterOutputs['shop']['listPurchasers'][number];
type CreateItemInput = RouterInputs['shop']['createItem'];

interface ShopWorkflowClientProps {
  canManageItems: boolean;
  canRecordPurchases: boolean;
  portal: 'admin' | 'supervisor';
}

interface ItemFormState {
  name: string;
  photoUrl: string;
  priceExVat: string;
  vatRatePct: string;
  stockCount: string;
}

interface PurchaseFormState {
  studentId: string;
  itemId: string;
  unitsBought: string;
}

const emptyItemForm = (): ItemFormState => ({
  name: '',
  photoUrl: '',
  priceExVat: '',
  vatRatePct: '20',
  stockCount: '',
});

const emptyPurchaseForm = (): PurchaseFormState => ({
  studentId: '',
  itemId: '',
  unitsBought: '1',
});

function formatMerits(value: number): string {
  return new Intl.NumberFormat('en-GB').format(value);
}

function parseInteger(value: string, label: string, min: number, max?: number): number | string {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return `${label} must be a whole number.`;
  if (parsed < min) return `${label} must be at least ${String(min)}.`;
  if (max !== undefined && parsed > max) return `${label} must be ${String(max)} or less.`;
  return parsed;
}

function buildItemPayload(form: ItemFormState): CreateItemInput | string {
  const name = form.name.trim();
  if (!name) return 'Item name is required.';

  const priceExVat = parseInteger(form.priceExVat, 'Price ex-VAT', 0);
  if (typeof priceExVat === 'string') return priceExVat;

  const vatRatePct = parseInteger(form.vatRatePct, 'VAT rate', 0, 100);
  if (typeof vatRatePct === 'string') return vatRatePct;

  const stockCount = parseInteger(form.stockCount, 'Stock count', 0);
  if (typeof stockCount === 'string') return stockCount;

  const photoUrl = form.photoUrl.trim();
  const payload: CreateItemInput = { name, priceExVat, vatRatePct, stockCount };
  if (photoUrl) payload.photoUrl = photoUrl;
  return payload;
}

function formFromItem(item: ShopItem): ItemFormState {
  return {
    name: item.name,
    photoUrl: item.photoUrl ?? '',
    priceExVat: String(item.priceExVat),
    vatRatePct: String(item.vatRatePct),
    stockCount: String(item.stockCount),
  };
}

function purchaseValidationMessage({
  item,
  student,
  units,
}: {
  item: ShopItem | null;
  student: ShopPurchaser | null;
  units: number | null;
}): string | null {
  if (!student) return 'Select a student.';
  if (!item) return 'Select an active item.';
  if (units === null) return 'Quantity must be a positive whole number.';
  if (units > item.stockCount) return 'Insufficient stock for this purchase.';
  if (item.priceIncVat * units > student.spendBalance) {
    return 'Insufficient Spend balance for this purchase.';
  }
  return null;
}

function ShopItemCard({
  canManage,
  item,
  onEdit,
  onToggleActive,
  pending,
}: {
  canManage: boolean;
  item: ShopItem;
  onEdit: (item: ShopItem) => void;
  onToggleActive: (item: ShopItem) => void;
  pending: boolean;
}) {
  return (
    <article className={item.active ? 'shop-item-card' : 'shop-item-card is-inactive'}>
      <div
        aria-label={`Photo for ${item.name}`}
        className="shop-item-card__photo"
        role="img"
        style={item.photoUrl ? { backgroundImage: `url(${item.photoUrl})` } : undefined}
      >
        {item.photoUrl ? null : <Package aria-hidden="true" size={22} />}
      </div>
      <div className="shop-item-card__body">
        <span className="badge-list">
          <Badge tone={item.active ? 'green' : 'grey'}>{item.active ? 'Active' : 'Inactive'}</Badge>
          <Badge tone={item.stockCount > 0 ? 'blue' : 'amber'}>
            {formatMerits(item.stockCount)} in stock
          </Badge>
        </span>
        <h2>{item.name}</h2>
        <p>
          <strong>{formatMerits(item.priceIncVat)}</strong> merits inc VAT
          <span>
            {formatMerits(item.priceExVat)} ex-VAT · {String(item.vatRatePct)}% VAT
          </span>
        </p>
      </div>
      {canManage ? (
        <div className="shop-item-card__actions">
          <Button
            onClick={() => {
              onEdit(item);
            }}
            size="sm"
            type="button"
            variant="secondary"
          >
            <Pencil aria-hidden="true" size={15} />
            Edit
          </Button>
          <Button
            onClick={() => {
              onToggleActive(item);
            }}
            pending={pending}
            size="sm"
            type="button"
            variant={item.active ? 'danger' : 'secondary'}
          >
            {item.active ? (
              <PowerOff aria-hidden="true" size={15} />
            ) : (
              <Power aria-hidden="true" size={15} />
            )}
            {item.active ? 'Deactivate' : 'Activate'}
          </Button>
        </div>
      ) : null}
    </article>
  );
}

export function ShopWorkflowClient({
  canManageItems,
  canRecordPurchases,
  portal,
}: ShopWorkflowClientProps) {
  const utils = api.useUtils();
  const [itemForm, setItemForm] = useState<ItemFormState>(emptyItemForm);
  const [purchaseForm, setPurchaseForm] = useState<PurchaseFormState>(emptyPurchaseForm);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [pendingActiveItemId, setPendingActiveItemId] = useState<string | null>(null);
  const [itemFormError, setItemFormError] = useState<string | null>(null);
  const [itemFormStatus, setItemFormStatus] = useState<string | null>(null);
  const [purchaseFormError, setPurchaseFormError] = useState<string | null>(null);
  const [purchaseFormStatus, setPurchaseFormStatus] = useState<string | null>(null);

  const itemsQuery = api.shop.listItems.useQuery(
    { includeInactive: canManageItems },
    { retry: false },
  );
  const purchasersQuery = api.shop.listPurchasers.useQuery(undefined, {
    enabled: canRecordPurchases,
    retry: false,
  });
  const createItem = api.shop.createItem.useMutation({
    onSuccess: async () => {
      setItemForm(emptyItemForm());
      setEditingItemId(null);
      setItemFormStatus('Item created.');
      await utils.shop.listItems.invalidate();
    },
  });
  const updateItem = api.shop.updateItem.useMutation({
    onSettled: () => {
      setPendingActiveItemId(null);
    },
    onSuccess: async (item) => {
      setItemForm(emptyItemForm());
      setEditingItemId(null);
      setItemFormStatus(item.active ? 'Item updated.' : 'Item deactivated.');
      await utils.shop.listItems.invalidate();
    },
  });
  const purchase = api.shop.purchase.useMutation({
    onSuccess: async (result) => {
      setPurchaseForm((current) => ({ ...current, unitsBought: '1' }));
      setPurchaseFormStatus(
        `Purchase recorded for ${formatMerits(result.totalPriceMerits)} merits.`,
      );
      await Promise.all([utils.shop.listItems.invalidate(), utils.shop.listPurchasers.invalidate()]);
    },
  });

  const items = useMemo(() => itemsQuery.data ?? [], [itemsQuery.data]);
  const activeItems = useMemo(() => items.filter((item) => item.active), [items]);
  const purchasers = useMemo(() => purchasersQuery.data ?? [], [purchasersQuery.data]);
  const selectedItem = activeItems.find((item) => item.id === purchaseForm.itemId) ?? null;
  const selectedStudent =
    purchasers.find((student) => student.id === purchaseForm.studentId) ?? null;
  const purchaseUnits = parseInteger(purchaseForm.unitsBought, 'Quantity', 1);
  const validPurchaseUnits = typeof purchaseUnits === 'number' ? purchaseUnits : null;
  const purchaseTotal =
    selectedItem && validPurchaseUnits ? selectedItem.priceIncVat * validPurchaseUnits : 0;
  const purchaseWarning = purchaseValidationMessage({
    item: selectedItem,
    student: selectedStudent,
    units: validPurchaseUnits,
  });
  const purchaseQueriesLoading = purchasersQuery.isLoading || itemsQuery.isLoading;
  const itemMutationPending =
    createItem.isPending || (updateItem.isPending && pendingActiveItemId === null);
  const itemMutationError = createItem.error ?? updateItem.error;

  useEffect(() => {
    if (!canRecordPurchases || purchasers.length === 0 || purchaseForm.studentId) return;
    setPurchaseForm((current) => ({ ...current, studentId: purchasers[0]?.id ?? '' }));
  }, [canRecordPurchases, purchaseForm.studentId, purchasers]);

  useEffect(() => {
    if (!canRecordPurchases || activeItems.length === 0) return;
    if (purchaseForm.itemId && activeItems.some((item) => item.id === purchaseForm.itemId)) return;
    setPurchaseForm((current) => ({ ...current, itemId: activeItems[0]?.id ?? '' }));
  }, [activeItems, canRecordPurchases, purchaseForm.itemId]);

  function beginEdit(item: ShopItem): void {
    setEditingItemId(item.id);
    setItemForm(formFromItem(item));
    setItemFormError(null);
    setItemFormStatus(null);
  }

  function cancelEdit(): void {
    setEditingItemId(null);
    setItemForm(emptyItemForm());
    setItemFormError(null);
  }

  async function submitItem(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setItemFormStatus(null);
    setItemFormError(null);

    const payload = buildItemPayload(itemForm);
    if (typeof payload === 'string') {
      setItemFormError(payload);
      return;
    }

    try {
      if (editingItemId) {
        await updateItem.mutateAsync({ id: editingItemId, ...payload });
        return;
      }
      await createItem.mutateAsync(payload);
    } catch {
      // React Query exposes the mutation error below the form.
    }
  }

  function toggleItemActive(item: ShopItem): void {
    setItemFormStatus(null);
    setItemFormError(null);
    setPendingActiveItemId(item.id);
    updateItem.mutate({ id: item.id, active: !item.active });
  }

  async function submitPurchase(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setPurchaseFormStatus(null);
    setPurchaseFormError(null);

    if (purchaseWarning) {
      setPurchaseFormError(purchaseWarning);
      return;
    }
    if (!selectedStudent || !selectedItem || validPurchaseUnits === null) return;

    try {
      await purchase.mutateAsync({
        studentId: selectedStudent.id,
        itemId: selectedItem.id,
        unitsBought: validPurchaseUnits,
      });
    } catch {
      // React Query exposes the mutation error below the form.
    }
  }

  return (
    <div className="shop-page">
      <div className="dashboard-hero">
        <p>Merit economy</p>
        <h1>Merit Shop</h1>
        <span>
          {portal === 'admin'
            ? 'Manage stock and record Spend purchases.'
            : 'Record purchases from active student Spend balances.'}
        </span>
      </div>

      <div className="shop-layout">
        {canManageItems ? (
          <section className="panel panel__body shop-editor-panel" aria-labelledby="shop-editor">
            <div className="section-title">
              <div>
                <h2 id="shop-editor">{editingItemId ? 'Edit Item' : 'Add Item'}</h2>
                <p className="muted">Prices are stored as merits with VAT included.</p>
              </div>
              {editingItemId ? (
                <Button onClick={cancelEdit} size="sm" type="button" variant="ghost">
                  <X aria-hidden="true" size={15} />
                  Cancel
                </Button>
              ) : null}
            </div>
            <form
              className="shop-form"
              onSubmit={(event) => {
                void submitItem(event);
              }}
            >
              <Field label="Item name" required>
                <TextInput
                  disabled={itemMutationPending}
                  maxLength={120}
                  onChange={(event) => {
                    setItemForm((current) => ({ ...current, name: event.target.value }));
                  }}
                  required
                  value={itemForm.name}
                />
              </Field>
              <Field label="Photo URL" hint="Optional">
                <TextInput
                  disabled={itemMutationPending}
                  onChange={(event) => {
                    setItemForm((current) => ({ ...current, photoUrl: event.target.value }));
                  }}
                  type="url"
                  value={itemForm.photoUrl}
                />
              </Field>
              <div className="shop-form__numbers">
                <Field label="Price ex-VAT" required>
                  <TextInput
                    disabled={itemMutationPending}
                    min={0}
                    onChange={(event) => {
                      setItemForm((current) => ({ ...current, priceExVat: event.target.value }));
                    }}
                    required
                    type="number"
                    value={itemForm.priceExVat}
                  />
                </Field>
                <Field label="VAT rate" required>
                  <TextInput
                    disabled={itemMutationPending}
                    max={100}
                    min={0}
                    onChange={(event) => {
                      setItemForm((current) => ({ ...current, vatRatePct: event.target.value }));
                    }}
                    required
                    type="number"
                    value={itemForm.vatRatePct}
                  />
                </Field>
                <Field label="Stock" required>
                  <TextInput
                    disabled={itemMutationPending}
                    min={0}
                    onChange={(event) => {
                      setItemForm((current) => ({ ...current, stockCount: event.target.value }));
                    }}
                    required
                    type="number"
                    value={itemForm.stockCount}
                  />
                </Field>
              </div>
              <Button pending={itemMutationPending} type="submit">
                {editingItemId ? (
                  <Save aria-hidden="true" size={16} />
                ) : (
                  <Plus aria-hidden="true" size={16} />
                )}
                {editingItemId ? 'Save Item' : 'Add Item'}
              </Button>
              {itemFormStatus ? <p className="status--success">{itemFormStatus}</p> : null}
              {itemFormError ? <p className="status--error">{itemFormError}</p> : null}
              {itemMutationError ? (
                <p className="status--error">{itemMutationError.message}</p>
              ) : null}
            </form>
          </section>
        ) : null}

        {canRecordPurchases ? (
          <section className="panel panel__body shop-purchase-panel" aria-labelledby="shop-purchase">
            <div className="section-title">
              <div>
                <h2 id="shop-purchase">Record Purchase</h2>
                <p className="muted">Successful purchases debit Spend and decrement stock.</p>
              </div>
              <span className="badge badge--blue">
                <ReceiptText aria-hidden="true" size={14} />
                Receipt
              </span>
            </div>
            <form
              className="shop-form"
              onSubmit={(event) => {
                void submitPurchase(event);
              }}
            >
              <Field label="Student" required>
                <SelectInput
                  disabled={purchase.isPending || purchasersQuery.isLoading}
                  onChange={(event) => {
                    setPurchaseForm((current) => ({ ...current, studentId: event.target.value }));
                  }}
                  required
                  value={purchaseForm.studentId}
                >
                  <option value="">Select student</option>
                  {purchasers.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.fullName} · {student.yearGroup} ·{' '}
                      {formatMerits(student.spendBalance)} Spend
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="Item" required>
                <SelectInput
                  disabled={purchase.isPending || itemsQuery.isLoading}
                  onChange={(event) => {
                    setPurchaseForm((current) => ({ ...current, itemId: event.target.value }));
                  }}
                  required
                  value={purchaseForm.itemId}
                >
                  <option value="">Select item</option>
                  {activeItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} · {formatMerits(item.priceIncVat)} merits ·{' '}
                      {formatMerits(item.stockCount)} in stock
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="Quantity" required>
                <TextInput
                  disabled={purchase.isPending}
                  min={1}
                  onChange={(event) => {
                    setPurchaseForm((current) => ({ ...current, unitsBought: event.target.value }));
                  }}
                  required
                  type="number"
                  value={purchaseForm.unitsBought}
                />
              </Field>
              <div className="shop-purchase-summary" aria-live="polite">
                <span>
                  <small>Spend balance</small>
                  <strong>{formatMerits(selectedStudent?.spendBalance ?? 0)}</strong>
                </span>
                <span>
                  <small>Total</small>
                  <strong>{formatMerits(purchaseTotal)}</strong>
                </span>
                <span>
                  <small>Remaining stock</small>
                  <strong>
                    {selectedItem && validPurchaseUnits
                      ? formatMerits(Math.max(0, selectedItem.stockCount - validPurchaseUnits))
                      : '0'}
                  </strong>
                </span>
              </div>
              {!purchaseQueriesLoading && purchaseWarning ? (
                <p className="status--error">{purchaseWarning}</p>
              ) : null}
              <Button
                disabled={purchaseQueriesLoading || Boolean(purchaseWarning)}
                pending={purchase.isPending}
                type="submit"
              >
                <CheckCircle2 aria-hidden="true" size={16} />
                Confirm Purchase
              </Button>
              {purchaseFormStatus ? <p className="status--success">{purchaseFormStatus}</p> : null}
              {purchaseFormError ? <p className="status--error">{purchaseFormError}</p> : null}
              {purchase.error ? <p className="status--error">{purchase.error.message}</p> : null}
              {purchasersQuery.error ? (
                <p className="status--error">{purchasersQuery.error.message}</p>
              ) : null}
            </form>
          </section>
        ) : null}
      </div>

      <section className="panel panel__body shop-items-panel" aria-labelledby="shop-items">
        <div className="section-title">
          <div>
            <h2 id="shop-items">Shop Items</h2>
            <p className="muted">
              {canManageItems ? 'Active and inactive inventory.' : 'Active inventory.'}
            </p>
          </div>
          <span className="badge badge--blue">
            <ShoppingBag aria-hidden="true" size={14} />
            {formatMerits(items.length)} items
          </span>
        </div>
        {itemsQuery.isLoading ? <div className="empty-state">Loading shop items...</div> : null}
        {itemsQuery.error ? <p className="status--error">{itemsQuery.error.message}</p> : null}
        {!itemsQuery.isLoading && items.length === 0 ? (
          <div className="empty-state">No shop items found.</div>
        ) : null}
        <div className="shop-item-grid" aria-label="Shop items">
          {items.map((item) => (
            <ShopItemCard
              canManage={canManageItems}
              item={item}
              key={item.id}
              onEdit={beginEdit}
              onToggleActive={toggleItemActive}
              pending={pendingActiveItemId === item.id}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

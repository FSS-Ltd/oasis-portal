'use client';

import {
  type CSSProperties,
  type FocusEvent,
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  CheckCircle2,
  ClipboardCheck,
  Minus,
  Plus,
  ReceiptText,
  Search,
  ShoppingBag,
  X,
} from 'lucide-react';
import { displaySchoolYearLabel } from '@oasis/domain';
import { friendlyErrorMessage, showErrorToast, showSuccessToast } from '@/lib/notifications';
import { api, type RouterInputs, type RouterOutputs } from '@/lib/trpc';
import { downloadCsv } from '@/components/attendance/download-csv';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, SelectInput, TextInput } from '@/components/ui/field';
import { ShopPhotoUploadButton, type ShopPhotoUploadPayload } from './shop-photo-upload';
import {
  CategoryPill,
  SHOP_CATEGORY_OPTIONS,
  SHOP_CATEGORY_VISUALS,
  type ShopCategoryOption,
  type ShopVisualItem,
  ShopTile,
  formatMerits,
  stockBadgeTone,
} from './shop-shared';

type ShopItem = RouterOutputs['shop']['listItems'][number];
type ShopPurchaser = RouterOutputs['shop']['listPurchasers'][number];
type ShopReservation = RouterOutputs['shop']['listReservations'][number];
type CreateItemInput = RouterInputs['shop']['createItem'];
type UpdateItemInput = RouterInputs['shop']['updateItem'];
type StaffShopTab = 'catalogue' | 'pickups' | 'activity';
type CatalogueStatusFilter = 'All' | 'Active' | 'Paused' | 'LowStock' | 'OutOfStock';
type CategoryFilter = ShopCategoryOption | 'All';

const SHOP_WORKFLOW_TABS = [
  { id: 'catalogue', label: 'Catalogue' },
  { id: 'pickups', label: 'Pickups' },
  { id: 'activity', label: 'Activity' },
] as const satisfies readonly { id: StaffShopTab; label: string }[];

interface ShopWorkflowClientProps {
  canManageItems: boolean;
  canRecordPurchases: boolean;
  portal: 'admin' | 'supervisor';
}

interface ItemFormState {
  name: string;
  photoUrl: string;
  category: ShopCategoryOption;
  blurb: string;
  description: string;
  photoUpload: ShopPhotoUploadPayload | null;
  priceExVat: string;
  vatRatePct: string;
  stockCount: string;
  lowStockThreshold: string;
  active: boolean;
}

interface PurchaseFormState {
  studentId: string;
  itemId: string;
  unitsBought: string;
}

const emptyItemForm = (): ItemFormState => ({
  name: '',
  photoUrl: '',
  photoUpload: null,
  category: 'Treats',
  blurb: '',
  description: '',
  priceExVat: '',
  vatRatePct: '0',
  stockCount: '',
  lowStockThreshold: '5',
  active: true,
});

const emptyPurchaseForm = (): PurchaseFormState => ({
  studentId: '',
  itemId: '',
  unitsBought: '1',
});

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

  const priceExVat = parseInteger(form.priceExVat, 'Price', 0);
  if (typeof priceExVat === 'string') return priceExVat;

  const vatRatePct = parseInteger(form.vatRatePct, 'VAT rate', 0, 100);
  if (typeof vatRatePct === 'string') return vatRatePct;

  const stockCount = parseInteger(form.stockCount, 'Stock count', 0);
  if (typeof stockCount === 'string') return stockCount;

  const lowStockThreshold = parseInteger(form.lowStockThreshold, 'Low-stock threshold', 0);
  if (typeof lowStockThreshold === 'string') return lowStockThreshold;

  const photoUrl = form.photoUrl.trim();
  const blurb = form.blurb.trim();
  const description = form.description.trim();
  const payload: CreateItemInput = {
    name,
    category: form.category,
    priceExVat,
    vatRatePct,
    stockCount,
    lowStockThreshold,
  };
  if (photoUrl && !form.photoUpload) payload.photoUrl = photoUrl;
  if (blurb) payload.blurb = blurb;
  if (description) payload.description = description;
  return payload;
}

function formFromItem(item: ShopItem): ItemFormState {
  return {
    name: item.name,
    photoUrl: item.photoUrl ?? '',
    photoUpload: null,
    category: item.category,
    blurb: item.blurb ?? '',
    description: item.description ?? '',
    priceExVat: String(item.priceExVat),
    vatRatePct: String(item.vatRatePct),
    stockCount: String(item.stockCount),
    lowStockThreshold: String(item.lowStockThreshold),
    active: item.active,
  };
}

function previewItemFromForm(form: ItemFormState): ShopVisualItem {
  const details = SHOP_CATEGORY_VISUALS[form.category];
  return {
    name: form.name.trim() || 'New Item',
    photoUrl: form.photoUrl.trim() || null,
    category: form.category,
    categoryLabel: details.label,
    categoryTint: details.tint,
    categoryInk: details.ink,
  };
}

function shopStatAccentStyle(accent: string): CSSProperties {
  return { '--shop-stat-accent': accent } as CSSProperties;
}

function csvEscape(value: string | number | boolean | null): string {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function buildCatalogueCsv(items: readonly ShopItem[]): string {
  const rows = [
    ['Item', 'Category', 'Price merits', 'Stock', 'Low stock threshold', 'Sold', 'Status'],
    ...items.map((item) => [
      item.name,
      item.categoryLabel,
      item.priceIncVat,
      item.stockCount,
      item.lowStockThreshold,
      item.soldCount,
      statusForItem(item).label,
    ]),
  ];

  return rows.map((row) => row.map(csvEscape).join(',')).join('\r\n');
}

function statusForItem(item: ShopItem): {
  label: string;
  tone: 'amber' | 'green' | 'grey' | 'red';
} {
  if (!item.active) return { label: 'Paused', tone: 'grey' };
  if (item.stockStatus === 'OutOfStock') return { label: 'Out', tone: 'red' };
  if (item.stockStatus === 'LowStock') return { label: 'Low', tone: 'amber' };
  return { label: 'Active', tone: 'green' };
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

function ShopStatCards({
  items,
  readyReservationCount,
}: {
  items: readonly ShopItem[];
  readyReservationCount: number;
}) {
  const activeItems = items.filter((item) => item.active).length;
  const lowStock = items.filter((item) => item.stockStatus === 'LowStock').length;
  const outOfStock = items.filter((item) => item.stockStatus === 'OutOfStock').length;
  const soldCount = items.reduce((total, item) => total + item.soldCount, 0);
  const revenue = items.reduce((total, item) => total + item.soldCount * item.priceIncVat, 0);
  const cards = [
    {
      accent: 'var(--oasis-blue)',
      label: 'Catalogue',
      value: formatMerits(items.length),
      sub: `${formatMerits(activeItems)} active · ${formatMerits(items.length - activeItems)} paused`,
    },
    {
      accent: readyReservationCount > 0 ? 'var(--oasis-warning)' : 'var(--oasis-success)',
      label: 'Pending Pickups',
      value: formatMerits(readyReservationCount),
      sub: 'awaiting collection',
    },
    {
      accent: lowStock > 0 ? 'var(--oasis-warning)' : 'var(--oasis-success)',
      label: 'Low Stock',
      value: formatMerits(lowStock),
      sub: 'at or below threshold',
    },
    {
      accent: outOfStock > 0 ? 'var(--oasis-danger)' : 'var(--oasis-success)',
      label: 'Out of Stock',
      value: formatMerits(outOfStock),
      sub: 'needs restock',
    },
    {
      accent: 'var(--oasis-crimson)',
      label: 'Term Revenue',
      value: `${formatMerits(revenue)}m`,
      sub: `${formatMerits(soldCount)} items sold`,
    },
  ] as const;

  return (
    <section className="shop-stat-grid" aria-label="Merit shop summary">
      {cards.map((card) => (
        <div className="shop-stat-card" key={card.label} style={shopStatAccentStyle(card.accent)}>
          <span>{card.label}</span>
          <strong>{card.value}</strong>
          <small>{card.sub}</small>
        </div>
      ))}
    </section>
  );
}

function ItemEditorModal({
  editingItemId,
  error,
  form,
  mutationPending,
  onCancel,
  onChange,
  onPhotoUploadError,
  onSubmit,
}: {
  editingItemId: string | null;
  error: string | null;
  form: ItemFormState;
  mutationPending: boolean;
  onCancel: () => void;
  onChange: (next: ItemFormState) => void;
  onPhotoUploadError: (message: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const previewItem = previewItemFromForm(form);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onCancel();
    }

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onCancel]);

  return (
    <div className="shop-editor-modal" role="presentation">
      <button
        aria-label="Close item editor"
        className="shop-editor-modal__backdrop"
        onClick={onCancel}
        type="button"
      />
      <form
        aria-labelledby="shop-editor-title"
        aria-modal="true"
        className="shop-editor-modal__dialog"
        onSubmit={onSubmit}
        role="dialog"
      >
        <header className="shop-editor-modal__header">
          <span className="shop-editor-modal__icon" aria-hidden="true">
            <ShoppingBag size={20} />
          </span>
          <span className="shop-editor-modal__title">
            <strong id="shop-editor-title">
              {editingItemId ? 'Edit Shop Item' : 'Add Shop Item'}
            </strong>
            <small>
              {editingItemId
                ? 'Update the catalogue entry and shelf settings.'
                : 'Create a new reward to put on the shelf.'}
            </small>
          </span>
          <button
            aria-label="Close item editor"
            className="shop-editor-modal__close"
            onClick={onCancel}
            type="button"
          >
            <X aria-hidden="true" size={17} />
          </button>
        </header>

        <div className="shop-editor-modal__body">
          <div className="shop-editor-preview">
            <ShopTile className="shop-editor-preview__tile" item={previewItem} size="md" />
            <div>
              <p>Preview</p>
              <span>Use a product photo or a hosted image URL.</span>
              <ShopPhotoUploadButton
                disabled={mutationPending}
                onError={onPhotoUploadError}
                onUploaded={(photo) => {
                  onChange({ ...form, photoUrl: photo.publicUrl, photoUpload: photo });
                }}
              >
                {form.photoUrl ? 'Replace Photo' : 'Upload Photo'}
              </ShopPhotoUploadButton>
              <TextInput
                aria-label="Photo URL"
                disabled={mutationPending}
                onChange={(event) => {
                  onChange({ ...form, photoUrl: event.target.value, photoUpload: null });
                }}
                placeholder="Photo URL"
                type="url"
                value={form.photoUrl}
              />
            </div>
          </div>

          <Field label="Item name">
            <TextInput
              disabled={mutationPending}
              maxLength={120}
              onChange={(event) => {
                onChange({ ...form, name: event.target.value });
              }}
              required
              value={form.name}
            />
          </Field>

          <Field label="Short blurb · shown on cards">
            <TextInput
              disabled={mutationPending}
              maxLength={160}
              onChange={(event) => {
                onChange({ ...form, blurb: event.target.value });
              }}
              placeholder="One-line description, ~6 words"
              value={form.blurb}
            />
          </Field>

          <div className="shop-editor-modal__grid">
            <Field label="Category">
              <SelectInput
                disabled={mutationPending}
                onChange={(event) => {
                  onChange({ ...form, category: event.target.value as ShopCategoryOption });
                }}
                required
                value={form.category}
              >
                {SHOP_CATEGORY_OPTIONS.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Price (merits)">
              <TextInput
                disabled={mutationPending}
                min={0}
                onChange={(event) => {
                  onChange({ ...form, priceExVat: event.target.value });
                }}
                required
                type="number"
                value={form.priceExVat}
              />
            </Field>
          </div>

          <div className="shop-editor-modal__grid">
            <Field label="Stock level">
              <TextInput
                disabled={mutationPending}
                min={0}
                onChange={(event) => {
                  onChange({ ...form, stockCount: event.target.value });
                }}
                required
                type="number"
                value={form.stockCount}
              />
            </Field>
            <Field label="Low-stock threshold">
              <TextInput
                disabled={mutationPending}
                min={0}
                onChange={(event) => {
                  onChange({ ...form, lowStockThreshold: event.target.value });
                }}
                required
                type="number"
                value={form.lowStockThreshold}
              />
            </Field>
          </div>

          <Field label="Full description">
            <textarea
              className="input"
              disabled={mutationPending}
              maxLength={1000}
              onChange={(event) => {
                onChange({ ...form, description: event.target.value });
              }}
              rows={3}
              value={form.description}
            />
          </Field>

          <label className="shop-visible-toggle">
            <span>
              <strong>Visible in Shop</strong>
              <small>Parents and students can see and reserve this item.</small>
            </span>
            <input
              checked={form.active}
              className="switch-input"
              disabled={mutationPending}
              onChange={(event) => {
                onChange({ ...form, active: event.target.checked });
              }}
              type="checkbox"
            />
          </label>

          <div aria-live="polite">{error ? <p className="status--error">{error}</p> : null}</div>
        </div>

        <footer className="shop-editor-modal__footer">
          <Button onClick={onCancel} type="button" variant="secondary">
            Cancel
          </Button>
          <Button pending={mutationPending} type="submit">
            {editingItemId ? 'Save Changes' : 'Add to Catalogue'}
          </Button>
        </footer>
      </form>
    </div>
  );
}

function CatalogueTab({
  canManageItems,
  canUploadItemPhotos,
  items,
  loading,
  onEdit,
  onPhotoUpload,
  onPhotoUploadError,
  onPriceChange,
  onStockChange,
  onToggleActive,
  pendingItemId,
}: {
  canManageItems: boolean;
  canUploadItemPhotos: boolean;
  items: readonly ShopItem[];
  loading: boolean;
  onEdit: (item: ShopItem) => void;
  onPhotoUpload: (item: ShopItem, photo: ShopPhotoUploadPayload) => Promise<void>;
  onPhotoUploadError: (message: string) => void;
  onPriceChange: (item: ShopItem, nextPriceExVat: number) => void;
  onStockChange: (item: ShopItem, nextStockCount: number) => void;
  onToggleActive: (item: ShopItem) => void;
  pendingItemId: string | null;
}) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('All');
  const [status, setStatus] = useState<CatalogueStatusFilter>('All');
  const filtered = items.filter((item) => {
    if (category !== 'All' && item.category !== category) return false;
    if (status === 'Active' && !item.active) return false;
    if (status === 'Paused' && item.active) return false;
    if (status === 'LowStock' && item.stockStatus !== 'LowStock') return false;
    if (status === 'OutOfStock' && item.stockStatus !== 'OutOfStock') return false;
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return (
      item.name.toLowerCase().includes(query) || (item.blurb ?? '').toLowerCase().includes(query)
    );
  });

  function commitPrice(event: FocusEvent<HTMLInputElement>, item: ShopItem): void {
    const input = event.currentTarget;
    const parsed = Number(input.value);

    if (!Number.isInteger(parsed) || parsed < 0) {
      input.value = String(item.priceExVat);
      return;
    }

    if (parsed !== item.priceExVat) onPriceChange(item, parsed);
  }

  return (
    <section className="shop-tab-panel" aria-labelledby="shop-catalogue-heading">
      <div className="shop-toolbar">
        <div className="shop-search-control">
          <Search aria-hidden="true" size={16} />
          <TextInput
            aria-label="Search catalogue"
            onChange={(event) => {
              setSearch(event.target.value);
            }}
            placeholder="Search catalogue..."
            value={search}
          />
        </div>
        <SelectInput
          aria-label="Filter by category"
          onChange={(event) => {
            setCategory(event.target.value as CategoryFilter);
          }}
          value={category}
        >
          <option value="All">All Categories</option>
          {SHOP_CATEGORY_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </SelectInput>
        <SelectInput
          aria-label="Filter by stock status"
          onChange={(event) => {
            setStatus(event.target.value as CatalogueStatusFilter);
          }}
          value={status}
        >
          <option value="All">All Status</option>
          <option value="Active">Active</option>
          <option value="Paused">Paused</option>
          <option value="LowStock">Low stock</option>
          <option value="OutOfStock">Out of stock</option>
        </SelectInput>
      </div>
      <div className="shop-admin-table-panel">
        <table className="shop-admin-table" aria-label="Shop catalogue">
          <thead>
            <tr>
              {['Item', 'Category', 'Price', 'Stock', 'Sold', 'Status', 'Actions'].map(
                (heading) => (
                  <th key={heading} scope="col">
                    {heading}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="shop-admin-table__empty" colSpan={7}>
                  Loading shop items...
                </td>
              </tr>
            ) : null}
            {!loading && filtered.length === 0 ? (
              <tr>
                <td className="shop-admin-table__empty" colSpan={7}>
                  No items match.
                </td>
              </tr>
            ) : null}
            {!loading
              ? filtered.map((item) => {
                  const statusInfo = statusForItem(item);

                  return (
                    <tr key={item.id}>
                      <td>
                        <div className="shop-admin-table__item">
                          <ShopTile item={item} size="sm" />
                          <span>
                            <strong>{item.name}</strong>
                            <small>{item.blurb ?? item.description ?? 'No description set.'}</small>
                          </span>
                        </div>
                      </td>
                      <td>
                        <CategoryPill item={item} />
                      </td>
                      <td>
                        <label className="shop-price-input">
                          <span className="sr-only">Price for {item.name}</span>
                          <input
                            defaultValue={item.priceExVat}
                            disabled={!canManageItems || pendingItemId === item.id}
                            min={0}
                            onBlur={(event) => {
                              commitPrice(event, item);
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') event.currentTarget.blur();
                            }}
                            type="number"
                          />
                          <small>m</small>
                        </label>
                      </td>
                      <td>
                        <div className="shop-stock-control">
                          <Button
                            aria-label={`Decrease stock for ${item.name}`}
                            disabled={
                              !canManageItems || pendingItemId === item.id || item.stockCount <= 0
                            }
                            onClick={() => {
                              onStockChange(item, Math.max(0, item.stockCount - 1));
                            }}
                            size="sm"
                            type="button"
                            variant="ghost"
                          >
                            <Minus aria-hidden="true" size={14} />
                          </Button>
                          <strong
                            className={`shop-stock-value shop-stock-value--${item.stockStatus.toLowerCase()}`}
                          >
                            {formatMerits(item.stockCount)}
                          </strong>
                          <Button
                            aria-label={`Increase stock for ${item.name}`}
                            disabled={!canManageItems || pendingItemId === item.id}
                            onClick={() => {
                              onStockChange(item, item.stockCount + 1);
                            }}
                            size="sm"
                            type="button"
                            variant="ghost"
                          >
                            <Plus aria-hidden="true" size={14} />
                          </Button>
                        </div>
                      </td>
                      <td>{formatMerits(item.soldCount)}</td>
                      <td>
                        <Badge tone={statusInfo.tone}>{statusInfo.label}</Badge>
                      </td>
                      <td>
                        {canManageItems || canUploadItemPhotos ? (
                          <div className="shop-admin-row__actions">
                            {canManageItems ? (
                              <>
                                <Button
                                  onClick={() => {
                                    onEdit(item);
                                  }}
                                  size="sm"
                                  type="button"
                                  variant="secondary"
                                >
                                  Edit
                                </Button>
                                <Button
                                  onClick={() => {
                                    onToggleActive(item);
                                  }}
                                  pending={pendingItemId === item.id}
                                  size="sm"
                                  type="button"
                                  variant="ghost"
                                >
                                  {item.active ? 'Pause' : 'Resume'}
                                </Button>
                              </>
                            ) : null}
                            {canUploadItemPhotos ? (
                              <ShopPhotoUploadButton
                                disabled={pendingItemId === item.id}
                                onError={onPhotoUploadError}
                                onUploaded={(photo) => onPhotoUpload(item, photo)}
                                variant={canManageItems ? 'ghost' : 'secondary'}
                              >
                                {item.photoUrl ? 'Replace Photo' : 'Add Photo'}
                              </ShopPhotoUploadButton>
                            ) : null}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })
              : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ReservationCard({
  canRecordPurchases,
  onCancel,
  onCollect,
  pending,
  reservation,
}: {
  canRecordPurchases: boolean;
  onCancel: (reservation: ShopReservation) => void;
  onCollect: (reservation: ShopReservation) => void;
  pending: boolean;
  reservation: ShopReservation;
}) {
  const primaryLine = reservation.lines[0];

  return (
    <article className="shop-pickup-card">
      {primaryLine ? (
        <ShopTile
          item={{
            name: primaryLine.itemName,
            photoUrl: primaryLine.itemPhotoUrl,
            category: primaryLine.category,
            categoryLabel: primaryLine.categoryLabel,
            categoryTint: primaryLine.categoryTint,
            categoryInk: primaryLine.categoryInk,
          }}
          size="sm"
        />
      ) : null}
      <div className="shop-pickup-card__body">
        <div className="shop-pickup-card__title">
          <strong>{reservation.studentName}</strong>
          <Badge tone={reservation.status === 'Ready' ? 'amber' : 'grey'}>
            {reservation.status}
          </Badge>
        </div>
        <span>{reservation.studentYearGroup}</span>
        <p>
          {reservation.lines
            .map((line) => `${String(line.unitsReserved)} × ${line.itemName}`)
            .join(', ')}
        </p>
        <small>
          {formatMerits(reservation.totalPriceMerits)} merits · placed{' '}
          {new Intl.DateTimeFormat('en-GB', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          }).format(new Date(reservation.createdAt))}
        </small>
      </div>
      {reservation.status === 'Ready' ? (
        <div className="shop-pickup-card__actions">
          <Button
            disabled={!canRecordPurchases}
            onClick={() => {
              onCollect(reservation);
            }}
            pending={pending}
            size="sm"
            type="button"
          >
            <ClipboardCheck aria-hidden="true" size={15} />
            Collect
          </Button>
          <Button
            disabled={!canRecordPurchases}
            onClick={() => {
              onCancel(reservation);
            }}
            pending={pending}
            size="sm"
            type="button"
            variant="secondary"
          >
            Cancel
          </Button>
        </div>
      ) : null}
    </article>
  );
}

function CounterSalePanel({
  activeItems,
  error,
  form,
  loading,
  onChange,
  onSubmit,
  pending,
  purchaseTotal,
  purchaseWarning,
  purchasers,
  selectedItem,
  selectedStudent,
  validPurchaseUnits,
}: {
  activeItems: readonly ShopItem[];
  error: string | null;
  form: PurchaseFormState;
  loading: boolean;
  onChange: (next: PurchaseFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  pending: boolean;
  purchaseTotal: number;
  purchaseWarning: string | null;
  purchasers: readonly ShopPurchaser[];
  selectedItem: ShopItem | null;
  selectedStudent: ShopPurchaser | null;
  validPurchaseUnits: number | null;
}) {
  return (
    <section className="panel panel__body shop-purchase-panel" aria-labelledby="shop-purchase">
      <div className="section-title">
        <div>
          <h2 id="shop-purchase">Counter Sale</h2>
          <p className="muted">For walk-up purchases completed immediately by staff.</p>
        </div>
        <Badge tone="blue">
          <ReceiptText aria-hidden="true" size={14} />
          Direct
        </Badge>
      </div>
      <form className="shop-form" onSubmit={onSubmit}>
        <Field label="Student" required>
          <SelectInput
            disabled={pending || loading}
            onChange={(event) => {
              onChange({ ...form, studentId: event.target.value });
            }}
            required
            value={form.studentId}
          >
            <option value="">Select student</option>
            {purchasers.map((student) => (
              <option key={student.id} value={student.id}>
                {student.fullName} · {displaySchoolYearLabel(student.yearGroup)} ·{' '}
                {formatMerits(student.spendBalance)} Spend
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Item" required>
          <SelectInput
            disabled={pending || loading}
            onChange={(event) => {
              onChange({ ...form, itemId: event.target.value });
            }}
            required
            value={form.itemId}
          >
            <option value="">Select item</option>
            {activeItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {formatMerits(item.priceIncVat)}m · {formatMerits(item.stockCount)}{' '}
                left
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Quantity" required>
          <TextInput
            disabled={pending}
            min={1}
            onChange={(event) => {
              onChange({ ...form, unitsBought: event.target.value });
            }}
            required
            type="number"
            value={form.unitsBought}
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
        {!loading && purchaseWarning ? <p className="status--error">{purchaseWarning}</p> : null}
        <Button disabled={loading || Boolean(purchaseWarning)} pending={pending} type="submit">
          <CheckCircle2 aria-hidden="true" size={16} />
          Confirm Sale
        </Button>
        <div aria-live="polite">{error ? <p className="status--error">{error}</p> : null}</div>
      </form>
    </section>
  );
}

function PickupsTab({
  activeItems,
  canRecordPurchases,
  counterSale,
  onCancel,
  onCollect,
  pendingReservationId,
  reservations,
}: {
  activeItems: readonly ShopItem[];
  canRecordPurchases: boolean;
  counterSale: ReactNode;
  onCancel: (reservation: ShopReservation) => void;
  onCollect: (reservation: ShopReservation) => void;
  pendingReservationId: string | null;
  reservations: readonly ShopReservation[];
}) {
  const ready = reservations.filter((reservation) => reservation.status === 'Ready');
  const recent = reservations.filter((reservation) => reservation.status !== 'Ready').slice(0, 8);

  return (
    <div className="shop-pickups-layout">
      <section
        className="panel panel__body shop-pickups-panel"
        aria-labelledby="shop-pickups-heading"
      >
        <div className="section-title">
          <div>
            <h2 id="shop-pickups-heading">Pickup Queue</h2>
            <p className="muted">Reservations are real holds until collection or cancellation.</p>
          </div>
          <Badge tone="amber">{formatMerits(ready.length)} ready</Badge>
        </div>
        {ready.length === 0 ? <div className="empty-state">No pickups in the queue.</div> : null}
        <div className="shop-pickup-list">
          {ready.map((reservation) => (
            <ReservationCard
              canRecordPurchases={canRecordPurchases}
              key={reservation.id}
              onCancel={onCancel}
              onCollect={onCollect}
              pending={pendingReservationId === reservation.id}
              reservation={reservation}
            />
          ))}
        </div>
      </section>

      <div className="shop-pickups-side">
        {canRecordPurchases ? counterSale : null}
        <section
          className="panel panel__body shop-recent-panel"
          aria-labelledby="shop-recent-heading"
        >
          <div className="section-title">
            <div>
              <h2 id="shop-recent-heading">Recent Activity</h2>
              <p className="muted">Collected and cancelled holds.</p>
            </div>
          </div>
          {recent.length === 0 ? (
            <div className="empty-state">No completed reservations yet.</div>
          ) : null}
          <div className="shop-recent-list">
            {recent.map((reservation) => (
              <div className="shop-recent-row" key={reservation.id}>
                <span
                  className={`shop-status-dot shop-status-dot--${reservation.status.toLowerCase()}`}
                />
                <div>
                  <strong>{reservation.studentName}</strong>
                  <small>
                    {reservation.status} · {formatMerits(reservation.totalPriceMerits)} merits
                  </small>
                </div>
              </div>
            ))}
          </div>
        </section>
        {activeItems.length === 0 ? null : (
          <section
            className="panel panel__body shop-recent-panel"
            aria-labelledby="shop-counter-hint"
          >
            <h2 id="shop-counter-hint">Counter-ready stock</h2>
            <div className="shop-counter-stock">
              {activeItems.slice(0, 4).map((item) => (
                <span key={item.id}>
                  {item.name}
                  <strong>{formatMerits(item.stockCount)}</strong>
                </span>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function ActivityTab({
  items,
  reservations,
}: {
  items: readonly ShopItem[];
  reservations: readonly ShopReservation[];
}) {
  const topSellers = [...items].sort((a, b) => b.soldCount - a.soldCount).slice(0, 6);
  const restockItems = items.filter(
    (item) => item.active && (item.stockStatus === 'LowStock' || item.stockStatus === 'OutOfStock'),
  );
  const collected = reservations.filter((reservation) => reservation.status === 'Collected');
  const collectedMerits = collected.reduce(
    (total, reservation) => total + reservation.totalPriceMerits,
    0,
  );

  return (
    <div className="shop-activity-layout">
      <section
        className="panel panel__body shop-activity-panel"
        aria-labelledby="shop-activity-heading"
      >
        <div className="section-title">
          <div>
            <h2 id="shop-activity-heading">Top Sellers</h2>
            <p className="muted">Collected purchases plus direct counter sales.</p>
          </div>
          <Badge tone="blue">{formatMerits(collectedMerits)}m collected</Badge>
        </div>
        {topSellers.map((item) => {
          const maxSold = Math.max(1, ...items.map((candidate) => candidate.soldCount));
          const pct = Math.round((item.soldCount / maxSold) * 100);
          return (
            <div className="shop-seller-row" key={item.id}>
              <div>
                <CategoryPill item={item} />
                <strong>{item.name}</strong>
                <span>{formatMerits(item.soldCount)} sold</span>
              </div>
              <div className="shop-seller-bar" aria-hidden="true">
                <span style={{ background: item.categoryInk, width: `${String(pct)}%` }} />
              </div>
            </div>
          );
        })}
      </section>
      <section
        className="panel panel__body shop-activity-panel"
        aria-labelledby="shop-restock-heading"
      >
        <div className="section-title">
          <div>
            <h2 id="shop-restock-heading">Restock Alerts</h2>
            <p className="muted">Items at or below their threshold.</p>
          </div>
        </div>
        {restockItems.length === 0 ? (
          <div className="empty-state">All stock levels are healthy.</div>
        ) : null}
        {restockItems.map((item) => (
          <div className="shop-restock-row" key={item.id}>
            <span
              className={`shop-status-dot shop-status-dot--${stockBadgeTone(item.stockStatus)}`}
            />
            <div>
              <strong>{item.name}</strong>
              <small>
                {formatMerits(item.stockCount)} left · threshold{' '}
                {formatMerits(item.lowStockThreshold)}
              </small>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

export function ShopWorkflowClient({
  canManageItems,
  canRecordPurchases,
  portal,
}: ShopWorkflowClientProps) {
  const utils = api.useUtils();
  const [tab, setTab] = useState<StaffShopTab>('catalogue');
  const [itemForm, setItemForm] = useState<ItemFormState>(emptyItemForm);
  const [purchaseForm, setPurchaseForm] = useState<PurchaseFormState>(emptyPurchaseForm);
  const [itemEditorOpen, setItemEditorOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [pendingItemId, setPendingItemId] = useState<string | null>(null);
  const [pendingReservationId, setPendingReservationId] = useState<string | null>(null);
  const [itemFormError, setItemFormError] = useState<string | null>(null);
  const [purchaseFormError, setPurchaseFormError] = useState<string | null>(null);

  const itemsQuery = api.shop.listItems.useQuery(
    { includeInactive: canManageItems },
    { retry: false },
  );
  const reservationsQuery = api.shop.listReservations.useQuery(undefined, {
    enabled: canManageItems || canRecordPurchases,
    retry: false,
  });
  const purchasersQuery = api.shop.listPurchasers.useQuery(undefined, {
    enabled: canRecordPurchases,
    retry: false,
  });
  const createItem = api.shop.createItem.useMutation({
    onSuccess: async () => {
      setItemForm(emptyItemForm());
      setEditingItemId(null);
      setItemEditorOpen(false);
      showSuccessToast('Item created.');
      await utils.shop.listItems.invalidate();
    },
    onError(error) {
      showErrorToast(error, 'Item could not be created.');
    },
  });
  const updateItem = api.shop.updateItem.useMutation({
    onSettled: () => {
      setPendingItemId(null);
    },
    onSuccess: async (item) => {
      if (editingItemId === item.id) {
        setItemForm(emptyItemForm());
        setEditingItemId(null);
        setItemEditorOpen(false);
      }
      showSuccessToast(item.active ? 'Item updated.' : 'Item paused.');
      await utils.shop.listItems.invalidate();
    },
    onError(error) {
      showErrorToast(error, 'Item could not be updated.');
    },
  });
  const updateItemPhoto = api.shop.updateItemPhoto.useMutation({
    onSettled: () => {
      setPendingItemId(null);
    },
    onSuccess: async () => {
      showSuccessToast('Item photo updated.');
      await utils.shop.listItems.invalidate();
    },
    onError(error) {
      showErrorToast(error, 'Item photo could not be updated.');
    },
  });
  const purchase = api.shop.purchase.useMutation({
    onSuccess: async (result) => {
      setPurchaseForm((current) => ({ ...current, unitsBought: '1' }));
      showSuccessToast(
        `Counter sale recorded for ${formatMerits(result.totalPriceMerits)} merits.`,
      );
      await Promise.all([
        utils.shop.listItems.invalidate(),
        utils.shop.listPurchasers.invalidate(),
        utils.shop.listReservations.invalidate(),
      ]);
    },
    onError(error) {
      showErrorToast(error, 'Counter sale could not be recorded.');
    },
  });
  const collectReservation = api.shop.collectReservation.useMutation({
    onSettled: () => {
      setPendingReservationId(null);
    },
    onSuccess: async (reservation) => {
      showSuccessToast(`Collected reservation for ${reservation.studentName}.`);
      await Promise.all([
        utils.shop.listItems.invalidate(),
        utils.shop.listReservations.invalidate(),
        utils.shop.listPurchasers.invalidate(),
      ]);
    },
    onError(error) {
      showErrorToast(error, 'Reservation could not be collected.');
    },
  });
  const cancelReservation = api.shop.cancelReservation.useMutation({
    onSettled: () => {
      setPendingReservationId(null);
    },
    onSuccess: async (reservation) => {
      showSuccessToast(`Cancelled reservation for ${reservation.studentName}.`);
      await Promise.all([
        utils.shop.listItems.invalidate(),
        utils.shop.listReservations.invalidate(),
        utils.shop.listPurchasers.invalidate(),
      ]);
    },
    onError(error) {
      showErrorToast(error, 'Reservation could not be cancelled.');
    },
  });

  const items = useMemo(() => itemsQuery.data ?? [], [itemsQuery.data]);
  const activeItems = useMemo(
    () => items.filter((item) => item.active && item.stockCount > 0),
    [items],
  );
  const reservations = useMemo(() => reservationsQuery.data ?? [], [reservationsQuery.data]);
  const readyReservationCount = reservations.filter(
    (reservation) => reservation.status === 'Ready',
  ).length;
  const purchasers = purchasersQuery.data ?? [];
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
    createItem.isPending ||
    (updateItem.isPending && pendingItemId === null) ||
    (updateItemPhoto.isPending && pendingItemId === null);
  const itemMutationError = createItem.error ?? updateItem.error ?? updateItemPhoto.error;
  const reservationMutationError = collectReservation.error ?? cancelReservation.error;

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
    setItemEditorOpen(true);
    setItemFormError(null);
  }

  function beginCreateItem(): void {
    setEditingItemId(null);
    setItemForm(emptyItemForm());
    setItemEditorOpen(true);
    setItemFormError(null);
  }

  function cancelEdit(): void {
    setItemEditorOpen(false);
    setEditingItemId(null);
    setItemForm(emptyItemForm());
    setItemFormError(null);
  }

  async function submitItem(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setItemFormError(null);

    const payload = buildItemPayload(itemForm);
    if (typeof payload === 'string') {
      setItemFormError(payload);
      return;
    }

    const saveAsActive = itemForm.active;

    try {
      if (editingItemId) {
        const updatePayload: UpdateItemInput = {
          id: editingItemId,
          ...payload,
          blurb: itemForm.blurb.trim() || null,
          description: itemForm.description.trim() || null,
          active: saveAsActive,
        };
        await updateItem.mutateAsync(updatePayload);
        if (itemForm.photoUpload) {
          setPendingItemId(editingItemId);
          await updateItemPhoto.mutateAsync({ id: editingItemId, photo: itemForm.photoUpload });
        }
        return;
      }
      const createdItem = await createItem.mutateAsync(payload);
      if (itemForm.photoUpload) {
        setPendingItemId(createdItem.id);
        await updateItemPhoto.mutateAsync({ id: createdItem.id, photo: itemForm.photoUpload });
      }
      if (!saveAsActive) {
        setPendingItemId(createdItem.id);
        await updateItem.mutateAsync({ id: createdItem.id, active: false });
      }
    } catch {
      // The mutation error is shown in a toast and inline below the form.
    }
  }

  function toggleItemActive(item: ShopItem): void {
    setItemFormError(null);
    setPendingItemId(item.id);
    updateItem.mutate({ id: item.id, active: !item.active });
  }

  function changeItemStock(item: ShopItem, nextStockCount: number): void {
    setItemFormError(null);
    setPendingItemId(item.id);
    updateItem.mutate({ id: item.id, stockCount: Math.max(0, nextStockCount) });
  }

  function changeItemPrice(item: ShopItem, nextPriceExVat: number): void {
    setItemFormError(null);
    setPendingItemId(item.id);
    updateItem.mutate({ id: item.id, priceExVat: Math.max(0, nextPriceExVat) });
  }

  async function updatePhoto(item: ShopItem, photo: ShopPhotoUploadPayload): Promise<void> {
    setItemFormError(null);
    setPendingItemId(item.id);
    await updateItemPhoto.mutateAsync({ id: item.id, photo });
  }

  function exportCatalogue(): void {
    downloadCsv('merit-shop-catalogue.csv', buildCatalogueCsv(items), 'text/csv;charset=utf-8');
  }

  async function submitPurchase(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
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
      // The mutation error is shown in a toast and inline below the form.
    }
  }

  function collect(reservation: ShopReservation): void {
    setPendingReservationId(reservation.id);
    collectReservation.mutate({ reservationId: reservation.id });
  }

  function cancel(reservation: ShopReservation): void {
    setPendingReservationId(reservation.id);
    cancelReservation.mutate({ reservationId: reservation.id });
  }

  const counterSale = (
    <CounterSalePanel
      activeItems={activeItems}
      error={
        purchaseFormError ??
        (purchase.error
          ? friendlyErrorMessage(purchase.error)
          : purchasersQuery.error
            ? friendlyErrorMessage(purchasersQuery.error)
            : null)
      }
      form={purchaseForm}
      loading={purchaseQueriesLoading}
      onChange={setPurchaseForm}
      onSubmit={(event) => {
        void submitPurchase(event);
      }}
      pending={purchase.isPending}
      purchaseTotal={purchaseTotal}
      purchaseWarning={purchaseWarning}
      purchasers={purchasers}
      selectedItem={selectedItem}
      selectedStudent={selectedStudent}
      validPurchaseUnits={validPurchaseUnits}
    />
  );

  return (
    <div className="shop-page">
      <div className="page-header">
        <div>
          <h1>{portal === 'admin' ? 'Merit Shop · Admin' : 'Merit Shop'}</h1>
          <p>
            {portal === 'admin'
              ? 'Manage catalogue, prices, stock and pickups for the term.'
              : 'Manage pickups and direct shopkeeper purchases.'}
          </p>
        </div>
        <div className="page-header__actions">
          <Button
            disabled={items.length === 0}
            onClick={exportCatalogue}
            type="button"
            variant="secondary"
          >
            Export CSV
          </Button>
          {canManageItems ? (
            <Button onClick={beginCreateItem} type="button">
              <Plus aria-hidden="true" size={15} />
              Add Item
            </Button>
          ) : null}
        </div>
      </div>

      <ShopStatCards items={items} readyReservationCount={readyReservationCount} />

      {itemEditorOpen && canManageItems ? (
        <ItemEditorModal
          editingItemId={editingItemId}
          error={
            itemFormError ?? (itemMutationError ? friendlyErrorMessage(itemMutationError) : null)
          }
          form={itemForm}
          mutationPending={itemMutationPending}
          onCancel={cancelEdit}
          onChange={setItemForm}
          onPhotoUploadError={setItemFormError}
          onSubmit={(event) => {
            void submitItem(event);
          }}
        />
      ) : null}

      <div className="shop-tabs" role="tablist" aria-label="Shop workflow tabs">
        {SHOP_WORKFLOW_TABS.map(({ id, label }) => {
          const count =
            id === 'catalogue' ? items.length : id === 'pickups' ? readyReservationCount : null;

          return (
            <button
              aria-selected={tab === id}
              className={tab === id ? 'is-active' : undefined}
              key={id}
              onClick={() => {
                setTab(id);
              }}
              role="tab"
              type="button"
            >
              {label}
              {typeof count === 'number' && count > 0 ? <span>{formatMerits(count)}</span> : null}
            </button>
          );
        })}
      </div>

      {itemsQuery.error ? (
        <p className="status--error">{friendlyErrorMessage(itemsQuery.error)}</p>
      ) : null}
      {reservationsQuery.error ? (
        <p className="status--error">{friendlyErrorMessage(reservationsQuery.error)}</p>
      ) : null}
      {reservationMutationError ? (
        <p className="status--error">{friendlyErrorMessage(reservationMutationError)}</p>
      ) : null}
      {!itemEditorOpen && itemFormError ? <p className="status--error">{itemFormError}</p> : null}
      {!itemEditorOpen && itemMutationError ? (
        <p className="status--error">{friendlyErrorMessage(itemMutationError)}</p>
      ) : null}

      {tab === 'catalogue' ? (
        <CatalogueTab
          canManageItems={canManageItems}
          canUploadItemPhotos={canManageItems || canRecordPurchases}
          items={items}
          loading={itemsQuery.isLoading}
          onEdit={beginEdit}
          onPhotoUpload={updatePhoto}
          onPhotoUploadError={setItemFormError}
          onPriceChange={changeItemPrice}
          onStockChange={changeItemStock}
          onToggleActive={toggleItemActive}
          pendingItemId={pendingItemId}
        />
      ) : null}

      {tab === 'pickups' ? (
        <PickupsTab
          activeItems={activeItems}
          canRecordPurchases={canRecordPurchases}
          counterSale={counterSale}
          onCancel={cancel}
          onCollect={collect}
          pendingReservationId={pendingReservationId}
          reservations={reservations}
        />
      ) : null}

      {tab === 'activity' ? <ActivityTab items={items} reservations={reservations} /> : null}
    </div>
  );
}

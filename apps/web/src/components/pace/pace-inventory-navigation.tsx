'use client';

import type { KeyboardEvent } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SelectInput } from '@/components/ui/field';

export const inventoryTabs = [
  { id: 'attention', label: 'Needs attention' },
  { id: 'planner', label: 'Planner' },
  { id: 'orders', label: 'Orders' },
  { id: 'diagnostics', label: 'Diagnostics' },
] as const;

export type InventoryTab = (typeof inventoryTabs)[number]['id'];

export function PaceInventoryTabs({
  activeTab,
  attentionCount,
  onChange,
}: {
  activeTab: InventoryTab;
  attentionCount: number;
  onChange: (tab: InventoryTab) => void;
}) {
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const index = inventoryTabs.findIndex((tab) => tab.id === activeTab);
    const nextIndex =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? inventoryTabs.length - 1
          : (index + (event.key === 'ArrowRight' ? 1 : -1) + inventoryTabs.length) %
            inventoryTabs.length;
    const next = inventoryTabs[nextIndex];
    if (!next) return;
    onChange(next.id);
    document.getElementById(`pace-inventory-tab-${next.id}`)?.focus();
  }

  return (
    <div
      aria-label="PACE inventory sections"
      className="pace-inventory-tabs"
      onKeyDown={handleKeyDown}
      role="tablist"
    >
      {inventoryTabs.map((tab) => (
        <button
          aria-controls={`pace-inventory-panel-${tab.id}`}
          aria-selected={activeTab === tab.id}
          className={activeTab === tab.id ? 'is-selected' : ''}
          id={`pace-inventory-tab-${tab.id}`}
          key={tab.id}
          onClick={() => {
            onChange(tab.id);
          }}
          role="tab"
          tabIndex={activeTab === tab.id ? 0 : -1}
          type="button"
        >
          {tab.label}
          {tab.id === 'attention' ? ` (${String(attentionCount)})` : ''}
        </button>
      ))}
    </div>
  );
}

export function InventoryPagination({
  label,
  onPageChange,
  onPageSizeChange,
  page,
  pageSize,
  total,
}: {
  label: string;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  page: number;
  pageSize: number;
  total: number;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  return (
    <nav aria-label={`${label} pages`} className="pace-inventory-pagination">
      <span aria-live="polite" className="pace-inventory-pagination__summary">
        Showing{' '}
        <strong>
          {String(start)}–{String(end)}
        </strong>{' '}
        of <strong>{String(total)}</strong>
      </span>
      <div className="pace-inventory-pagination__controls">
        {onPageSizeChange ? (
          <label className="pace-inventory-pagination__size">
            <span>Per page</span>
            <SelectInput
              onChange={(event) => {
                onPageSizeChange(Number(event.target.value));
              }}
              value={pageSize}
            >
              {[5, 10, 20].map((size) => (
                <option key={size} value={size}>
                  {String(size)}
                </option>
              ))}
            </SelectInput>
          </label>
        ) : null}
        <div className="pace-inventory-pagination__pager">
          <Button
            aria-label="Previous page"
            disabled={page <= 1}
            onClick={() => {
              onPageChange(page - 1);
            }}
            size="sm"
            type="button"
            variant="secondary"
          >
            <ChevronLeft aria-hidden="true" size={16} />
            Previous
          </Button>
          <span className="pace-inventory-pagination__page">
            Page {String(page)} of {String(totalPages)}
          </span>
          <Button
            aria-label="Next page"
            disabled={page >= totalPages}
            onClick={() => {
              onPageChange(page + 1);
            }}
            size="sm"
            type="button"
            variant="secondary"
          >
            Next
            <ChevronRight aria-hidden="true" size={16} />
          </Button>
        </div>
      </div>
    </nav>
  );
}

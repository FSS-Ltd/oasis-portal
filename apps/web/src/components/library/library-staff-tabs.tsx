'use client';

import { LIBRARY_STAFF_VIEWS, type LibraryStaffView } from '@oasis/domain';

export function LibraryStaffTabs({
  value,
  onChange,
}: {
  value: LibraryStaffView;
  onChange: (value: LibraryStaffView) => void;
}) {
  return (
    <div
      aria-label="Library workspace"
      className="library-workspace-tabs"
      role="tablist"
      onKeyDown={(event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const index = LIBRARY_STAFF_VIEWS.findIndex((view) => view.id === value);
        const nextIndex =
          event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? LIBRARY_STAFF_VIEWS.length - 1
              : (index + (event.key === 'ArrowRight' ? 1 : -1) + LIBRARY_STAFF_VIEWS.length) %
                LIBRARY_STAFF_VIEWS.length;
        const next = LIBRARY_STAFF_VIEWS[nextIndex];
        if (!next) return;
        onChange(next.id);
        event.currentTarget.querySelector<HTMLButtonElement>(`#library-view-${next.id}`)?.focus();
      }}
    >
      {LIBRARY_STAFF_VIEWS.map((view) => (
        <button
          key={view.id}
          id={`library-view-${view.id}`}
          type="button"
          role="tab"
          aria-controls="library-workspace-panel"
          aria-selected={value === view.id}
          tabIndex={value === view.id ? 0 : -1}
          onClick={() => {
            onChange(view.id);
          }}
        >
          {view.label}
        </button>
      ))}
    </div>
  );
}

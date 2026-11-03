'use client';

import {
  LIBRARY_BOOK_COLLECTIONS,
  LIBRARY_BOOK_COLLECTION_LABELS,
  type LibraryBookCollection,
} from '@oasis/domain';

export function LibraryCollectionTabs({
  value,
  onChange,
}: {
  value: LibraryBookCollection;
  onChange: (value: LibraryBookCollection) => void;
}) {
  return (
    <div
      className="library-filter"
      role="tablist"
      aria-label="Book collections"
      onKeyDown={(event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const next =
          event.key === 'Home'
            ? 'General'
            : event.key === 'End'
              ? 'RhinoReaders'
              : value === 'General'
                ? 'RhinoReaders'
                : 'General';
        onChange(next);
        document.getElementById(`library-collection-${next}`)?.focus();
      }}
    >
      {LIBRARY_BOOK_COLLECTIONS.map((collection) => (
        <button
          aria-controls="library-catalogue-panel"
          aria-selected={value === collection}
          className={`button button--md ${value === collection ? 'button--primary' : 'button--secondary'}`}
          id={`library-collection-${collection}`}
          key={collection}
          onClick={() => {
            onChange(collection);
          }}
          role="tab"
          tabIndex={value === collection ? 0 : -1}
          type="button"
        >
          {LIBRARY_BOOK_COLLECTION_LABELS[collection]}
        </button>
      ))}
    </div>
  );
}

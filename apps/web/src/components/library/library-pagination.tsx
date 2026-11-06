'use client';

export function LibraryPagination({
  page,
  nextPage,
  pending,
  onPage,
  label,
}: {
  page: number;
  nextPage: number | null | undefined;
  pending: boolean;
  onPage: (page: number) => void;
  label: string;
}) {
  return (
    <nav aria-label={label} className="library-pagination">
      <button
        className="button button--secondary button--sm"
        type="button"
        disabled={page === 1 || pending}
        onClick={() => {
          onPage(page - 1);
        }}
      >
        Previous
      </button>
      <span aria-live="polite">Page {page}</span>
      <button
        className="button button--secondary button--sm"
        type="button"
        disabled={!nextPage || pending}
        onClick={() => {
          if (nextPage) onPage(nextPage);
        }}
      >
        Next
      </button>
    </nav>
  );
}

import { PAGE_LIMITS, paginationRange } from "../../lib/pagination";

function PaginationControls({
  pagination,
  onPageChange,
  onLimitChange,
  disabled = false,
  ariaLabel = "Pagination",
  className = "",
}) {
  const { start, end, totalItems, page, totalPages, limit } = paginationRange(pagination);
  const hasResults = totalItems > 0;
  const controlsDisabled = disabled || !hasResults;

  return (
    <nav className={`pagination-controls ${className}`.trim()} aria-label={ariaLabel}>
      <p className="pagination-controls__summary" aria-live="polite">
        Showing {start}–{end} of {totalItems}
        {hasResults && `, page ${page} of ${totalPages}`}
      </p>

      <div className="pagination-controls__actions">
        <label className="pagination-controls__limit-label">
          Results per page
          <select
            value={limit}
            disabled={disabled}
            onChange={(event) => onLimitChange?.(Number(event.target.value))}
            aria-label="Results per page"
          >
            {PAGE_LIMITS.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>

        {hasResults && (
          <div className="pagination-controls__pages">
            <button
              type="button"
              disabled={controlsDisabled || page <= 1}
              onClick={() => onPageChange?.(page - 1)}
              aria-label="Go to previous page"
            >
              Previous
            </button>
            <span aria-hidden="true">Page {page} of {totalPages}</span>
            <button
              type="button"
              disabled={controlsDisabled || page >= totalPages}
              onClick={() => onPageChange?.(page + 1)}
              aria-label="Go to next page"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}

export default PaginationControls;

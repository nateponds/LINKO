import { PAGE_LIMITS, paginationRange } from "../../lib/pagination";
import { ChevronLeft, ChevronRight } from "lucide-react";

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
  if (totalPages <= 1 && totalItems <= PAGE_LIMITS[0]) return null;

  return (
    <nav className={`pagination-controls ${className}`.trim()} aria-label={ariaLabel}>
      <p className="pagination-controls__summary" aria-live="polite">
        {start}–{end} of {totalItems}
      </p>

      <div className="pagination-controls__actions">
        <label className="pagination-controls__limit-label">
          <span className="sr-only">Results per page</span>
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

        {hasResults && totalPages > 1 && (
          <div className="pagination-controls__pages">
            <button
              type="button"
              disabled={controlsDisabled || page <= 1}
              onClick={() => onPageChange?.(page - 1)}
              aria-label="Go to previous page"
            >
              <ChevronLeft size={16} aria-hidden="true" />
            </button>
            <span aria-label={`Page ${page} of ${totalPages}`}>{page} / {totalPages}</span>
            <button
              type="button"
              disabled={controlsDisabled || page >= totalPages}
              onClick={() => onPageChange?.(page + 1)}
              aria-label="Go to next page"
            >
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}

export default PaginationControls;

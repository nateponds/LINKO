export function LogisticsPlaceholder({ label }) {
  return (
    <div className="logistics-placeholder" role="status" aria-live="polite">
      <span className="logistics-placeholder-bar" />
      <span className="logistics-placeholder-bar logistics-placeholder-bar--short" />
      <span className="logistics-placeholder-label">Loading {label}</span>
    </div>
  );
}

export function LogisticsNotice({ message, onRetry, retryLabel = "Try again" }) {
  return (
    <div className="page-empty">
      <p>{message}</p>
      {onRetry ? (
        <button type="button" className="logistics-retry-btn" onClick={onRetry}>
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}

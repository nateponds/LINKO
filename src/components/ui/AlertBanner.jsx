import "./AlertBanner.css";

export default function AlertBanner({
  variant = "info",
  role,
  children,
  action,
  className = "",
}) {
  const resolvedRole = role ?? (variant === "error" ? "alert" : "status");

  return (
    <div
      role={resolvedRole}
      className={`ui-alert-banner ui-alert-banner--${variant} ${className}`.trim()}
    >
      <div className="ui-alert-banner__content">{children}</div>
      {action && <div className="ui-alert-banner__action">{action}</div>}
    </div>
  );
}

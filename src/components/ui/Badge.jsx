import "./Badge.css";

export default function Badge({
  variant = "neutral",
  children,
  className = "",
}) {
  return (
    <span className={`ui-badge ui-badge--${variant} ${className}`.trim()}>
      {children}
    </span>
  );
}

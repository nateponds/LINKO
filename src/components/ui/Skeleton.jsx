import "./Skeleton.css";

/* Shared placeholder primitive. Pages compose it into the shape of the
   content they stand in for. The shimmer is decorative; reduced motion
   keeps a static block (see Skeleton.css). */
export function Skeleton({ className = "", width, height, radius, style }) {
  const inline = {
    ...(width != null ? { width } : null),
    ...(height != null ? { height } : null),
    ...(radius != null ? { borderRadius: radius } : null),
    ...style,
  };

  return (
    <span
      className={className ? `skeleton ${className}` : "skeleton"}
      style={inline}
      aria-hidden="true"
    />
  );
}

export function SkeletonStatus({ label = "Loading", className = "", children }) {
  return (
    <div
      className={className ? `skeleton-status ${className}` : "skeleton-status"}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="skeleton-sr">{label}</span>
      {children}
    </div>
  );
}

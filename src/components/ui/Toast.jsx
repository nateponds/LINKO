import { useEffect, useState } from "react";
import { Check, TriangleAlert, X } from "lucide-react";
import "./Toast.css";

// Match the exit animation in Toast.css before removing the popup.
const EXIT_MS = 200;

function ToastMessage({ notification, duration, onDismiss, action }) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [closing, setClosing] = useState(false);
  const isError = notification.variant === "error";
  const Icon = isError ? TriangleAlert : Check;

  useEffect(() => {
    if (closing || hovered || focused) return undefined;
    const timer = window.setTimeout(() => setClosing(true), duration);
    return () => window.clearTimeout(timer);
  }, [closing, duration, focused, hovered]);

  useEffect(() => {
    if (!closing) return undefined;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(onDismiss, reducedMotion ? 0 : EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [closing, onDismiss]);

  return (
    <div
      className={`toast${isError ? " toast--error" : ""}${closing ? " is-closing" : ""}`}
      inert={closing}
      aria-hidden={closing || undefined}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
    >
      <span className="toast__icon" aria-hidden="true"><Icon size={18} /></span>
      <div className="toast__content">
        <p className="toast__title">{notification.title}</p>
        <p className="toast__message">{notification.message}</p>
        {action && <div className="toast__action">{action}</div>}
      </div>
      <button type="button" className="toast__dismiss" aria-label="Dismiss notification" onClick={() => setClosing(true)}>
        <X size={18} aria-hidden="true" />
      </button>
    </div>
  );
}

export default function Toast({ notification, duration = 4000, onDismiss, action }) {
  const isError = notification?.variant === "error";
  return (
    <div className="toast-region" role={isError ? "alert" : "status"} aria-live={isError ? "assertive" : "polite"} aria-atomic="true">
      {notification && (
        <ToastMessage key={notification.id} notification={notification} duration={duration} onDismiss={onDismiss} action={action} />
      )}
    </div>
  );
}

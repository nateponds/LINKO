// Reusable confirmation dialog, extracted from the confirm pane inside
// src/features/settings/LocationModal.jsx. It intentionally reuses the existing
// settings.css classes (settings-modal-backdrop / -dialog / -body /
// settings-modal-confirm / -confirm-actions / settings-btn*), plus a
// .confirm-dialog* block in settings.css for the destructive-action styling
// and the slide-from-bottom transition.
// Callers own their own `open` state; there is no context or portal here.
// ponytail: no `busy`/in-flight prop — every caller closes the dialog
// synchronously in onConfirm, so it unmounts before a second click can land.
// Add one only if a caller needs to keep the dialog open across an await.
import { useEffect, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { useDialogFocus } from "./useDialogFocus";
import { lockBodyScroll } from "../../lib/bodyScrollLock";

const TITLE_ID = "confirm-dialog-title";
// Keep in sync with the .confirm-dialog slide-out duration in settings.css.
const EXIT_MS = 200;

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}) {
  const dialogRef = useRef(null);
  const cancelButtonRef = useRef(null);
  // Stay mounted for one animation after `open` flips false, so the dialog
  // can slide back out instead of vanishing. `closing` drives the exit class.
  const [closing, setClosing] = useState(false);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (!open) return undefined;
    return lockBodyScroll();
  }, [open]);

  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      return;
    }

    if (!wasOpen.current) return;   // never opened; nothing to animate out
    wasOpen.current = false;
    setClosing(true);
    const timer = setTimeout(() => setClosing(false), EXIT_MS);
    return () => clearTimeout(timer);
  }, [open]);

  useDialogFocus({
    open,
    dialogRef,
    initialFocusRef: cancelButtonRef,
    onEscape: onCancel,
  });

  if (!open && !closing) return null;

  // `open` wins over a stale `closing` so reopening mid-exit snaps back to
  // the entrance animation rather than finishing the slide-out.
  const isClosing = closing && !open;

  return (
    <div
      className={`settings-modal-backdrop confirm-dialog-backdrop${isClosing ? " is-closing" : ""}`}
      onClick={(e) => {
        if (isClosing) return;
        if (e.target === e.currentTarget) onCancel?.();
      }}
    >
      <div
        className={`settings-modal-dialog confirm-dialog${isClosing ? " is-closing" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={TITLE_ID}
        tabIndex="-1"
        ref={dialogRef}
      >
        <div className="settings-modal-body settings-modal-confirm confirm-dialog-body">
          <span className="confirm-dialog-icon">
            <AlertTriangle size={40} strokeWidth={2.5} />
          </span>
          <h3 id={TITLE_ID}>{title}</h3>
          <p>{message}</p>
          <div className="settings-modal-confirm-actions">
            <button
              className="settings-btn settings-btn-outline"
              ref={cancelButtonRef}
              onClick={onCancel}
            >
              {cancelLabel}
            </button>
            <button
              className="settings-btn settings-btn-danger"
              onClick={onConfirm}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

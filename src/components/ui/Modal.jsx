import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { useDialogFocus } from "./useDialogFocus";
import { lockBodyScroll } from "../../lib/bodyScrollLock";
import "./Modal.css";

export default function Modal({
  open,
  title,
  onClose,
  size = "md",
  children,
  footer,
  className = "",
}) {
  const titleId = useId();
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    return lockBodyScroll();
  }, [open]);

  useDialogFocus({
    open,
    dialogRef,
    initialFocusRef: closeButtonRef,
    onEscape: onClose,
  });

  if (!open) return null;

  return (
    <div
      className="ui-modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div
        className={`ui-modal ui-modal--${size} ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex="-1"
        ref={dialogRef}
      >
        <div className="ui-modal__header">
          {title && (
            <h2 id={titleId} className="ui-modal__title">
              {title}
            </h2>
          )}
          <button
            type="button"
            className="ui-modal__close"
            ref={closeButtonRef}
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="ui-modal__body">{children}</div>
        {footer && <div className="ui-modal__footer">{footer}</div>}
      </div>
    </div>
  );
}

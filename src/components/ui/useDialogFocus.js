import { useEffect, useRef } from "react";

// Each registered dialog participates in one focus stack. CSS z-index decides
// between different modal layers; registration order breaks ties for stacked
// dialogs that use the same overlay style.
const openDialogs = [];
let nextOrder = 0;

function getOverlayZIndex(dialog) {
  const overlay = dialog?.parentElement;
  if (!overlay) return 0;

  const zIndex = Number.parseInt(window.getComputedStyle(overlay).zIndex, 10);
  return Number.isFinite(zIndex) ? zIndex : 0;
}

function getTopDialog() {
  return openDialogs.reduce((top, entry) => {
    if (!top) return entry;
    return entry.zIndex > top.zIndex || (entry.zIndex === top.zIndex && entry.order > top.order)
      ? entry
      : top;
  }, null);
}

function isRendered(element) {
  if (!(element instanceof HTMLElement) || !element.isConnected) return false;
  if (element.closest('[hidden], [inert], [aria-hidden="true"]')) return false;

  let current = element;
  while (current instanceof HTMLElement) {
    const style = window.getComputedStyle(current);
    if (
      style.display === "none"
      || style.visibility === "hidden"
      || style.visibility === "collapse"
    ) {
      return false;
    }
    current = current.parentElement;
  }

  return element.getClientRects().length > 0;
}

function isVisible(element) {
  if (!isRendered(element)) return false;

  let current = element;
  while (current instanceof HTMLElement) {
    if (Number(window.getComputedStyle(current).opacity) === 0) return false;
    current = current.parentElement;
  }

  return true;
}

function getFocusableElements(dialog) {
  if (!dialog) return [];

  return Array.from(
    dialog.querySelectorAll(
      'a[href], area[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), iframe, object, embed, [contenteditable="true"], [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => element.tabIndex >= 0 && isRendered(element));
}

function focusInside(entry, preferred = entry.initialFocusRef.current) {
  const dialog = entry.dialogRef.current;
  if (!dialog) return;

  const focusTarget = isRendered(preferred) && dialog.contains(preferred)
    ? preferred
    : getFocusableElements(dialog)[0] ?? dialog;
  focusTarget.focus({ preventScroll: true });
}

/** Keep focus in an open dialog and return it to a visible opener on close. */
export function useDialogFocus({ open, dialogRef, initialFocusRef, onEscape }) {
  const onEscapeRef = useRef(onEscape);
  useEffect(() => {
    onEscapeRef.current = onEscape;
  }, [onEscape]);

  useEffect(() => {
    if (!open || !dialogRef.current) return undefined;

    const activeElement = document.activeElement;
    const entry = {
      dialogRef,
      initialFocusRef,
      opener: activeElement instanceof HTMLElement && activeElement !== document.body
        ? activeElement
        : null,
      order: nextOrder++,
      zIndex: getOverlayZIndex(dialogRef.current),
    };
    openDialogs.push(entry);

    const handleFocusIn = (event) => {
      if (getTopDialog() !== entry) return;
      if (!entry.dialogRef.current?.contains(event.target)) focusInside(entry);
    };

    const handleKeyDown = (event) => {
      if (getTopDialog() !== entry) return;

      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        onEscapeRef.current?.();
        return;
      }

      if (event.key !== "Tab") return;

      const dialog = entry.dialogRef.current;
      const focusableElements = getFocusableElements(dialog);
      const first = focusableElements[0];
      const last = focusableElements.at(-1);
      const activeElement = document.activeElement;

      if (!focusableElements.length) {
        event.preventDefault();
        dialog?.focus({ preventScroll: true });
      } else if (!dialog?.contains(activeElement) || !focusableElements.includes(activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus({ preventScroll: true });
      } else if (event.shiftKey && activeElement === first) {
        event.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!event.shiftKey && activeElement === last) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    };

    document.addEventListener("focusin", handleFocusIn, true);
    document.addEventListener("keydown", handleKeyDown, true);
    if (getTopDialog() === entry) focusInside(entry);

    return () => {
      document.removeEventListener("focusin", handleFocusIn, true);
      document.removeEventListener("keydown", handleKeyDown, true);

      const wasTopDialog = getTopDialog() === entry;
      const index = openDialogs.indexOf(entry);
      if (index !== -1) openDialogs.splice(index, 1);

      if (wasTopDialog && isVisible(entry.opener)) {
        entry.opener.focus({ preventScroll: true });
      }
    };
  }, [open, dialogRef, initialFocusRef]);
}

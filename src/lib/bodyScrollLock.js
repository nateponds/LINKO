let lockCount = 0;
let originalOverflow;

export function lockBodyScroll() {
  if (typeof document === "undefined") {
    return () => {};
  }

  if (lockCount === 0) {
    originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }

  lockCount += 1;
  let released = false;

  return () => {
    if (released) return;
    released = true;
    lockCount -= 1;

    if (lockCount === 0) {
      document.body.style.overflow = originalOverflow;
      originalOverflow = undefined;
    }
  };
}

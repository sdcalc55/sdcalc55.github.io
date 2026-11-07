let keyboardScrollRestoreInstalled = false;

function installKeyboardScrollRestore() {
  if (keyboardScrollRestoreInstalled || typeof window === "undefined") return;
  keyboardScrollRestoreInstalled = true;

  const viewport = window.visualViewport;
  if (!viewport) return;

  let keyboardOpen = window.innerHeight - viewport.height > 120;
  let savedScrollY = window.scrollY;
  let hasSavedPosition = false;
  let userScrolledWhileKeyboardOpen = false;
  let touchStartY = 0;
  let restoreTimer: number | undefined;

  const isTextField = (target: EventTarget | null): boolean =>
    target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;

  // Save the position on the initial tap, before Android moves the page
  // to reveal the field above the virtual keyboard.
  document.addEventListener("pointerdown", event => {
    if (!isTextField(event.target)) return;
    savedScrollY = window.scrollY;
    hasSavedPosition = true;
    userScrolledWhileKeyboardOpen = false;
  }, true);

  document.addEventListener("focusin", event => {
    if (!isTextField(event.target)) return;
    // Fallback for fields focused by script or accessibility controls.
    if (!hasSavedPosition) {
      savedScrollY = window.scrollY;
      hasSavedPosition = true;
      userScrolledWhileKeyboardOpen = false;
    }
  }, true);

  // A deliberate finger swipe while the keyboard is open means the user
  // chose a new page position. Never undo that choice on keyboard dismissal.
  document.addEventListener("touchstart", event => {
    touchStartY = event.touches[0]?.clientY ?? 0;
  }, { passive: true, capture: true });

  document.addEventListener("touchmove", event => {
    const y = event.touches[0]?.clientY ?? touchStartY;
    if (keyboardOpen && Math.abs(y - touchStartY) > 10) {
      userScrolledWhileKeyboardOpen = true;
    }
  }, { passive: true, capture: true });

  const restoreAfterKeyboard = () => {
    if (!hasSavedPosition || userScrolledWhileKeyboardOpen) {
      hasSavedPosition = false;
      return;
    }
    window.scrollTo({ top: savedScrollY, left: 0, behavior: "instant" });
    hasSavedPosition = false;
  };

  viewport.addEventListener("resize", () => {
    const nextKeyboardOpen = window.innerHeight - viewport.height > 120;

    if (nextKeyboardOpen) {
      keyboardOpen = true;
      return;
    }

    if (keyboardOpen) {
      keyboardOpen = false;
      if (restoreTimer !== undefined) window.clearTimeout(restoreTimer);

      // Wait until Android completes the keyboard closing animation.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          restoreAfterKeyboard();
        });
      });
      restoreTimer = window.setTimeout(() => {
        restoreAfterKeyboard();
        restoreTimer = undefined;
      }, 220);
    }
  });

  document.addEventListener("focusout", event => {
    if (!isTextField(event.target)) return;
    // If the keyboard was dismissed without a viewport resize, release
    // the saved position without forcing any scroll.
    window.setTimeout(() => {
      if (!keyboardOpen &&
          !(document.activeElement instanceof HTMLInputElement) &&
          !(document.activeElement instanceof HTMLTextAreaElement)) {
        hasSavedPosition = false;
      }
    }, 300);
  }, true);
}

if (typeof window !== "undefined") installKeyboardScrollRestore();

export function scrollFocusedInputIntoView(_element: HTMLElement, _revealThrough?: HTMLElement | null) {
  if (typeof window === "undefined") return;
  installKeyboardScrollRestore();
}

let keyboardScrollRestoreInstalled = false;

function installKeyboardScrollRestore() {
  if (keyboardScrollRestoreInstalled || typeof window === "undefined") return;
  keyboardScrollRestoreInstalled = true;

  const viewport = window.visualViewport;
  if (!viewport) return;

  let keyboardOpen = window.innerHeight - viewport.height > 120;
  let focusedInput: Element | null = null;
  let savedWindowY = window.scrollY;
  let savedDocumentY = document.scrollingElement?.scrollTop ?? 0;
  let userMovedPage = false;
  let touchStartY = 0;
  let restoreTimer: number | undefined;

  const isTextField = (target: EventTarget | null): target is HTMLInputElement | HTMLTextAreaElement =>
    target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;

  document.addEventListener("focusin", event => {
    if (!isTextField(event.target)) return;
    focusedInput = event.target;
    // Capture before the browser adjusts the page for the on-screen keyboard.
    savedWindowY = window.scrollY;
    savedDocumentY = document.scrollingElement?.scrollTop ?? savedWindowY;
    userMovedPage = false;
  }, true);

  document.addEventListener("touchstart", event => {
    touchStartY = event.touches[0]?.clientY ?? 0;
  }, { passive: true, capture: true });

  document.addEventListener("touchmove", event => {
    const y = event.touches[0]?.clientY ?? touchStartY;
    if (keyboardOpen && Math.abs(y - touchStartY) > 8) userMovedPage = true;
  }, { passive: true, capture: true });

  const restorePosition = () => {
    if (userMovedPage) return;
    window.scrollTo({ top: savedWindowY, left: 0, behavior: "instant" });
    const scroller = document.scrollingElement;
    if (scroller) scroller.scrollTop = savedDocumentY;
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
      // Restore only after the keyboard animation has finished. Do not
      // interfere with scrolling while the keyboard is visible.
      requestAnimationFrame(() => {
        restorePosition();
        requestAnimationFrame(restorePosition);
      });
      restoreTimer = window.setTimeout(() => {
        restorePosition();
        restoreTimer = undefined;
        focusedInput = null;
      }, 180);
    }
  });

  document.addEventListener("focusout", event => {
    if (!isTextField(event.target)) return;
    // Keep the saved position until visualViewport confirms keyboard closure.
    if (!keyboardOpen) {
      window.setTimeout(() => {
        if (!keyboardOpen && !(document.activeElement instanceof HTMLInputElement) && !(document.activeElement instanceof HTMLTextAreaElement)) {
          restorePosition();
          focusedInput = null;
        }
      }, 220);
    }
  }, true);
}

if (typeof window !== "undefined") installKeyboardScrollRestore();

export function scrollFocusedInputIntoView(_element: HTMLElement, _revealThrough?: HTMLElement | null) {
  if (typeof window === "undefined") return;
  installKeyboardScrollRestore();
}

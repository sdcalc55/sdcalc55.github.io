let keyboardScrollGuardInstalled = false;

function installKeyboardScrollGuard() {
  if (keyboardScrollGuardInstalled || typeof window === "undefined") return;
  keyboardScrollGuardInstalled = true;

  const viewport = window.visualViewport;
  if (!viewport) return;

  let keyboardOpen = window.innerHeight - viewport.height > 120;
  let savedScrollY = window.scrollY;
  let pendingInputFocus = false;
  let restoringScroll = false;
  let restoreTimer: number | undefined;

  const restoreScroll = () => {
    if (Math.abs(window.scrollY - savedScrollY) < 2) return;
    restoringScroll = true;
    window.scrollTo({ top: savedScrollY, left: 0, behavior: "instant" });
    requestAnimationFrame(() => { restoringScroll = false; });
  };

  // Capture the page position before the browser focuses an input and
  // automatically scrolls it into view to make room for the keyboard.
  document.addEventListener("pointerdown", event => {
    if (!(event.target instanceof Element) || !event.target.closest("input, textarea")) return;
    savedScrollY = window.scrollY;
    pendingInputFocus = true;
  }, true);

  document.addEventListener("focusin", event => {
    if (!(event.target instanceof Element) || !event.target.matches("input, textarea")) return;
    if (!pendingInputFocus) savedScrollY = window.scrollY;
    pendingInputFocus = true;
  }, true);

  window.addEventListener("scroll", () => {
    // Android Chrome may scroll the document before visualViewport emits resize.
    if ((!pendingInputFocus && !keyboardOpen) || restoringScroll) return;
    restoreScroll();
  }, { passive: true });

  viewport.addEventListener("resize", () => {
    const nextKeyboardOpen = window.innerHeight - viewport.height > 120;

    if (nextKeyboardOpen) {
      keyboardOpen = true;
      restoreScroll();
      return;
    }

    if (keyboardOpen) {
      keyboardOpen = false;
      restoreScroll();
      if (restoreTimer !== undefined) window.clearTimeout(restoreTimer);
      requestAnimationFrame(() => {
        restoreScroll();
        requestAnimationFrame(restoreScroll);
      });
      // Some Android WebViews apply a final delayed scroll correction.
      restoreTimer = window.setTimeout(() => {
        restoreScroll();
        pendingInputFocus = false;
        restoreTimer = undefined;
      }, 250);
    }
  });

  document.addEventListener("focusout", () => {
    // Keep the guard active until the keyboard has finished closing.
    if (restoreTimer !== undefined) return;
    if (!keyboardOpen) {
      window.setTimeout(() => {
        if (!keyboardOpen && !(document.activeElement instanceof HTMLInputElement) && !(document.activeElement instanceof HTMLTextAreaElement)) {
          pendingInputFocus = false;
        }
      }, 300);
    }
  }, true);
}

// Install as soon as the client module is loaded, not on the first focus event.
// This ensures pointerdown is captured before the browser's automatic scroll.
if (typeof window !== "undefined") installKeyboardScrollGuard();

export function scrollFocusedInputIntoView(_element: HTMLElement, _revealThrough?: HTMLElement | null) {
  if (typeof window === "undefined") return;
  installKeyboardScrollGuard();
}

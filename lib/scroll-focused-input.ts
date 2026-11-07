let keyboardScrollGuardInstalled = false;

function installKeyboardScrollGuard() {
  if (keyboardScrollGuardInstalled || typeof window === "undefined") return;
  keyboardScrollGuardInstalled = true;

  const viewport = window.visualViewport;
  if (!viewport) return;

  let keyboardOpen = window.innerHeight - viewport.height > 120;
  let savedScrollY = window.scrollY;
  let hasPreFocusPosition = false;
  let restoringScroll = false;

  // Capture the page position before the browser moves the focused field
  // to make room for the on-screen keyboard.
  document.addEventListener("pointerdown", event => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      savedScrollY = window.scrollY;
      hasPreFocusPosition = true;
    }
  }, true);

  window.addEventListener("scroll", () => {
    if (!keyboardOpen || restoringScroll || Math.abs(window.scrollY - savedScrollY) < 2) return;
    restoringScroll = true;
    window.scrollTo({ top: savedScrollY, left: 0, behavior: "instant" });
    requestAnimationFrame(() => { restoringScroll = false; });
  }, { passive: true });

  viewport.addEventListener("resize", () => {
    const nextKeyboardOpen = window.innerHeight - viewport.height > 120;

    if (nextKeyboardOpen && !keyboardOpen) {
      // Use the position captured before focus; fall back for programmatic focus.
      if (!hasPreFocusPosition) savedScrollY = window.scrollY;
      keyboardOpen = true;
      return;
    }

    if (!nextKeyboardOpen && keyboardOpen) {
      keyboardOpen = false;
      hasPreFocusPosition = false;
      const restoreScroll = () => window.scrollTo({ top: savedScrollY, left: 0, behavior: "instant" });
      requestAnimationFrame(() => {
        restoreScroll();
        requestAnimationFrame(restoreScroll);
      });
      // Android WebViews can apply a delayed scroll correction after resize.
      window.setTimeout(restoreScroll, 100);
    }
  });
}

export function scrollFocusedInputIntoView(_element: HTMLElement, _revealThrough?: HTMLElement | null) {
  if (typeof window === "undefined") return;
  // Keep the document stationary while the on-screen keyboard opens and closes.
  // The keyboard itself is dismissed by the input's blur/Done action.
  installKeyboardScrollGuard();
}

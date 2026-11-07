let keyboardScrollGuardInstalled = false;

function installKeyboardScrollGuard() {
  if (keyboardScrollGuardInstalled || typeof window === "undefined") return;
  keyboardScrollGuardInstalled = true;

  const viewport = window.visualViewport;
  if (!viewport) return;

  let keyboardOpen = window.innerHeight - viewport.height > 120;
  let savedScrollY = window.scrollY;

  viewport.addEventListener("resize", () => {
    const nextKeyboardOpen = window.innerHeight - viewport.height > 120;

    if (nextKeyboardOpen && !keyboardOpen) {
      // Remember the page position from before the keyboard changes the viewport.
      savedScrollY = window.scrollY;
      keyboardOpen = true;
      return;
    }

    if (!nextKeyboardOpen && keyboardOpen) {
      keyboardOpen = false;
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

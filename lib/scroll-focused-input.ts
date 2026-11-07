let keyboardScrollGuardInstalled = false;

function installKeyboardScrollGuard() {
  if (keyboardScrollGuardInstalled || typeof window === "undefined") return;
  keyboardScrollGuardInstalled = true;

  const viewport = window.visualViewport;
  if (!viewport) return;

  let keyboardOpen = window.innerHeight - viewport.height > 120;
  let savedScrollY = window.scrollY;
  let userScrolled = false;
  let touchStartY = 0;
  let restoreTimer: number | undefined;

  // Remember the page position before an input receives focus.
  document.addEventListener("pointerdown", event => {
    if (!(event.target instanceof Element) || !event.target.closest("input, textarea")) return;
    savedScrollY = window.scrollY;
    userScrolled = false;
  }, true);

  // A deliberate swipe while the keyboard is open must remain possible.
  document.addEventListener("touchstart", event => {
    touchStartY = event.touches[0]?.clientY ?? 0;
  }, { passive: true, capture: true });

  document.addEventListener("touchmove", event => {
    const currentY = event.touches[0]?.clientY ?? touchStartY;
    if (keyboardOpen && Math.abs(currentY - touchStartY) > 8) userScrolled = true;
  }, { passive: true, capture: true });

  viewport.addEventListener("resize", () => {
    const nextKeyboardOpen = window.innerHeight - viewport.height > 120;

    if (nextKeyboardOpen && !keyboardOpen) {
      keyboardOpen = true;
      return;
    }

    if (!nextKeyboardOpen && keyboardOpen) {
      keyboardOpen = false;
      if (restoreTimer !== undefined) window.clearTimeout(restoreTimer);

      // Correct only small browser-induced shifts. If the user deliberately
      // scrolled while the keyboard was open, preserve their chosen position.
      const restoreIfUnchanged = () => {
        if (!userScrolled && Math.abs(window.scrollY - savedScrollY) <= 100) {
          window.scrollTo({ top: savedScrollY, left: 0, behavior: "instant" });
        }
      };

      requestAnimationFrame(() => {
        restoreIfUnchanged();
        requestAnimationFrame(restoreIfUnchanged);
      });
      restoreTimer = window.setTimeout(() => {
        restoreIfUnchanged();
        restoreTimer = undefined;
      }, 250);
    }
  });
}

if (typeof window !== "undefined") installKeyboardScrollGuard();

export function scrollFocusedInputIntoView(_element: HTMLElement, _revealThrough?: HTMLElement | null) {
  if (typeof window === "undefined") return;
  installKeyboardScrollGuard();
}

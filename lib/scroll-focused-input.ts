// Keep the focused field and the next input visible while the mobile keyboard opens.
// Once the keyboard is closed, stop immediately and preserve the user's current scroll position.
export function scrollFocusedInputIntoView(element: HTMLElement, revealThrough?: HTMLElement | null) {
  if (!window.matchMedia("(max-width: 768px)").matches) return;

  const viewport = window.visualViewport;
  const initialHeight = window.innerHeight;
  const findNextInput = () => {
    const scope = element.closest("section, form") ?? element.parentElement;
    if (!scope) return element;
    const inputs = Array.from(scope.querySelectorAll<HTMLElement>('input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled])'))
      .filter(input => input.getClientRects().length > 0);
    const index = inputs.indexOf(element);
    return index >= 0 && inputs[index + 1] ? inputs[index + 1] : element;
  };

  const target = revealThrough ?? findNextInput();
  let active = true;
  let keyboardOpened = false;
  let cleanupTimer: number | undefined;
  let frame = 0;

  const cleanup = () => {
    if (!active) return;
    active = false;
    cancelAnimationFrame(frame);
    viewport?.removeEventListener("resize", onViewportResize);
    window.removeEventListener("resize", onWindowResize);
    if (cleanupTimer !== undefined) window.clearTimeout(cleanupTimer);
  };

  const reveal = () => {
    if (!active) return;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      if (!active) return;
      const rect = target.getBoundingClientRect();
      const visibleTop = viewport?.offsetTop ?? 0;
      const visibleBottom = viewport ? viewport.offsetTop + viewport.height : window.innerHeight;
      const bottomGap = 84;
      const topGap = 16;
      const overflowBottom = rect.bottom - (visibleBottom - bottomGap);
      const overflowTop = visibleTop + topGap - rect.top;

      if (overflowBottom > 0) {
        window.scrollBy({ top: overflowBottom, left: 0, behavior: "auto" });
      } else if (overflowTop > 0) {
        window.scrollBy({ top: -overflowTop, left: 0, behavior: "auto" });
      }
    });
  };

  const checkKeyboardState = () => {
    const currentHeight = viewport?.height ?? window.innerHeight;
    if (currentHeight < initialHeight - 120) keyboardOpened = true;
    // A growing viewport means the keyboard is closing. Do not scroll or restore anything.
    if (keyboardOpened && currentHeight > initialHeight - 80) {
      cleanup();
      return false;
    }
    return true;
  };

  function onViewportResize() {
    if (!checkKeyboardState()) return;
    reveal();
  }

  function onWindowResize() {
    if (!checkKeyboardState()) return;
    reveal();
  }

  reveal();
  viewport?.addEventListener("resize", onViewportResize, { passive: true });
  window.addEventListener("resize", onWindowResize, { passive: true });
  // Only follow the keyboard's opening animation; never fight the user's manual scrolling.
  cleanupTimer = window.setTimeout(cleanup, 1800);
}

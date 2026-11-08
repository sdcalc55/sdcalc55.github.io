// Keep the focused field and the next input visible while the mobile keyboard opens.
// Never move the page while the keyboard is closing or after the user starts scrolling.
export function scrollFocusedInputIntoView(element: HTMLElement, revealThrough?: HTMLElement | null) {
  if (!window.matchMedia("(max-width: 768px)").matches) return;

  const viewport = window.visualViewport;
  const initialHeight = viewport?.height ?? window.innerHeight;
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
  let lastViewportHeight = initialHeight;
  let cleanupTimer: number | undefined;
  let frame = 0;

  const cleanup = () => {
    if (!active) return;
    active = false;
    cancelAnimationFrame(frame);
    viewport?.removeEventListener("resize", onViewportResize);
    window.removeEventListener("resize", onWindowResize);
    document.removeEventListener("touchstart", onUserInteraction, true);
    document.removeEventListener("wheel", onUserInteraction, true);
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

  const handleViewportChange = () => {
    if (!active) return;
    const currentHeight = viewport?.height ?? window.innerHeight;

    if (currentHeight < initialHeight - 120) keyboardOpened = true;

    // The first viewport growth marks keyboard dismissal. Stop before any corrective scroll.
    if (keyboardOpened && currentHeight > lastViewportHeight + 2) {
      cleanup();
      return;
    }

    lastViewportHeight = currentHeight;
    if (keyboardOpened) reveal();
  };

  function onViewportResize() {
    handleViewportChange();
  }

  function onWindowResize() {
    handleViewportChange();
  }

  function onUserInteraction() {
    // Once the user touches or scrolls the page with the keyboard open, their position wins.
    if (keyboardOpened) cleanup();
  }

  reveal();
  viewport?.addEventListener("resize", onViewportResize, { passive: true });
  window.addEventListener("resize", onWindowResize, { passive: true });
  document.addEventListener("touchstart", onUserInteraction, { passive: true, capture: true });
  document.addEventListener("wheel", onUserInteraction, { passive: true, capture: true });
  // Follow only the keyboard-opening animation; never restore or adjust scroll on dismissal.
  cleanupTimer = window.setTimeout(cleanup, 1800);
}
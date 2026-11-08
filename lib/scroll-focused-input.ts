// Keep the focused field clear of the Android keyboard and its autofill toolbar.
// A related next field may be revealed when a multi-field calculator is used.
export function scrollFocusedInputIntoView(element: HTMLElement, revealThrough?: HTMLElement | null) {
  const viewport = window.visualViewport;
  const target = revealThrough ?? element;
  let active = true;
  let cleanupTimer: number | undefined;

  const reveal = () => {
    if (!active) return;
    requestAnimationFrame(() => {
      if (!active) return;
      const rect = target.getBoundingClientRect();
      const visibleTop = viewport?.offsetTop ?? 0;
      const visibleBottom = viewport ? viewport.offsetTop + viewport.height : window.innerHeight;
      // Leave extra room for the suggestion/autofill strip above the keyboard.
      const bottomGap = 76;
      const topGap = 16;
      const overflowBottom = rect.bottom - (visibleBottom - bottomGap);
      const overflowTop = visibleTop + topGap - rect.top;
      if (overflowBottom > 0) {
        window.scrollBy({ top: overflowBottom, left: 0, behavior: "smooth" });
      } else if (overflowTop > 0) {
        window.scrollBy({ top: -overflowTop, left: 0, behavior: "smooth" });
      }
    });
  };

  const cleanup = () => {
    if (!active) return;
    active = false;
    viewport?.removeEventListener("resize", reveal);
    viewport?.removeEventListener("scroll", reveal);
    window.removeEventListener("resize", reveal);
    if (cleanupTimer !== undefined) window.clearTimeout(cleanupTimer);
  };

  reveal();
  viewport?.addEventListener("resize", reveal, { passive: true });
  viewport?.addEventListener("scroll", reveal, { passive: true });
  window.addEventListener("resize", reveal, { passive: true });
  cleanupTimer = window.setTimeout(cleanup, 1400);
}
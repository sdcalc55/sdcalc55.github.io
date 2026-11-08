// Keep the focused field and the next input visible above the Android keyboard.
// This is shared by all calculator forms so the keyboard never hides the next field.
export function scrollFocusedInputIntoView(element: HTMLElement, revealThrough?: HTMLElement | null) {
  if (!window.matchMedia("(max-width: 768px)").matches) return;

  const viewport = window.visualViewport;
  const findNextInput = () => {
    const scope = element.closest("section, form") ?? element.parentElement;
    if (!scope) return element;
    const inputs = Array.from(scope.querySelectorAll<HTMLElement>('input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled])'))
      .filter(input => input.getClientRects().length > 0);
    const index = inputs.indexOf(element);
    return index >= 0 && inputs[index + 1] ? inputs[index + 1] : element;
  };

  // Explicit targets remain supported; otherwise reveal the next field in this calculator.
  const target = revealThrough ?? findNextInput();
  let active = true;
  let cleanupTimer: number | undefined;
  let frame = 0;

  const reveal = () => {
    if (!active) return;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      if (!active) return;
      const rect = target.getBoundingClientRect();
      const visibleTop = viewport?.offsetTop ?? 0;
      const visibleBottom = viewport ? viewport.offsetTop + viewport.height : window.innerHeight;
      // Reserve space for the keyboard's suggestion/autofill toolbar.
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

  const cleanup = () => {
    if (!active) return;
    active = false;
    cancelAnimationFrame(frame);
    viewport?.removeEventListener("resize", reveal);
    viewport?.removeEventListener("scroll", reveal);
    window.removeEventListener("resize", reveal);
    if (cleanupTimer !== undefined) window.clearTimeout(cleanupTimer);
  };

  reveal();
  viewport?.addEventListener("resize", reveal, { passive: true });
  viewport?.addEventListener("scroll", reveal, { passive: true });
  window.addEventListener("resize", reveal, { passive: true });
  // Keep reacting while the keyboard animates and while the user edits the value.
  cleanupTimer = window.setTimeout(cleanup, 3000);
}

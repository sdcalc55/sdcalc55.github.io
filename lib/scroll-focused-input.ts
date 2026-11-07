// Only reveal an explicitly requested related field when the mobile keyboard opens.
// Do not restore scroll when the keyboard closes.
export function scrollFocusedInputIntoView(_element: HTMLElement, revealThrough?: HTMLElement | null) {
  if (!revealThrough) return;

  const viewport = window.visualViewport;
  if (!viewport) return;

  let handled = false;
  const reveal = () => {
    if (handled || viewport.height >= window.screen.height * 0.75) return;
    handled = true;
    viewport.removeEventListener("resize", reveal);
    requestAnimationFrame(() => {
      const rect = revealThrough.getBoundingClientRect();
      const visibleBottom = viewport.offsetTop + viewport.height;
      const overflow = rect.bottom - (visibleBottom - 20);
      if (overflow > 0) {
        window.scrollBy({ top: overflow, left: 0, behavior: "smooth" });
      }
    });
  };

  reveal();
  if (!handled) viewport.addEventListener("resize", reveal, { passive: true });
}

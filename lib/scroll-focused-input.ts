// Keep this helper intentionally passive. Android Chrome manages the
// visual viewport and focused-field visibility; forced scroll restoration
// causes the page to jump when the keyboard opens or closes.
export function scrollFocusedInputIntoView(_element: HTMLElement, _revealThrough?: HTMLElement | null) {
  // No programmatic scrolling.
}

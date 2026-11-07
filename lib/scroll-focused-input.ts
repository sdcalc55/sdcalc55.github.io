export function scrollFocusedInputIntoView(_element: HTMLElement, _revealThrough?: HTMLElement | null) {
  // Let Android/browser manage the visual viewport naturally.
  // Programmatic scroll restoration here can jump to the document origin
  // when the page is hosted inside a nested scrolling container.
}

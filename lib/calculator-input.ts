export function focusNextCalculatorInput(current: HTMLInputElement) {
  const scope = current.closest("form") ?? current.closest("section") ?? current.closest("main") ?? document;
  if (!scope) { current.blur(); return; }
  const fields = Array.from(scope.querySelectorAll<HTMLInputElement>('input:not([disabled]):not([type="hidden"])'))
    .filter(field => field.getClientRects().length > 0);
  const index = fields.indexOf(current);
  const next = fields[index + 1];
  if (next) {
    next.focus();
    next.scrollIntoView({ block: "center", behavior: "smooth" });
  } else {
    current.blur();
  }
}

export function focusFirstInvalid(container: ParentNode) {
  const field = container.querySelector<HTMLInputElement>('input[aria-invalid="true"], input:invalid');
  if (!field) return false;
  field.focus();
  field.scrollIntoView({ block: "center", behavior: "smooth" });
  return true;
}

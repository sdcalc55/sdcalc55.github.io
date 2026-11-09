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


/** Backspace adjacent to a thousands separator removes the previous digit, not the separator. */
export function handleFormattedBackspace(
  event: React.KeyboardEvent<HTMLInputElement>,
  onChange: (value: string) => void,
  storeFormatted = true,
) {
  if (event.key !== "Backspace") return false;
  const input = event.currentTarget;
  const start = input.selectionStart;
  const end = input.selectionEnd;
  if (start === null || end === null || start !== end || start === 0) return false;
  if (!/[ \u00a0\u202f]/.test(input.value[start - 1])) return false;

  event.preventDefault();
  let digitIndex = start - 1;
  while (digitIndex >= 0 && !/\d/.test(input.value[digitIndex])) digitIndex--;
  if (digitIndex < 0) return true;

  const digitsBefore = input.value.slice(0, digitIndex).replace(/\D/g, "").length;
  const raw = input.value.replace(/[ \u00a0\u202f]/g, "");
  let rawDigitIndex = 0;
  for (let i = 0; i < digitIndex; i++) if (/\d/.test(input.value[i])) rawDigitIndex++;
  const nextRaw = raw.slice(0, rawDigitIndex) + raw.slice(rawDigitIndex + 1);
  const formatted = nextRaw.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  onChange(storeFormatted ? formatted : nextRaw);
  requestAnimationFrame(() => {
    let caret = 0, seen = 0;
    while (caret < formatted.length && seen < digitsBefore) {
      if (/\d/.test(formatted[caret])) seen++;
      caret++;
    }
    input.setSelectionRange(caret, caret);
  });
  return true;
}

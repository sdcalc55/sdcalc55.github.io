export function sanitizeDecimalInput(value: string): string {
  return value.replace(/[^\d.,]/g, "").replace(/([.,].*)[.,]/g, "$1");
}

export function sanitizeIntegerInput(value: string, maxLength: number): string {
  return value.replace(/[^\d]/g, "").slice(0, maxLength);
}

/** Maps a caret offset measured in an unformatted value to its formatted display position. */
export function getFormattedCaretPosition(formatted: string, rawCaret: number): number {
  let visibleCharacters = 0;
  for (let index = 0; index < formatted.length; index += 1) {
    if (!/[ \\u00a0\\u202f]/.test(formatted[index])) visibleCharacters += 1;
    if (visibleCharacters >= rawCaret) return index + 1;
  }
  return formatted.length;
}

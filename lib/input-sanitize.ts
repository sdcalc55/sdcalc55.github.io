export function sanitizeDecimalInput(value: string): string {
  return value.replace(/[^\d.,]/g, "").replace(/([.,].*)[.,]/g, "$1");
}

export function sanitizeIntegerInput(value: string, maxLength: number): string {
  return value.replace(/[^\d]/g, "").slice(0, maxLength);
}

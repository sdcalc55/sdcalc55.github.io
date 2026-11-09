export type NumericInputRules = {
  maxIntegerDigits?: number;
  maxFractionDigits?: number;
  maxValue?: number;
};

/**
 * Strictly normalizes a numeric field. Invalid characters are rejected as a
 * whole input instead of being silently stripped (e.g. "-100" must never
 * become the valid-looking positive value "100").
 */
export function normalizeNumericInput(raw: string, rules: NumericInputRules = {}): string | null {
  if (typeof raw !== "string" || !/^[\d\s\u00a0\u202f.,]*$/.test(raw)) return null;
  const compact = raw.replace(/[\s\u00a0\u202f]/g, "");
  if ((compact.match(/[.,]/g) ?? []).length > 1) return null;
  const separatorNormalized = compact.replace(",", ".");
  const normalized = separatorNormalized.startsWith(".") ? `0${separatorNormalized}` : separatorNormalized;
  const [integer = "", fraction] = normalized.split(".");
  const integerDigits = integer.replace(/^0+(?=\d)/, "");
  if (rules.maxIntegerDigits !== undefined && integerDigits.length > rules.maxIntegerDigits) return null;
  if (fraction !== undefined && rules.maxFractionDigits !== undefined && fraction.length > rules.maxFractionDigits) return null;
  if (rules.maxValue !== undefined && normalized !== "" && normalized !== "." && Number(normalized) > rules.maxValue) return null;
  return normalized === "." ? "0." : normalized;
}

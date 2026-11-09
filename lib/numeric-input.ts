export type NumericInputRules = {
  maxIntegerDigits?: number;
  maxFractionDigits?: number;
  maxValue?: number;
  strictGrouping?: boolean;
};

/**
 * Strictly normalizes a numeric field. Invalid characters are rejected as a
 * whole input instead of being silently stripped (e.g. "-100" must never
 * become the valid-looking positive value "100").
 */
export function normalizeNumericInput(raw: string, rules: NumericInputRules = {}): string | null {
  if (typeof raw !== "string" || raw.length > 128 || !/^[\d\s\u00a0\u202f.,]*$/.test(raw)) return null;
  if ((raw.match(/[.,]/g) ?? []).length > 1) return null;

  const separatorIndex = raw.search(/[.,]/);
  const integerPart = separatorIndex < 0 ? raw : raw.slice(0, separatorIndex);
  const fractionPart = separatorIndex < 0 ? "" : raw.slice(separatorIndex + 1);
  const groupingSpaces = /[\s\u00a0\u202f]/;
  if (groupingSpaces.test(fractionPart)) return null;

  if (rules.strictGrouping !== false && groupingSpaces.test(integerPart)) {
    const groups = integerPart.split(/[\s\u00a0\u202f]/);
    if (!/^\d{1,3}$/.test(groups[0]) || groups.slice(1).some(group => !/^\d{3}$/.test(group))) return null;
  }

  const compact = raw.replace(/[\s\u00a0\u202f]/g, "");
  const separatorNormalized = compact.replace(",", ".");
  const normalized = separatorNormalized.startsWith(".") ? "0" + separatorNormalized : separatorNormalized;
  const [integer = "", fraction] = normalized.split(".");
  const integerDigits = integer.replace(/^0+(?=\d)/, "");
  if (rules.maxIntegerDigits !== undefined && integerDigits.length > rules.maxIntegerDigits) return null;
  if (fraction !== undefined && rules.maxFractionDigits !== undefined && fraction.length > rules.maxFractionDigits) return null;
  if (rules.maxValue !== undefined && normalized !== "" && normalized !== "." && Number(normalized) > rules.maxValue) return null;
  return normalized;
}

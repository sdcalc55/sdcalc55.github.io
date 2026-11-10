const plural = (value: number, one: string, few: string, many: string) => {
  const mod = Math.abs(value) % 10;
  const last = Math.abs(value) % 100;
  return last >= 11 && last <= 14 ? many : mod === 1 ? one : mod >= 2 && mod <= 4 ? few : many;
};

/** One canonical term formatter shared by calculator results, history and copy. */
export function formatLoanTerm(months: number): string {
  if (!Number.isSafeInteger(months) || months <= 0) return "";
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  const parts = [
    years ? `${years} ${plural(years, "год", "года", "лет")}` : "",
    remainingMonths ? `${remainingMonths} ${plural(remainingMonths, "месяц", "месяца", "месяцев")}` : "",
  ].filter(Boolean);
  const term = parts.join(" ");
  return years && remainingMonths ? `${term} (${months} мес.)` : term;
}

/** Cleans malformed legacy strings before showing or copying a saved term. */
export function normalizeLoanTerm(value: string, unit: "years" | "months" = "months"): string {
  const input = value.trim();
  if (!input) return "";
  if (/^\d+$/.test(input)) {
    const count = Number(input);
    if (!Number.isSafeInteger(count) || count <= 0) return input;
    return unit === "years"
      ? `${count} ${plural(count, "год", "года", "лет")}`
      : formatLoanTerm(count);
  }
  return input
    .replace(/(\(\d+\s*мес\.\))\s+(?:месяц|месяца|месяцев)\s*$/i, "$1")
    .replace(/(\d+\s+(?:год|года|лет))(?:\s+0\s+месяцев)?\s+месяцев$/i, "$1")
    .replace(/(\d+\s+(?:год|года|лет))\s+0\s+месяцев$/i, "$1")
    .replace(/\s{2,}/g, " ");
}

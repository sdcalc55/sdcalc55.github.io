export type MortgageMode = "part" | "whole" | "adjustment";
export type MortgageResult = { status: "empty" } | { status: "sufficient"; clientPercent: number } | { status: "error"; message: string } | {
  status: "ok"; total: number; formula: string; clientPercent?: number; missingPercent?: number;
};
type Fraction = { n: bigint; d: bigint };
const multiply = (a: Fraction, b: Fraction): Fraction => ({ n: a.n * b.n, d: a.d * b.d });
const add = (a: Fraction, b: Fraction): Fraction => ({ n: a.n * b.d + b.n * a.d, d: a.d * b.d });
const negate = (a: Fraction): Fraction => ({ n: -a.n, d: a.d });
const divide = (a: Fraction, b: Fraction): Fraction => ({ n: a.n * b.d, d: a.d * b.n });
const hundred: Fraction = { n: BigInt(100), d: BigInt(1) };
const format = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 6 });
function parse(value: string): Fraction | null {
  const normalized = value.replace(/\s/g, "").replace(",", ".");
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized) || !Number.isFinite(Number(normalized))) return null;
  const negative = normalized.startsWith("-");
  const [whole, decimal = ""] = normalized.replace(/^[+-]/, "").split(".");
  // Bound input length to avoid excessive big-integer work for malformed pasted data.
  if ((whole + decimal).length > 100) return null;
  return { n: BigInt((whole || "0") + decimal) * BigInt(negative ? -1 : 1), d: BigInt(10) ** BigInt(decimal.length) };
}
const numeric = (v: Fraction) => Number(v.n) / Number(v.d);
function ceil(v: Fraction): number {
  const n = v.d < BigInt(0) ? -v.n : v.n;
  const d = v.d < BigInt(0) ? -v.d : v.d;
  return Number(n / d + (n > BigInt(0) && n % d !== BigInt(0) ? BigInt(1) : BigInt(0)));
}
/** Formulas and rounding transferred from sd-real-estate-1.8.apk. No intermediate rounding. */
export function calculateMortgage(mode: MortgageMode, values: string[], allowLargeAmount = false): MortgageResult {
  const required = mode === "adjustment" ? 3 : 2;
  const inputs = Array.from({ length: required }, (_, i) => values[i] ?? "");
  if (inputs.some(value => !value.trim() || ["-", "+", ".", "-.", "+."].includes(value.trim()))) return { status: "empty" };
  const parsed = inputs.map(parse);
  if (parsed.some(v => v === null)) return { status: "error", message: "Введите число, используя запятую или точку для дробной части." };
  const [amount, second, third] = parsed as Fraction[];
  const maxMoney = BigInt(999999999);
  if ((!allowLargeAmount && amount.n > amount.d * maxMoney) || (mode === "adjustment" && second.n > second.d * maxMoney)) return { status: "error", message: "Введите корректную сумму. Максимум — 999 999 999 ₽." };
  let result: Fraction;
  let formula: string;
  let clientPercent: number | undefined;
  let missingPercent: number | undefined;
  if (mode === "adjustment") {
    if (amount.n <= BigInt(0)) return { status: "error", message: "Стоимость объекта должна быть больше нуля." };
    if (second.n < BigInt(0)) return { status: "error", message: "Сумма первоначального взноса не может быть отрицательной." };
    if (second.n * amount.d > amount.n * second.d) return { status: "error", message: "Первоначальный взнос не может быть больше стоимости объекта." };
    if (third.n <= BigInt(0) || third.n > third.d * BigInt(100)) return { status: "error", message: "Необходимый первоначальный взнос должен быть больше 0 и не превышать 100%." };
    const client = multiply(divide(second, amount), hundred);
    const missing = add(third, negate(client));
    if (missing.n <= BigInt(0)) {
      const clientPercent = numeric(client);
      if (!Number.isFinite(clientPercent)) return { status: "error", message: "Результат слишком большой. Уменьшите значения." };
      return { status: "sufficient", clientPercent };
    }
    const denominator = add(hundred, negate(missing));
    if (denominator.n <= BigInt(0)) return { status: "error", message: "Расчёт невозможен: 100 − недостающий процент взноса должно быть больше нуля." };
    result = divide(multiply(amount, hundred), denominator);
    clientPercent = numeric(client);
    missingPercent = numeric(missing);
    formula = `${format.format(numeric(amount))} × 100 ÷ (100 − ${format.format(missingPercent)})`;
  } else if (mode === "part") {
    if (amount.n < BigInt(0)) return { status: "error", message: "Стоимость объекта не может быть отрицательной." };
    if (second.n < BigInt(0) || second.n > second.d * BigInt(100)) return { status: "error", message: "Первоначальный взнос должен быть от 0 до 100%." };
    result = divide(multiply(amount, second), hundred);
    formula = `${format.format(numeric(amount))} × ${format.format(numeric(second))} ÷ 100`;
  } else {
    if (amount.n < BigInt(0)) return { status: "error", message: "Сумма первоначального взноса не может быть отрицательной." };
    if (second.n < BigInt(0) || second.n > second.d * BigInt(100)) return { status: "error", message: "Первоначальный взнос должен быть от 0 до 100%." };
    if (second.n === BigInt(0)) return { status: "error", message: "Процент не может быть равен нулю. Укажите другое значение." };
    result = divide(multiply(amount, hundred), second);
    formula = `${format.format(numeric(amount))} × 100 ÷ ${format.format(numeric(second))}`;
  }
  const total = ceil(result);
  if (!Number.isSafeInteger(total) || [clientPercent, missingPercent].some(v => v !== undefined && !Number.isFinite(v))) return { status: "error", message: "Результат слишком большой. Уменьшите значения." };
  return { status: "ok", total: Object.is(total, -0) ? 0 : total, formula, clientPercent, missingPercent };
}

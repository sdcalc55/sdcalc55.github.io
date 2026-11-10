import type { TariffSnapshot } from "./tariffs";

export type Operation = "sale" | "purchase";
export type Category = "apartment" | "country" | "garage" | "commercial" | "land";
export type Calculation =
  | { status: "invalid" }
  | { status: "undefined" }
  | { status: "ok"; fixed: number; rate: number; base: number; percent: number; calculated: number; total: number; minimumApplied: boolean };

export function parseMoney(value: string): number | null {
  const normalized = value.replace(/[ \u00a0\u202f]/g, "").replace(",", ".");
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return null;
  const number = Number(normalized);
  return Number.isFinite(number) && number > 0 && number <= 999999999 ? number : null;
}

export function formatInput(value: string): string {
  const normalized = value.replace(/[ \u00a0\u202f]/g, "");
  if (!/^\d*(?:[.,]\d*)?$/.test(normalized)) return value;
  const [rawWhole, fraction] = normalized.split(/[.,]/);
  // Keep an all-zero value intact while the user is editing the leading digit.
  // This lets them delete the first digit of e.g. 2 000 000 and type a replacement.
  const whole = /^0+$/.test(rawWhole) ? rawWhole : rawWhole.replace(/^0+(?=\d)/, "");
  const separator = normalized.includes(",") ? "," : ".";
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ") + (fraction !== undefined ? separator + fraction : "");
}

export function calculate(operation: Operation, category: Category, price: number | null, credit: number | null = null, tariffs?: TariffSnapshot): Calculation {
  const valid = (v: number | null): v is number => v !== null && Number.isFinite(v) && v > 0 && v <= 999999999;
  if (!valid(price) || (operation !== "sale" && operation !== "purchase")) return { status: "invalid" };
  if (tariffs) {
    const rule = tariffs.rules.find(r => r.operation === operation && r.category === category && price >= r.from && (r.to === null || price <= r.to));
    if (!rule) return { status: "undefined" };
    if (category === "land" && !valid(credit)) return { status: "invalid" };
    const base = category === "land" ? price + credit! : price;
    const rate = rule.percent / 100;
    const percent = base * rate;
    const calculated = rule.fixed + percent;
    return { status: "ok", fixed: rule.fixed, rate, base, percent, calculated, total: Math.round(Math.max(rule.minimum, calculated) + Number.EPSILON * calculated), minimumApplied: rule.minimum > calculated };
  }
  let fixed = 0, rate = 0, base = price, minimum = 0;
  if (operation === "sale") {
    if (category === "apartment") { fixed = price < 1000000 ? 60000 : 50000; rate = price < 1000000 ? 0 : 0.015; }
    else if (category === "country") {
      if (price <= 499999) fixed = 55000;
      else if (price >= 500000 && price <= 999999) fixed = 70000;
      else if (price >= 1000000) { fixed = 55000; rate = 0.015; }
      else return { status: "undefined" };
    } else if (category === "garage") {
      if (price <= 499999) fixed = 30000;
      else if (price >= 500000) { fixed = 30000; rate = 0.015; }
      else return { status: "undefined" };
    } else if (category === "commercial") { fixed = 59000; rate = 0.025; }
    else return { status: "invalid" };
  } else {
    if (category === "apartment") { fixed = price < 1000000 ? 34000 : 24000; rate = price < 1000000 ? 0 : 0.01; }
    else if (category === "country") {
      if (price <= 499999) fixed = 40000;
      else if (price >= 500000 && price <= 999999) fixed = 50000;
      else if (price >= 1000000) { fixed = 35000; rate = 0.01; minimum = 60000; }
      else return { status: "undefined" };
    } else if (category === "garage") {
      if (price <= 499999) fixed = 27000;
      else if (price >= 500000) { fixed = 27000; rate = 0.01; }
      else return { status: "undefined" };
    } else if (category === "commercial") { rate = 0.015; }
    else if (category === "land") {
      if (!valid(credit)) return { status: "invalid" };
      fixed = 25000; rate = 0.01; base = price + credit;
    } else return { status: "invalid" };
  }
  const percent = base * rate;
  const calculated = fixed + percent;
  return { status: "ok", fixed, rate, base, percent, calculated, total: Math.round(Math.max(minimum, calculated) + Number.EPSILON * calculated), minimumApplied: minimum > calculated };
}

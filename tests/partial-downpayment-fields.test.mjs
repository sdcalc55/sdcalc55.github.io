import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");

test("partial down-payment money fields use the same ten-digit entry limit as other calculators", () => {
  const mortgage = read("../components/mortgage-calculators.tsx");
  assert.match(mortgage, /if \(digitsBeforeDecimal\.length > 10\) return;/);\n  assert.match(mortgage, /if \(money\) \{/);
  assert.doesNotMatch(mortgage, /id\.startsWith\("mortgage-adjustment-"\) \? 9 : 10/);
});

test("partial down-payment amount fields show the same playful billion-ruble warnings", () => {
  const mortgage = read("../components/mortgage-calculators.tsx");
  assert.match(mortgage, /Первоначальный взнос больше миллиарда\?/);
  assert.match(mortgage, /Объект дороже 999 999 999 рублей\?/);
  assert.match(mortgage, /Number\(value\.replace\(\/\[\\s\\u00a0\\u202f\]\/g, ""\)\) > 999999999/);
});

test("partial down-payment result is not capped at one billion rubles", () => {
  const calculation = read("../lib/mortgage.ts");
  assert.match(calculation, /const total = ceil\(result\);/);
  assert.match(calculation, /if \(!Number\.isSafeInteger\(total\)/);
  assert.doesNotMatch(calculation, /total\s*>\s*maxMoney|total\.n\s*>/);
});

test("mortgage money fields use shared decimal sanitization and retain focused/unfocused formatting", () => {
  const mortgage = read("../components/mortgage-calculators.tsx");
  assert.match(mortgage, /sanitizeDecimalInput\(event\.target\.value\)/);
  assert.match(mortgage, /onChange\(raw\);/);
  assert.match(mortgage, /onChange\(candidate\);/);
  assert.match(mortgage, /money && focused \? value\.replace/);
});

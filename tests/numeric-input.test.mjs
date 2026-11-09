import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { normalizeNumericInput } from "../lib/numeric-input.ts";

test("rejects hostile and malformed input instead of converting it into a different number", () => {
  for (const value of [
    "-100", "−100", "–100", "+100", "1e6", "1E6", "NaN", "Infinity",
    "100abc", "abc100", "1/2", "1;2", "1|2", "1,2.3", "1.2,3", "1,,2",
  ]) {
    assert.equal(normalizeNumericInput(value), null, value);
  }
});

test("accepts digits and one decimal separator, normalizing comma to dot", () => {
  assert.equal(normalizeNumericInput("12345"), "12345");
  assert.equal(normalizeNumericInput("12,34"), "12.34");
  assert.equal(normalizeNumericInput("12.34"), "12.34");
  assert.equal(normalizeNumericInput(".5"), "0.5");
  assert.equal(normalizeNumericInput(",5"), "0.5");
  assert.equal(normalizeNumericInput("12."), "12.");
  assert.equal(normalizeNumericInput(""), "");
});

test("accepts grouping spaces but removes them before calculation", () => {
  assert.equal(normalizeNumericInput("1 234 567"), "1234567");
  assert.equal(normalizeNumericInput("1\u00a0234\u202f567"), "1234567");
});

test("enforces integer and fractional digit limits without truncating the user's value", () => {
  assert.equal(normalizeNumericInput("999999999", { maxIntegerDigits: 9 }), "999999999");
  assert.equal(normalizeNumericInput("1000000000", { maxIntegerDigits: 9 }), null);
  assert.equal(normalizeNumericInput("30.00", { maxIntegerDigits: 2, maxFractionDigits: 2, maxValue: 30 }), "30.00");
  assert.equal(normalizeNumericInput("30.01", { maxIntegerDigits: 2, maxFractionDigits: 2, maxValue: 30 }), null);
  assert.equal(normalizeNumericInput("1.234", { maxFractionDigits: 2 }), null);
});

test("does not silently change a negative pasted amount into a positive amount", () => {
  const pasted = "-450000";
  const accepted = normalizeNumericInput(pasted, { maxIntegerDigits: 9 });
  assert.equal(accepted, null);
  assert.notEqual(accepted, "450000");
});

test("active early repayment input uses strict normalization and keeps clear/backspace controls", async () => {
  const source = await readFile(new URL("../components/realtor-mortgage-assistant.tsx", import.meta.url), "utf8");
  assert.match(source, /normalizeNumericInput\(event\.target\.value/);
  assert.match(source, /normalized === null/);
  assert.match(source, /handleFormattedBackspace\(event, onChange, false\)/);
  assert.match(source, /aria-label=\{`Очистить поле: \$\{label\}`}\s+title="Очистить"/);
  assert.doesNotMatch(source, /replace\(\/\[\^\\d\.,\]\/g,""\)/);
});

test("the deployed navigation mounts the updated calculator and does not reintroduce loan date or term fields", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const component = await readFile(new URL("../components/realtor-mortgage-assistant.tsx", import.meta.url), "utf8");
  assert.match(page, /import \{ RealtorMortgageAssistant \} from "@\/components\/realtor-mortgage-assistant"/);
  assert.match(page, /screen === "mortgage-tools" && <RealtorMortgageAssistant \/>/);
  assert.doesNotMatch(component, /Дата оформления кредита|Первоначальная сумма кредита|Срок кредита|startDate/);
  assert.match(component, /Подробности расчёта/);
  assert.match(component, /Рассчитывается базовый график погашения без досрочных взносов/);
  assert.match(component, /Результаты сравниваются с базовым графиком/);
  assert.doesNotMatch(component, /Регулярные взносы|Сравнение вариантов|Моя сумма/);
});


test("rejects malformed grouping, whitespace injection and oversized pasted values", () => {
  for (const value of [" 123", "123 ", "1 23", "12 34 567", "1 234 56", "1 234. 5", "1\\t234", "1\\n234", "1".repeat(129)]) {
    assert.equal(normalizeNumericInput(value, { maxIntegerDigits: 9 }), null, JSON.stringify(value));
  }
  assert.equal(normalizeNumericInput("999 999 999", { maxIntegerDigits: 9, maxValue: 999999999 }), "999999999");
  assert.equal(normalizeNumericInput("1 234 567,89", { maxIntegerDigits: 9, maxFractionDigits: 2 }), "1234567.89");
});

test("rejects numeric values that overflow finite JavaScript numbers", () => {
  assert.equal(normalizeNumericInput("9".repeat(128), { maxIntegerDigits: 9 }), null);
});

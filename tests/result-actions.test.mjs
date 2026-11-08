import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const shared = read("../components/calculator-result-actions.tsx");

test("all calculators use one shared result action component", () => {
  for (const file of ["../components/commission-calculator.tsx", "../components/mortgage-calculators.tsx", "../components/loan-calculator.tsx"]) {
    const source = read(file);
    assert.match(source, /import \{ CalculatorResultActions \} from ["']@\/components\/calculator-result-actions["']/);
    assert.match(source, /<CalculatorResultActions\s+onCopy=/);
  }
  assert.match(shared, /data-testid="calculator-copy"/);
  assert.match(shared, /data-testid="calculator-save"/);
  assert.match(shared, /Копировать/);
  assert.match(shared, /Сохранить/);
  assert.match(shared, /Сохранено/);
});

test("shared actions expose one consistent mobile and dark-mode layout", () => {
  assert.match(shared, /grid grid-cols-2 gap-2/);
  assert.match(shared, /min-h-10/);
  assert.match(shared, /rounded-lg/);
  assert.match(shared, /dark:border-/);
  assert.match(shared, /dark:bg-/);
  assert.match(shared, /disabled=\{disabled\}/);
});

test("copy/save handlers retain success and failure feedback", () => {
  for (const file of ["../components/commission-calculator.tsx", "../components/mortgage-calculators.tsx", "../components/loan-calculator.tsx"]) {
    const source = read(file);
    assert.match(source, /Скопировано в буфер обмена/);
    assert.match(source, /Расчёт сохранён в истории/);
    assert.match(source, /Расчёт удалён из истории/);
  }
});

test("all calculator money and rate inputs opt out of browser autofill", () => {
  for (const file of ["../components/commission-calculator.tsx", "../components/mortgage-calculators.tsx", "../components/loan-calculator.tsx"]) {
    const source = read(file);
    assert.match(source, /autoComplete="off"/);
    assert.match(source, /autoCorrect="off"/);
    assert.match(source, /spellCheck=\{false\}/);
  }
});

test("partial down-payment percentages are disclosed only inside calculation details", () => {
  const mortgage = read("../components/mortgage-calculators.tsx");
  const detailsStart = mortgage.indexOf('<details className="mt-3 border-t pt-3');
  const clientPercent = mortgage.indexOf('data-testid="mortgage-client-percent"');
  const missingPercent = mortgage.indexOf('data-testid="mortgage-missing-percent"');
  assert.ok(detailsStart >= 0 && clientPercent > detailsStart && missingPercent > detailsStart);
  assert.match(mortgage.slice(detailsStart), /<summary[^>]*>Подробности расчёта<\/summary>/);
});

test("primary result typography has stronger contrast than secondary actions", () => {
  const mortgage = read("../components/mortgage-calculators.tsx");
  const loan = read("../components/loan-calculator.tsx");
  assert.match(mortgage, /text-\[clamp\(2rem,7vw,2\.75rem\)\]/);
  assert.match(mortgage, /dark:text-\[#FF827B\]/);
  assert.match(loan, /dark:text-\[#FF665F\]/);
  assert.match(loan, /dark:bg-\[#253241\]/);
  assert.match(shared, /min-h-10/);
  assert.match(shared, /text-\[13px\]/);
});

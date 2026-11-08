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
  assert.match(shared, /Скопировано/);
  assert.match(shared, /Убрать сохранение/);
});

test("shared actions use the current compact responsive and dark-mode layout", () => {
  assert.match(shared, /flex flex-wrap items-center justify-start gap-2/);
  assert.match(shared, /min-h-10/);
  assert.match(shared, /rounded-xl/);
  assert.match(shared, /dark:border-/);
  assert.match(shared, /dark:bg-transparent/);
  assert.match(shared, /disabled=\{disabled\}/);
});

test("shared copy/save actions provide success feedback and calculator handlers report copy failures", () => {
  assert.match(shared, /copied \? "Скопировано" : "Копировать"/);
  assert.match(shared, /isSaved \? "Убрать сохранение" : "Сохранить"/);
  for (const file of ["../components/commission-calculator.tsx", "../components/mortgage-calculators.tsx", "../components/loan-calculator.tsx"]) {
    const source = read(file);
    assert.match(source, /Не удалось скопировать сумму/);
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
  assert.match(mortgage, /text-\[clamp\(2rem,7vw,2\.6rem\)\]/);
  assert.match(mortgage, /dark:text-\[#FF766F\]/);
  assert.match(loan, /dark:text-\[#FF665F\]/);
  assert.match(loan, /dark:bg-\[#253241\]/);
  assert.match(shared, /min-h-10/);
  assert.match(shared, /text-xs/);
});


test("result amount is visually primary and copy/save controls are secondary", () => {
  const mortgage = read("../components/mortgage-calculators.tsx");
  assert.match(mortgage, /text-\[clamp\(2rem,7vw,2\.6rem\)\]/);
  assert.match(mortgage, /dark:text-\[#FF766F\]/);
  assert.match(shared, /bg-transparent/);
  assert.match(shared, /dark:text-\[#AEBBCB\]/);
  assert.doesNotMatch(shared, /border-\[#D8DEE7\]/);
});


test("copy button confirms success and saved result can be unsaved without removing its outline", () => {
  assert.match(shared, /const \[copied, setCopied\] = useState\(false\)/);
  assert.match(shared, /copied \? "Скопировано" : "Копировать"/);
  assert.match(shared, /isSaved \? "Убрать сохранение" : "Сохранить"/);
  assert.match(shared, /border-\[#D98A85\]/);
  assert.match(shared, /dark:border-\[#A96560\]/);
});

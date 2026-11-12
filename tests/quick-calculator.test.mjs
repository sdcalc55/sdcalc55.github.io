import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateQuickExpression } from "../lib/quick-calculator.ts";

test("обычные арифметические операции соблюдают приоритет", () => {
  assert.equal(evaluateQuickExpression("2+3*4"), 14);
  assert.equal(evaluateQuickExpression("(2+3)*4"), 20);
  assert.equal(evaluateQuickExpression("100/4-7"), 18);
});
test("поддерживаются отображаемые знаки калькулятора", () => {
  assert.equal(evaluateQuickExpression("25000−5"), 24995);
  assert.equal(evaluateQuickExpression("12×3"), 36);
  assert.equal(evaluateQuickExpression("25÷5"), 5);
  assert.equal(evaluateQuickExpression("(150000+50000)×3"), 600000);
});
test("поддерживаются десятичные числа, пробелы и проценты", () => {
  assert.equal(evaluateQuickExpression("1 500+2 500"), 4000);
  assert.equal(evaluateQuickExpression("12,5*2"), 25);
  assert.equal(evaluateQuickExpression("200*10%"), 20);
});
test("ошибочные выражения и деление на ноль отклоняются", () => {
  assert.throws(() => evaluateQuickExpression("5/0"), /На ноль/);
  assert.throws(() => evaluateQuickExpression("2+abc"), /Некорректное/);
  assert.throws(() => evaluateQuickExpression("(2+3"), /скобка/);
});

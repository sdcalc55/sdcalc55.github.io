import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateQuickExpression, formatQuickExpression } from "../lib/quick-calculator.ts";

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
test("завершающий оператор игнорируется без потери предыдущего результата", () => {
  assert.equal(evaluateQuickExpression("56+66+"), 122);
  assert.equal(evaluateQuickExpression("120×"), 120);
  assert.equal(evaluateQuickExpression("25,5+"), 25.5);
});
test("десятичная запятая корректна в начале, конце и в разных операндах", () => {
  assert.equal(evaluateQuickExpression(",5+1,25"), 1.75);
  assert.equal(evaluateQuickExpression("5,"), 5);
  assert.equal(evaluateQuickExpression("1,2+3,4×2"), 8);
  assert.equal(evaluateQuickExpression("1,000+2,000"), 3);
});
test("повторная десятичная запятая в одном числе отклоняется", () => {
  assert.throws(() => evaluateQuickExpression("1,2,3"), /Некорректное/);
  assert.throws(() => evaluateQuickExpression("10+2,,5"), /Некорректное/);
});
test("операторы умножения и деления не могут начинать выражение", () => {
  for (const value of ["÷9", "×9", "/9", "*9"]) {
    assert.throws(() => evaluateQuickExpression(value), /Ожидается число|Некорректное выражение/, value);
  }
  assert.equal(evaluateQuickExpression("-9"), -9);
  assert.equal(evaluateQuickExpression("+9"), 9);
});
test("строгая проверка отклоняет посторонние символы и опасные строки", () => {
  for (const value of ["1e3", "Infinity", "NaN", "12abc", "alert(1)", "2**3", "1..2", "1,2,3"]) {
    assert.throws(() => evaluateQuickExpression(value), undefined, value);
  }
  assert.throws(() => evaluateQuickExpression("1".repeat(257)), /длинное/);
});
test("десятичные числа корректно работают с унарным минусом и скобками", () => {
  assert.equal(evaluateQuickExpression("-1,5+2"), 0.5);
  assert.equal(evaluateQuickExpression("(-0,5)×4"), -2);
  assert.equal(evaluateQuickExpression("1+(-2,25)"), -1.25);
});
test("ошибочные выражения и деление на ноль отклоняются", () => {
  assert.throws(() => evaluateQuickExpression("5/0"), /На ноль/);
  assert.throws(() => evaluateQuickExpression("2+abc"), /Некорректное/);
  assert.throws(() => evaluateQuickExpression("(2+3"), /скобка/);
});

test("форматирование выражения разделяет тысячи, не меняя вычисление", () => {
  assert.equal(formatQuickExpression("100000×(1−25%)"), "100 000×(1−25%)");
  assert.equal(formatQuickExpression("250000,50+12500"), "250 000,50+12 500");
  assert.equal(formatQuickExpression("0,5×2000"), "0,5×2 000");
  assert.equal(evaluateQuickExpression("100000×(1−25%)"), 75000);
});

test("ноль корректно работает как число, операнд и результат", () => {
  assert.equal(evaluateQuickExpression("0"), 0);
  assert.equal(evaluateQuickExpression("0+5"), 5);
  assert.equal(evaluateQuickExpression("5+0"), 5);
  assert.equal(evaluateQuickExpression("0−5"), -5);
  assert.equal(evaluateQuickExpression("5−5"), 0);
  assert.equal(evaluateQuickExpression("0×999"), 0);
  assert.equal(evaluateQuickExpression("999×0"), 0);
  assert.equal(evaluateQuickExpression("0÷5"), 0);
  assert.equal(evaluateQuickExpression("0,5×0"), 0);
  assert.equal(evaluateQuickExpression("0%"), 0);
});

test("ноль не допускает деление на ноль, включая отрицательный и процентный ноль", () => {
  for (const source of ["5÷0", "5/0", "0/0", "5/(0)", "5/(10−10)", "5÷0%"]) {
    assert.throws(() => evaluateQuickExpression(source), /На ноль/ , source);
  }
});

test("форматирование сохраняет нули и ведущие нули после десятичного разделителя", () => {
  assert.equal(formatQuickExpression("0"), "0");
  assert.equal(formatQuickExpression("0,5+0"), "0,5+0");
  assert.equal(formatQuickExpression("0,05×100"), "0,05×100");
});
